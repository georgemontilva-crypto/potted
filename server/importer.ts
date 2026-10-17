import { eq, like } from "drizzle-orm";
import { slugify, type Block } from "../shared/types";
import { db, schema } from "./db";
import { env } from "./env";
import { cleanHtml, textFromHtml } from "./html";
import { saveFile, saveImage } from "./storage";
import { uniqueSlug } from "./catalog";

/**
 * Importador del sitio anterior en WordPress/WooCommerce. Corre en el
 * servidor (Railway sí puede leer el sitio viejo), copia textos, imágenes
 * y PDFs al almacenamiento propio y reescribe los enlaces.
 */

export const IMPORT_PAGES = [
  { slug: "about-us", nav: true },
  { slug: "faqs", nav: true },
  { slug: "fda-and-hemp", nav: false },
  { slug: "privacy-policy", nav: false },
  { slug: "shipping-policy", nav: false },
  { slug: "refund-policy", nav: false },
  { slug: "terms-of-service", nav: false },
];

export type ImportOptions = {
  source: string;
  posts: boolean;
  pages: boolean;
  products: boolean;
  labReports: boolean;
  overwrite: boolean;
};

type Job = {
  running: boolean;
  startedAt: string;
  finishedAt: string;
  step: string;
  done: number;
  total: number;
  log: string[];
  errors: string[];
};

let job: Job = { running: false, startedAt: "", finishedAt: "", step: "", done: 0, total: 0, log: [], errors: [] };
export const importStatus = () => job;

const log = (line: string) => {
  job.log = [...job.log.slice(-199), line];
};
const err = (line: string) => {
  job.errors = [...job.errors.slice(-99), line];
  console.warn("Importador:", line);
};

const MEDIA_KEY = "wp_media_map";
let mediaMap: Record<string, string> = {};

async function loadMediaMap() {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, MEDIA_KEY)).limit(1);
  try {
    mediaMap = row ? JSON.parse(row.value) : {};
  } catch {
    mediaMap = {};
  }
}
async function saveMediaMap() {
  const value = JSON.stringify(mediaMap);
  await db.insert(schema.settings).values({ key: MEDIA_KEY, value }).onDuplicateKeyUpdate({ set: { value } });
}

async function getJson<T>(url: string): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (PotTed site importer)" },
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`${res.status} al leer ${url}`);
  return { data: (await res.json()) as T, headers: res.headers };
}

const MAX_BYTES = 15 * 1024 * 1024;

/** Descarga un archivo del sitio viejo y devuelve la URL nueva (con caché). */
async function copyMedia(url: string, folder: string, name?: string): Promise<string> {
  const clean = url.split("#")[0]!.split("?")[0]!;
  if (mediaMap[clean]) return mediaMap[clean]!;
  const res = await fetch(clean, {
    headers: { "User-Agent": "Mozilla/5.0 (PotTed site importer)" },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${res.status} al descargar ${clean}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`${clean} pesa más de 15 MB`);
  let mime = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  if (!mime || mime === "application/octet-stream") {
    const ext = clean.split(".").pop()?.toLowerCase() ?? "";
    mime =
      { pdf: "application/pdf", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" }[
        ext
      ] ?? mime;
  }
  const saved = mime.startsWith("image/") ? await saveImage(buf, mime, folder) : await saveFile(buf, mime, folder, name);
  mediaMap[clean] = saved;
  return saved;
}

const decode = (s: string) => textFromHtml(s, 100_000);

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++]!;
        try {
          await fn(item);
        } catch (e) {
          err((e as Error).message);
        }
        job.done += 1;
      }
    }),
  );
}

/** Reescribe imágenes y enlaces internos del HTML importado. */
async function localize(html: string, source: string, postSlugs: Set<string>, productSlugs: Set<string>) {
  const host = new URL(source).host.replace(/^www\./, "");
  const isOld = (u: string) => {
    try {
      return new URL(u, source).host.replace(/^www\./, "") === host;
    } catch {
      return false;
    }
  };

  // Shortcodes de WordPress que quedan sin procesar.
  let out = html.replace(/\[\/?[a-z_][\w-]*(?:\s[^\]]*)?\]/gi, "");
  // srcset/sizes de WordPress apuntan a miniaturas del sitio viejo.
  out = out.replace(/\s(srcset|sizes|data-[\w-]+)="[^"]*"/gi, "");

  const imgs = [...out.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) => m[1]!).filter((u) => isOld(u));
  for (const src of new Set(imgs)) {
    try {
      // Pide el original en vez de la miniatura (-300x200.webp).
      const original = new URL(src, source).href.replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]{3,4}$)/i, "");
      let next: string;
      try {
        next = await copyMedia(original, "blog");
      } catch {
        next = await copyMedia(new URL(src, source).href, "blog");
      }
      out = out.split(`src="${src}"`).join(`src="${next}"`);
    } catch (e) {
      err(`Imagen ${src}: ${(e as Error).message}`);
    }
  }

  out = out.replace(/href="([^"]+)"/gi, (whole, href: string) => {
    if (!isOld(href)) return whole;
    let path: string;
    try {
      path = new URL(href, source).pathname;
    } catch {
      return whole;
    }
    if (/\/wp-content\/uploads\//.test(path)) return whole;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1] ?? "";
    if (parts.length === 0) return 'href="/"';
    if (parts[0] === "shop" && productSlugs.has(last)) return `href="/product/${last}"`;
    if (parts[0] === "shop") return 'href="/shop"';
    if (parts[0] === "product-category") return `href="/shop/${last}"`;
    if (parts.length === 1 && postSlugs.has(last)) return `href="/blog/${last}"`;
    return `href="/${parts.join("/")}"`;
  });
  return cleanHtml(out);
}

type WpPost = {
  id: number;
  slug: string;
  link: string;
  date_gmt: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  _embedded?: {
    author?: { name?: string }[];
    "wp:featuredmedia"?: { source_url?: string }[];
  };
};

async function importPosts(o: ImportOptions, productSlugs: Set<string>) {
  job.step = "Leyendo los artículos del blog";
  const all: WpPost[] = [];
  for (let page = 1; page < 40; page++) {
    const { data, headers } = await getJson<WpPost[]>(
      `${o.source}/wp-json/wp/v2/posts?per_page=50&page=${page}&_embed=author,wp:featuredmedia`,
    );
    all.push(...data);
    const pages = Number(headers.get("x-wp-totalpages") ?? "1");
    if (page >= pages || data.length === 0) break;
  }
  log(`Blog: ${all.length} artículos encontrados.`);
  const postSlugs = new Set(all.map((p) => p.slug));
  job.step = "Copiando artículos e imágenes";
  job.total += all.length;
  let created = 0;
  let updated = 0;
  await pool(all, 3, async (p) => {
    const [existing] = await db.select().from(schema.posts).where(eq(schema.posts.slug, p.slug)).limit(1);
    if (existing && !o.overwrite) return;
    const body = await localize(p.content.rendered, o.source, postSlugs, productSlugs);
    const featured = p._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
    let coverUrl = "";
    if (featured) {
      try {
        coverUrl = await copyMedia(featured, "blog");
      } catch (e) {
        err(`Portada de ${p.slug}: ${(e as Error).message}`);
      }
    }
    const excerpt = textFromHtml(p.excerpt.rendered || p.content.rendered, 280).replace(/\s*\[…\]$/, "…");
    const values = {
      title: decode(p.title.rendered).slice(0, 255),
      slug: p.slug.slice(0, 191),
      excerpt: excerpt.slice(0, 600),
      coverUrl,
      body,
      author: p._embedded?.author?.[0]?.name?.slice(0, 120) ?? "",
      seoDescription: excerpt.slice(0, 300),
      isPublished: true,
      publishedAt: new Date(`${p.date_gmt}Z`),
      sourceUrl: p.link.slice(0, 400),
    };
    if (existing) {
      await db.update(schema.posts).set(values).where(eq(schema.posts.id, existing.id));
      updated++;
    } else {
      await db.insert(schema.posts).values(values);
      created++;
    }
  });
  log(`Blog: ${created} nuevos, ${updated} actualizados.`);
  return postSlugs;
}

type WpPage = { slug: string; title: { rendered: string }; content: { rendered: string }; excerpt: { rendered: string } };

async function importPages(o: ImportOptions, postSlugs: Set<string>, productSlugs: Set<string>) {
  job.step = "Copiando páginas";
  job.total += IMPORT_PAGES.length;
  for (const target of IMPORT_PAGES) {
    try {
      const { data } = await getJson<WpPage[]>(`${o.source}/wp-json/wp/v2/pages?slug=${target.slug}`);
      const wp = data[0];
      if (!wp) {
        err(`No existe la página ${target.slug} en el sitio viejo.`);
        continue;
      }
      const html = await localize(wp.content.rendered, o.source, postSlugs, productSlugs);
      const title = decode(wp.title.rendered);
      const blocks: Block[] = [{ type: "html", title: "", html }];
      const [existing] = await db.select().from(schema.pages).where(eq(schema.pages.slug, target.slug)).limit(1);
      const values = {
        title: title.slice(0, 160),
        blocks: JSON.stringify(blocks),
        isPublished: true,
        seoDescription: textFromHtml(html, 280).slice(0, 300),
      };
      if (existing) {
        if (!o.overwrite && existing.isPublished && !existing.blocks.includes('"pendiente_importar"')) {
          log(`Página ${target.slug}: ya existía, no se tocó.`);
        } else {
          await db.update(schema.pages).set(values).where(eq(schema.pages.id, existing.id));
          log(`Página ${target.slug}: actualizada.`);
        }
      } else {
        await db.insert(schema.pages).values({
          ...values,
          slug: target.slug,
          intro: "",
          showInNav: target.nav,
          showInFooter: true,
          sortOrder: 50,
        });
        log(`Página ${target.slug}: creada.`);
      }
    } catch (e) {
      err(`Página ${target.slug}: ${(e as Error).message}`);
    } finally {
      job.done += 1;
    }
  }
}

type WcProduct = {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  description: string;
  prices: { price: string; regular_price: string; currency_minor_unit: number };
  categories: { name: string; slug: string }[];
  images: { src: string; alt: string }[];
};

async function importProducts(o: ImportOptions) {
  job.step = "Copiando fotos de productos";
  const list: WcProduct[] = [];
  for (let page = 1; page < 10; page++) {
    const { data, headers } = await getJson<WcProduct[]>(`${o.source}/wp-json/wc/store/v1/products?per_page=100&page=${page}`);
    list.push(...data);
    if (page >= Number(headers.get("x-wp-totalpages") ?? "1") || data.length === 0) break;
  }
  log(`Productos: ${list.length} en el sitio viejo.`);
  job.total += list.length;
  const cats = await db.select().from(schema.categories);
  let updated = 0;
  let created = 0;
  await pool(list, 2, async (wp) => {
    const [local] = await db.select().from(schema.products).where(eq(schema.products.slug, wp.slug)).limit(1);
    const imgs = await db
      .select()
      .from(schema.productImages)
      .where(eq(schema.productImages.productId, local?.id ?? -1));
    const needsImages = !local || o.overwrite || imgs.length === 0 || imgs.every((i) => i.url.startsWith("/seed/"));
    const urls: string[] = [];
    if (needsImages) {
      for (const img of wp.images) {
        try {
          urls.push(await copyMedia(img.src, "products"));
        } catch (e) {
          err(`Foto de ${wp.slug}: ${(e as Error).message}`);
        }
      }
    }
    if (local) {
      if (needsImages && urls.length) {
        await db.delete(schema.productImages).where(eq(schema.productImages.productId, local.id));
        await db
          .insert(schema.productImages)
          .values(urls.map((url, i) => ({ productId: local.id, url, color: "", sortOrder: i })));
        updated++;
      }
      return;
    }
    // Producto que existe en el sitio viejo y no aquí: se crea.
    const minor = wp.prices.currency_minor_unit ?? 2;
    const price = Math.round((Number(wp.prices.price) / 10 ** minor) * 100);
    const leaf = wp.categories[wp.categories.length - 1];
    const cat = cats.find((c) => c.slug === leaf?.slug || c.name.toLowerCase() === leaf?.name.toLowerCase());
    const [ins] = await db.insert(schema.products).values({
      name: decode(wp.name).slice(0, 160),
      slug: await uniqueSlug("products", slugify(wp.slug)),
      tagline: "",
      description: textFromHtml(wp.description || wp.short_description, 20_000),
      details: "",
      price,
      categoryId: cat?.id ?? null,
      colors: "[]",
      sizes: "[]",
    });
    if (urls.length) {
      await db
        .insert(schema.productImages)
        .values(urls.map((url, i) => ({ productId: ins.insertId, url, color: "", sortOrder: i })));
    }
    await db.insert(schema.productVariants).values({ productId: ins.insertId, stock: 100 });
    created++;
  });
  log(`Productos: fotos actualizadas en ${updated}, ${created} productos nuevos creados.`);
}

async function importLabReports(o: ImportOptions) {
  job.step = "Copiando los PDF de laboratorio";
  const host = new URL(o.source).host.replace(/^www\./, "");
  const rows = await db.select().from(schema.labReports).where(like(schema.labReports.fileUrl, `%${host}%`));
  job.total += rows.length;
  let copied = 0;
  await pool(rows, 4, async (r) => {
    const url = await copyMedia(r.fileUrl, "lab-reports", r.title);
    await db.update(schema.labReports).set({ fileUrl: url }).where(eq(schema.labReports.id, r.id));
    copied++;
  });
  log(`Lab results: ${copied} de ${rows.length} PDF copiados.`);
}

export function startImport(input: Partial<ImportOptions>) {
  if (job.running) return job;
  const o: ImportOptions = {
    source: (input.source || env.wpSource).replace(/\/+$/, ""),
    posts: input.posts ?? true,
    pages: input.pages ?? true,
    products: input.products ?? true,
    labReports: input.labReports ?? true,
    overwrite: input.overwrite ?? false,
  };
  job = { running: true, startedAt: new Date().toISOString(), finishedAt: "", step: "Empezando", done: 0, total: 0, log: [], errors: [] };
  log(`Importando desde ${o.source}`);

  void (async () => {
    try {
      await loadMediaMap();
      const productSlugs = new Set((await db.select({ slug: schema.products.slug }).from(schema.products)).map((p) => p.slug));
      if (o.products) await importProducts(o).catch((e) => err(`Productos: ${(e as Error).message}`));
      await saveMediaMap();
      let postSlugs = new Set(
        (await db.select({ slug: schema.posts.slug }).from(schema.posts)).map((p) => p.slug),
      );
      if (o.posts) {
        postSlugs = await importPosts(o, productSlugs).catch((e) => {
          err(`Blog: ${(e as Error).message}`);
          return postSlugs;
        });
        await saveMediaMap();
      }
      if (o.pages) await importPages(o, postSlugs, productSlugs);
      if (o.labReports) await importLabReports(o).catch((e) => err(`Lab results: ${(e as Error).message}`));
      await saveMediaMap();
      job.step = job.errors.length ? "Terminado con algunos errores" : "Terminado";
    } catch (e) {
      err((e as Error).message);
      job.step = "Se detuvo por un error";
    } finally {
      job.running = false;
      job.finishedAt = new Date().toISOString();
    }
  })();
  return job;
}
