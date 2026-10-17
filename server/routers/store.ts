import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { ORDER_STATUSES, type Block } from "../../shared/types";
import { db, schema } from "../db";
import { fail, publicProcedure, router } from "../trpc";
import { getSettings } from "../settings";
import { getProductDetail, listProductCards, parseJson } from "../catalog";
import { checkoutInput, createOrder, loadOrder, resolveCoupon } from "../orders";
import { sendOrderCreated } from "../email";
import { rateLimit } from "../auth";
import { env, paypalEnabled } from "../env";
import { capturePaypalOrder, createPaypalOrder } from "../paypal";
import { sendInquiryNotice } from "../email";

const { categories, pages, products, shippingMethods, paymentMethods, orders, labReports, posts, inquiries, subscribers } = schema;

function publicOrder(data: NonNullable<Awaited<ReturnType<typeof loadOrder>>>) {
  const { order: o, items, events } = data;
  return {
    number: o.number,
    token: o.token,
    status: o.status as (typeof ORDER_STATUSES)[number],
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    address: [o.address, o.addressExtra, o.city, o.region, o.postalCode, o.country].filter(Boolean).join(", "),
    shippingMethod: o.shippingMethod,
    shippingEta: o.shippingEta,
    paymentMethod: o.paymentMethod,
    paymentInstructions: o.paymentInstructions,
    paymentRequiresProof: o.paymentRequiresProof,
    paymentProvider: o.paymentProvider,
    paid: Boolean(o.paypalCaptureId) || !["pendiente", "cancelado"].includes(o.status),
    paymentProofUrl: o.paymentProofUrl,
    couponCode: o.couponCode,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingCost: o.shippingCost,
    total: o.total,
    currency: o.currency,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    createdAt: o.createdAt,
    items: items.map((i) => ({
      name: i.name,
      color: i.color,
      size: i.size,
      imageUrl: i.imageUrl,
      price: i.price,
      quantity: i.quantity,
    })),
    events: events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
  };
}

export const storeRouter = router({
  /** Todo lo que necesita el marco de la tienda: marca, menú y categorías. */
  bootstrap: publicProcedure.query(async () => {
    const [s, cats, pgs] = await Promise.all([
      getSettings(),
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          title: pages.title,
          slug: pages.slug,
          showInNav: pages.showInNav,
          showInFooter: pages.showInFooter,
        })
        .from(pages)
        .where(eq(pages.isPublished, true))
        .orderBy(asc(pages.sortOrder), asc(pages.title)),
    ]);
    const { notifyEmail: _n, lowStock: _l, ...publicSettings } = s;
    const strains = await db
      .selectDistinct({ strain: products.strain })
      .from(products)
      .where(and(eq(products.isActive, true), ne(products.strain, "")))
      .orderBy(asc(products.strain));
    const [postCount] = await db
      .select({ n: sql<number>`cast(count(*) as signed)` })
      .from(posts)
      .where(eq(posts.isPublished, true));
    return {
      settings: publicSettings,
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
      })),
      pages: pgs,
      strains: strains.map((x) => x.strain),
      hasBlog: Number(postCount?.n ?? 0) > 0,
    };
  }),

  home: publicProcedure.query(async () => {
    const s = await getSettings();
    const [featured, latest] = await Promise.all([
      listProductCards({ featured: true, sort: "destacados", limit: 12 }),
      listProductCards({ sort: "nuevos", limit: 8 }),
    ]);
    const heroProduct =
      (s.home.heroProductId ? await getProductDetail(eq(products.id, s.home.heroProductId)) : null) ??
      (featured[0] ? await getProductDetail(eq(products.id, featured[0].id)) : null);
    const showcaseId =
      s.home.showcaseProductId ?? [...featured, ...latest].find((p) => p.id !== heroProduct?.id)?.id ?? null;
    const showcase = showcaseId ? await getProductDetail(eq(products.id, showcaseId)) : null;

    let prerolls: Awaited<ReturnType<typeof listProductCards>> = [];
    if (s.home.prerollCategory) {
      const [pc] = await db.select().from(categories).where(eq(categories.slug, s.home.prerollCategory)).limit(1);
      if (pc?.isActive) prerolls = await listProductCards({ categoryId: pc.id, limit: 12 });
    }

    // Imagen representativa para cada categoría sin foto propia.
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    const catTiles = await Promise.all(
      cats.map(async (c) => {
        const sample = await listProductCards({ categoryId: c.id, limit: 1 });
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl || sample[0]?.images[0]?.url || "",
          hasCustomImage: Boolean(c.imageUrl),
        };
      }),
    );

    // Catálogo para el selector de vibra de la portada.
    const pool = (await listProductCards({ sort: "destacados", limit: 60 })).filter((p) => p.images.length > 0);

    return { featured, latest, heroProduct, showcase, prerolls, pool, categories: catTiles };
  }),

  products: publicProcedure
    .input(
      z.object({
        category: z.string().max(140).optional(),
        strain: z.string().max(40).optional(),
        search: z.string().max(80).optional(),
        sort: z.enum(["destacados", "nuevos", "precio_asc", "precio_desc", "nombre"]).default("destacados"),
        onlyNew: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      let categoryId: number | undefined;
      if (input.category) {
        const [c] = await db.select().from(categories).where(eq(categories.slug, input.category)).limit(1);
        if (!c || !c.isActive) return { items: [], category: null };
        categoryId = c.id;
        const items = await listProductCards({ categoryId, strain: input.strain, search: input.search, sort: input.sort, onlyNew: input.onlyNew });
        return { items, category: { name: c.name, slug: c.slug, description: c.description } };
      }
      const items = await listProductCards({ strain: input.strain, search: input.search, sort: input.sort, onlyNew: input.onlyNew });
      return { items, category: null };
    }),

  product: publicProcedure.input(z.object({ slug: z.string().max(180) })).query(async ({ input }) => {
    const product = await getProductDetail(eq(products.slug, input.slug));
    if (!product) return null;
    const related = (
      await listProductCards({ categoryId: product.categoryId ?? undefined, limit: 8 })
    ).filter((p) => p.id !== product.id);
    const fill =
      related.length >= 3
        ? []
        : (await listProductCards({ limit: 8 })).filter(
            (p) => p.id !== product.id && !related.some((r) => r.id === p.id),
          );
    return { product, related: [...related, ...fill].slice(0, 4) };
  }),

  /** Estado actual (precio, stock) de los artículos guardados en la bolsa. */
  cart: publicProcedure
    .input(z.object({ variantIds: z.array(z.number().int()).max(80) }))
    .query(async ({ input }) => {
      if (input.variantIds.length === 0) return [];
      const rows = await db
        .select({
          variantId: schema.productVariants.id,
          stock: schema.productVariants.stock,
          color: schema.productVariants.color,
          size: schema.productVariants.size,
          productId: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
          isActive: products.isActive,
        })
        .from(schema.productVariants)
        .innerJoin(products, eq(products.id, schema.productVariants.productId))
        .where(inArray(schema.productVariants.id, input.variantIds));
      const mine = rows;
      const cards = await listProductCards({ ids: [...new Set(mine.map((m) => m.productId))], includeInactive: true });
      return mine.map((r) => {
        const card = cards.find((c) => c.id === r.productId);
        const img =
          card?.images.find((i) => i.color === r.color) ?? card?.images.find((i) => i.color === "") ?? card?.images[0];
        return { ...r, imageUrl: img?.url ?? "" };
      });
    }),

  page: publicProcedure.input(z.object({ slug: z.string().max(140) })).query(async ({ input }) => {
    const [p] = await db
      .select()
      .from(pages)
      .where(and(eq(pages.slug, input.slug), eq(pages.isPublished, true)))
      .limit(1);
    if (!p) return null;
    return {
      title: p.title,
      slug: p.slug,
      intro: p.intro,
      seoDescription: p.seoDescription,
      blocks: parseJson<Block[]>(p.blocks, []),
    };
  }),

  checkoutOptions: publicProcedure.query(async () => {
    const [ship, pay] = await Promise.all([
      db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.isActive, true))
        .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.id)),
      db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.isActive, true))
        .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id)),
    ]);
    return {
      shipping: ship.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        eta: s.eta,
        price: s.price,
        freeOver: s.freeOver,
      })),
      payment: pay
        .filter((p) => p.provider !== "paypal" || paypalEnabled)
        .map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          requiresProof: p.provider === "paypal" ? false : p.requiresProof,
          provider: p.provider,
        })),
    };
  }),

  coupon: publicProcedure
    .input(z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().int().min(0) }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`coupon:${ctx.ip}`, 20, 10 * 60_000)) {
        throw fail("Too many attempts. Please wait a few minutes.", "TOO_MANY_REQUESTS");
      }
      const c = await resolveCoupon(input.code, input.subtotal);
      if (!c) throw fail("Enter a coupon code.");
      return { code: c.code, discount: c.discount, type: c.type, value: c.value };
    }),

  createOrder: publicProcedure.input(checkoutInput).mutation(async ({ input, ctx }) => {
    if (!rateLimit(`order:${ctx.ip}`, 8, 10 * 60_000)) {
      throw fail("You placed several orders in a row. Please wait a few minutes and try again.", "TOO_MANY_REQUESTS");
    }
    const created = await createOrder(input);
    const data = await loadOrder(eq(orders.id, created.orderId));
    if (data) void sendOrderCreated(data.order, data.items);
    return { token: created.token, number: created.number };
  }),

  order: publicProcedure.input(z.object({ token: z.string().min(20).max(64) })).query(async ({ input }) => {
    const data = await loadOrder(eq(orders.token, input.token));
    return data ? publicOrder(data) : null;
  }),

  /** Buscar un pedido con su número y el correo con el que se hizo. */
  findOrder: publicProcedure
    .input(z.object({ number: z.string().trim().min(3).max(24), email: z.email("Enter a valid email address.") }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`find:${ctx.ip}`, 12, 10 * 60_000)) {
        throw fail("Too many attempts. Please wait a few minutes.", "TOO_MANY_REQUESTS");
      }
      const number = input.number.toUpperCase().replace(/^#/, "");
      const [o] = await db
        .select({ token: orders.token })
        .from(orders)
        .where(
          and(
            eq(orders.number, number.startsWith("PT-") ? number : `PT-${number}`),
            eq(orders.customerEmail, input.email.toLowerCase()),
            ne(orders.token, ""),
          ),
        )
        .limit(1);
      if (!o) throw fail("We couldn’t find an order with that number and email.", "NOT_FOUND");
      return { token: o.token };
    }),

  /* ───────────── PayPal ───────────── */

  paypalConfig: publicProcedure.query(() => ({
    enabled: paypalEnabled,
    clientId: env.paypal.clientId,
    live: env.paypal.live,
  })),

  paypalCreate: publicProcedure
    .input(z.object({ token: z.string().min(20).max(64) }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`pp:${ctx.ip}`, 30, 10 * 60_000)) throw fail("Too many attempts. Please wait a few minutes.", "TOO_MANY_REQUESTS");
      return createPaypalOrder(input.token);
    }),

  paypalCapture: publicProcedure
    .input(z.object({ token: z.string().min(20).max(64), paypalOrderId: z.string().min(5).max(64) }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`ppc:${ctx.ip}`, 30, 10 * 60_000)) throw fail("Too many attempts. Please wait a few minutes.", "TOO_MANY_REQUESTS");
      return capturePaypalOrder(input.token, input.paypalOrderId);
    }),

  /* ───────────── Lab results ───────────── */

  labReports: publicProcedure.query(async () => {
    const rows = await db
      .select({
        id: labReports.id,
        title: labReports.title,
        section: labReports.section,
        fileUrl: labReports.fileUrl,
        lab: labReports.lab,
        batch: labReports.batch,
        testedAt: labReports.testedAt,
        productSlug: products.slug,
        productActive: products.isActive,
      })
      .from(labReports)
      .leftJoin(products, eq(products.id, labReports.productId))
      .where(eq(labReports.isPublished, true))
      .orderBy(asc(labReports.sortOrder), asc(labReports.section), asc(labReports.title));
    return rows.map((r) => ({ ...r, productSlug: r.productActive ? r.productSlug : null }));
  }),

  /* ───────────── Blog ───────────── */

  posts: publicProcedure
    .input(z.object({ page: z.number().int().min(1).max(500).default(1), perPage: z.number().int().min(1).max(48).default(12) }))
    .query(async ({ input }) => {
      const where = and(eq(posts.isPublished, true), lte(posts.publishedAt, new Date()));
      const [rows, [count]] = await Promise.all([
        db
          .select({
            id: posts.id,
            title: posts.title,
            slug: posts.slug,
            excerpt: posts.excerpt,
            coverUrl: posts.coverUrl,
            publishedAt: posts.publishedAt,
          })
          .from(posts)
          .where(where)
          .orderBy(desc(posts.publishedAt), desc(posts.id))
          .limit(input.perPage)
          .offset((input.page - 1) * input.perPage),
        db.select({ n: sql<number>`cast(count(*) as signed)` }).from(posts).where(where),
      ]);
      const total = Number(count?.n ?? 0);
      return { items: rows, total, pages: Math.max(1, Math.ceil(total / input.perPage)) };
    }),

  post: publicProcedure.input(z.object({ slug: z.string().max(191) })).query(async ({ input }) => {
    const [p] = await db
      .select()
      .from(posts)
      .where(and(eq(posts.slug, input.slug), eq(posts.isPublished, true)))
      .limit(1);
    if (!p) return null;
    const more = await db
      .select({ id: posts.id, title: posts.title, slug: posts.slug, coverUrl: posts.coverUrl, publishedAt: posts.publishedAt })
      .from(posts)
      .where(and(eq(posts.isPublished, true), ne(posts.id, p.id), lte(posts.publishedAt, new Date())))
      .orderBy(desc(posts.publishedAt))
      .limit(3);
    return {
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverUrl: p.coverUrl,
      body: p.body,
      author: p.author,
      publishedAt: p.publishedAt,
      more,
    };
  }),

  /* ───────────── Formularios ───────────── */

  subscribe: publicProcedure
    .input(z.object({ email: z.email("Enter a valid email address.").max(191), source: z.string().max(40).default("web") }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`sub:${ctx.ip}`, 6, 10 * 60_000)) throw fail("Too many attempts. Please wait a few minutes.", "TOO_MANY_REQUESTS");
      await db
        .insert(subscribers)
        .values({ email: input.email.toLowerCase(), source: input.source })
        .onDuplicateKeyUpdate({ set: { email: input.email.toLowerCase() } });
      const s = await getSettings();
      return { coupon: s.newsletter.coupon };
    }),

  inquiry: publicProcedure
    .input(
      z.object({
        kind: z.enum(["contact", "wholesale"]),
        name: z.string().trim().min(2, "Enter your name.").max(160),
        email: z.email("Enter a valid email address.").max(191),
        phone: z.string().trim().max(60).default(""),
        message: z.string().trim().max(5000).default(""),
        fields: z.record(z.string().max(60), z.string().max(1000)).default({}),
        /** Campo trampa: los bots lo llenan, las personas no lo ven. */
        website: z.string().max(200).default(""),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`inq:${ctx.ip}`, 5, 10 * 60_000)) throw fail("Too many messages. Please wait a few minutes.", "TOO_MANY_REQUESTS");
      if (input.website) return { ok: true };
      if (input.kind === "contact" && input.message.length < 5) throw fail("Write a short message so we know how to help.");
      const fields = Object.fromEntries(Object.entries(input.fields).slice(0, 20));
      await db.insert(inquiries).values({
        kind: input.kind,
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone,
        message: input.message,
        data: JSON.stringify(fields),
      });
      void sendInquiryNotice(input.kind, input.name, input.email, [
        ["Teléfono", input.phone],
        ...Object.entries(fields),
        ["Mensaje", input.message],
      ]);
      return { ok: true };
    }),
});
