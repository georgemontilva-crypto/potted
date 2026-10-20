import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { assertEnv, env, r2Enabled } from "./env";
import { db, runMigrations, schema } from "./db";
import { createContext, router } from "./trpc";
import { readSession, rateLimit } from "./auth";
import { saveFile, saveImage } from "./storage";
import { seed } from "./seed";
import { applyCatalogUpdates } from "./catalogUpdates";
import { getSettings } from "./settings";
import { storeRouter } from "./routers/store";
import { authRouter } from "./routers/auth";
import { adminRouter } from "./routers/admin";
import { sendProofReceived } from "./email";
import { startPaypalReconciler } from "./paypal";
import { paypalEnabled } from "./env";

export const appRouter = router({ store: storeRouter, auth: authRouter, admin: adminRouter });
export type AppRouter = typeof appRouter;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"];
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Título y metadatos por página, para buscadores y para compartir enlaces. */
async function headFor(url: string) {
  const s = await getSettings();
  let title = `${s.storeName} | ${s.tagline}`;
  let description =
    "Premium THCA live rosin, crumble and pre-rolls. Lab-tested, shipped fast across the USA. Must be 21+.";
  let image = s.logoUrl;
  const pathname = url.split("?")[0] ?? "/";
  let noindex = pathname.startsWith("/admin") || pathname.startsWith("/order/") || pathname === "/checkout";

  const productSlug = pathname.match(/^\/product\/([^/]+)/)?.[1];
  const postSlug = pathname.match(/^\/blog\/([^/]+)/)?.[1];
  if (productSlug) {
    const [p] = await db.select().from(schema.products).where(eq(schema.products.slug, productSlug)).limit(1);
    if (p?.isActive) {
      title = `${p.name}${p.strain ? ` – ${p.strain}` : ""} | ${s.storeName}`;
      description = (p.tagline || p.description).slice(0, 160);
      const [img] = await db
        .select()
        .from(schema.productImages)
        .where(eq(schema.productImages.productId, p.id))
        .orderBy(schema.productImages.sortOrder)
        .limit(1);
      if (img) image = img.url;
    }
  } else if (postSlug) {
    const [p] = await db.select().from(schema.posts).where(eq(schema.posts.slug, postSlug)).limit(1);
    if (p?.isPublished) {
      title = `${p.title} | ${s.storeName}`;
      description = p.seoDescription || p.excerpt;
      if (p.coverUrl) image = p.coverUrl;
    }
  } else if (pathname.startsWith("/admin")) {
    title = `Panel | ${s.storeName}`;
  } else if (pathname.startsWith("/shop")) {
    title = `Shop | ${s.storeName}`;
  } else if (pathname === "/lab-results") {
    title = `Lab Results | ${s.storeName}`;
    description = "Third-party Certificates of Analysis for every PotTed product.";
  } else if (pathname === "/blog") {
    title = `Blog | ${s.storeName}`;
  } else if (pathname === "/wholesale") {
    title = `Wholesale | ${s.storeName}`;
    description = s.wholesaleIntro;
  } else if (pathname === "/wishlist" || pathname === "/compare") {
    title = `${pathname === "/wishlist" ? "Wishlist" : "Compare"} | ${s.storeName}`;
    noindex = true;
  } else if (pathname === "/contact-us") {
    title = `Contact Us | ${s.storeName}`;
  } else if (pathname !== "/") {
    const slug = pathname.replace(/^\/+|\/+$/g, "");
    if (slug && !slug.includes("/")) {
      const [pg] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
      if (pg?.isPublished) {
        title = `${pg.title} | ${s.storeName}`;
        description = pg.seoDescription || pg.intro || description;
      } else {
        noindex = true;
      }
    }
  }

  const abs = (u: string) => (u.startsWith("/") && env.publicUrl ? `${env.publicUrl}${u}` : u);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    image ? `<meta property="og:image" content="${esc(abs(image))}" />` : "",
    env.publicUrl && !noindex ? `<link rel="canonical" href="${esc(env.publicUrl + pathname)}" />` : "",
    s.faviconUrl ? `<link rel="icon" href="${esc(s.faviconUrl)}" />` : "",
    noindex ? `<meta name="robots" content="noindex" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

/**
 * Redirige las direcciones del sitio viejo en WordPress a las nuevas
 * (301), para no perder posicionamiento ni enlaces compartidos.
 */
async function legacyRedirect(pathname: string): Promise<string | null> {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const trimmed = pathname.replace(/\/+$/, "") || "/";
    return (await legacyRedirect(trimmed)) ?? trimmed;
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1]!;
  const first = parts[0]!;

  if (first === "shop" && parts.length >= 2) {
    const [p] = await db.select({ slug: schema.products.slug }).from(schema.products).where(eq(schema.products.slug, last)).limit(1);
    if (p) return `/product/${p.slug}`;
    const [c] = await db.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.slug, last)).limit(1);
    if (c && parts.length > 2) return `/shop/${c.slug}`;
    return parts.length > 2 ? "/shop" : null;
  }
  if (first === "product-category") {
    const [c] = await db.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.slug, last)).limit(1);
    return c ? `/shop/${c.slug}` : "/shop";
  }
  if (first === "effects") return `/shop?strain=${encodeURIComponent(last.charAt(0).toUpperCase() + last.slice(1))}`;
  if (first === "my-account") return "/track";
  if (first === "cart") return "/shop";
  if (first === "faq") return "/faqs";
  if (first === "blog" && parts[1] === "page") return "/blog";
  if (parts.length === 1) {
    const known = ["shop", "checkout", "track", "lab-results", "blog", "wholesale", "contact-us", "wishlist", "compare"];
    if (known.includes(first)) return null;
    const [pg] = await db.select({ id: schema.pages.id }).from(schema.pages).where(eq(schema.pages.slug, first)).limit(1);
    if (pg) return null;
    const [post] = await db.select({ slug: schema.posts.slug }).from(schema.posts).where(eq(schema.posts.slug, first)).limit(1);
    if (post) return `/blog/${post.slug}`;
  }
  return null;
}

async function sitemap() {
  const base = env.publicUrl;
  const [prods, pgs, psts, cats] = await Promise.all([
    db.select({ slug: schema.products.slug, at: schema.products.updatedAt }).from(schema.products).where(eq(schema.products.isActive, true)),
    db.select({ slug: schema.pages.slug, at: schema.pages.updatedAt }).from(schema.pages).where(eq(schema.pages.isPublished, true)),
    db.select({ slug: schema.posts.slug, at: schema.posts.updatedAt }).from(schema.posts).where(eq(schema.posts.isPublished, true)),
    db.select({ slug: schema.categories.slug }).from(schema.categories).where(eq(schema.categories.isActive, true)),
  ]);
  const urls: [string, Date | null][] = [
    ["/", null],
    ["/shop", null],
    ["/lab-results", null],
    ["/blog", null],
    ["/wholesale", null],
    ["/contact-us", null],
    ...cats.map((c): [string, null] => [`/shop/${c.slug}`, null]),
    ...prods.map((p): [string, Date] => [`/product/${p.slug}`, p.at]),
    ...pgs.map((p): [string, Date] => [`/${p.slug}`, p.at]),
    ...psts.map((p): [string, Date] => [`/blog/${p.slug}`, p.at]),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      ([u, at]) =>
        `  <url><loc>${esc(base + u)}</loc>${at ? `<lastmod>${new Date(at).toISOString().slice(0, 10)}</lastmod>` : ""}</url>`,
    )
    .join("\n")}\n</urlset>\n`;
}

async function main() {
  assertEnv();

  console.log("→ Aplicando migraciones…");
  await runMigrations();
  await seed();
  await applyCatalogUpdates();
  startPaypalReconciler();

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").send(
      `User-agent: *\nDisallow: /admin\nDisallow: /checkout\nDisallow: /order/\n${env.publicUrl ? `Sitemap: ${env.publicUrl}/sitemap.xml\n` : ""}`,
    );
  });
  app.get("/sitemap.xml", async (_req, res, next) => {
    try {
      res.type("application/xml").send(await sitemap());
    } catch (err) {
      next(err);
    }
  });

  /* Direcciones del sitio anterior (WordPress). */
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/assets") || req.path.startsWith("/media")) {
      return next();
    }
    if (/^\/wp-content\/uploads\/.+\.pdf$/i.test(req.path)) {
      res.redirect(301, "/lab-results");
      return;
    }
    if (req.path.startsWith("/wp-") || req.path.startsWith("/feed") || req.path === "/xmlrpc.php") {
      res.status(410).end();
      return;
    }
    try {
      const to = await legacyRedirect(req.path);
      if (to && to !== req.path) {
        const qs = req.originalUrl.includes("?") && !to.includes("?") ? req.originalUrl.slice(req.originalUrl.indexOf("?")) : "";
        res.redirect(301, to + qs);
        return;
      }
    } catch (err) {
      return next(err);
    }
    next();
  });

  /* Imágenes guardadas en la base de datos (cuando no hay R2). */
  app.get("/media/:file", async (req, res) => {
    const id = String(req.params.file).replace(/\.[a-z0-9]+$/i, "");
    const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
    if (!row) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", row.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (row.mime === "image/svg+xml") {
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
    res.end(row.data);
  });

  /* Subida de imágenes desde el panel. */
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    const uid = await readSession(req);
    if (!uid) {
      res.status(401).json({ error: "Inicia sesión para subir imágenes." });
      return;
    }
    const file = req.file;
    if (file?.mimetype === "application/pdf") {
      const name = file.originalname.replace(/\.pdf$/i, "");
      res.json({ url: await saveFile(file.buffer, file.mimetype, "lab-reports", name) });
      return;
    }
    if (!file || !IMAGE_TYPES.includes(file.mimetype)) {
      res.status(400).json({ error: "Sube una imagen JPG, PNG, WebP, AVIF, GIF o SVG, o un PDF." });
      return;
    }
    const url = await saveImage(file.buffer, file.mimetype, "img");
    res.json({ url });
  });

  /* Comprobante de pago que sube el cliente desde su pedido. */
  app.post("/api/upload/comprobante", upload.single("file"), async (req, res) => {
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.ip ?? "").trim();
    if (!rateLimit(`proof:${ip}`, 10, 10 * 60_000)) {
      res.status(429).json({ error: "Too many attempts. Please wait a few minutes." });
      return;
    }
    const token = String(req.body?.token ?? "");
    const file = req.file;
    if (!file || !PROOF_TYPES.includes(file.mimetype)) {
      res.status(400).json({ error: "Upload your receipt as an image (JPG, PNG) or a PDF." });
      return;
    }
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.token, token)).limit(1);
    if (!order || token.length < 20) {
      res.status(404).json({ error: "We couldn’t find that order." });
      return;
    }
    if (order.status !== "pendiente") {
      res.status(400).json({ error: "This order is no longer awaiting payment." });
      return;
    }
    const url = await saveImage(file.buffer, file.mimetype, "comprobantes");
    await db.update(schema.orders).set({ paymentProofUrl: url }).where(eq(schema.orders.id, order.id));
    await db
      .insert(schema.orderEvents)
      .values({ orderId: order.id, status: "pendiente", note: "Payment receipt uploaded" });
    void sendProofReceived({ ...order, paymentProofUrl: url });
    res.json({ url });
  });

  app.use(
    "/api/trpc",
    express.json({ limit: "2mb" }),
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path: p }) {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${p}:`, error);
      },
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "No existe." });
  });

  if (env.isProd) {
    const dist = path.resolve(process.cwd(), "dist/public");
    const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    app.use(
      "/assets",
      express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
    );
    app.use(express.static(dist, { index: false, maxAge: "1d" }));
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      try {
        const head = await headFor(req.originalUrl);
        res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" });
        res.end(template.replace("<!--app-head-->", head));
      } catch (err) {
        next(err);
      }
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      try {
        const raw = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, raw);
        res.status(200).set({ "Content-Type": "text/html" });
        res.end(html.replace("<!--app-head-->", await headFor(req.originalUrl)));
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { code?: string; message?: string };
    if (e?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "The file is larger than 15 MB." });
      return;
    }
    const status = (err as { status?: number })?.status;
    if (status && status >= 400 && status < 500) {
      res.status(status).end();
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`✓ Tienda lista en el puerto ${env.port}`);
    console.log(`  Imágenes: ${r2Enabled ? "Cloudflare R2" : "base de datos (configura R2 para producción)"}`);
    console.log(`  Correos: ${env.resendKey && env.emailFrom ? "Resend" : "desactivados (falta RESEND_API_KEY / EMAIL_FROM)"}`);
    console.log(`  PayPal: ${paypalEnabled ? (env.paypal.live ? "activo (LIVE)" : "activo (sandbox)") : "desactivado (falta PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)"}`);
  });
}

main().catch((err) => {
  console.error("✗ No se pudo iniciar el servidor:", err);
  process.exit(1);
});
