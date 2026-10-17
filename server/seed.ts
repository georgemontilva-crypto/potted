import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_DISCLAIMER, DEFAULT_FAQ, DEFAULT_SETTINGS, type Block } from "../shared/types";
import { db, schema } from "./db";
import { env } from "./env";
import { saveSettings } from "./settings";
import { SEED_LAB_REPORTS, SEED_PRODUCTS } from "./seedData";

const CATEGORIES = [
  {
    name: "5 Gram Live Rosin",
    slug: "5-gram-live-rosin",
    description: "Solventless live rosin dabs in a 5 gram format. Smooth, flavorful and full of character.",
  },
  {
    name: "3 Gram Crumble",
    slug: "3-gram-crumble",
    description: "Frosted crumble concentrates in a 3 gram format, inspired by the classics.",
  },
  {
    name: "Pre-Rolls",
    slug: "pre-rolls",
    description: "FLOW Blue Lotus 2g pre-rolls. Rolled to perfection and ready when you are.",
  },
];

const text = (title: string, body: string, align: "izquierda" | "centro" = "izquierda"): Block => ({
  type: "texto",
  title,
  body,
  align,
});

/**
 * Las páginas con este marcador las reemplaza el importador con el texto
 * original del sitio viejo. Al editarlas en el panel, el marcador desaparece
 * y el importador ya no las toca.
 */
const marked = (blocks: Block[]) => JSON.stringify(blocks.map((b, i) => (i === 0 ? { ...b, pendiente_importar: true } : b)));

const PAGES: { title: string; slug: string; intro: string; nav: boolean; published: boolean; blocks: string }[] = [
  {
    title: "About Us",
    slug: "about-us",
    intro: "A love letter to cannabis and the community that cherishes it.",
    nav: true,
    published: true,
    blocks: marked([
      {
        type: "imagen_texto",
        url: "/brand/about-lounge.webp",
        title: "It started with a single toke.",
        body: "The name PotTed is a playful nod to the word “pothead”, and the story behind it goes back to 2013, when a friend passed our founder a joint for the first time. Good weed was hard to find and expensive where we lived, so we started importing seeds and growing our own in the backyard.",
        imageSide: "izquierda",
      },
      text(
        "The vision",
        "Top-quality cannabis — flower, concentrates, pre-rolls and more — should be accessible to everyone, without the premium price tag. In 2023 we founded PotTed with a team of growers, innovators and cannabis enthusiasts to make that happen.",
      ),
      text(
        "The mission",
        "Lab-tested, high-quality cannabis in every form, at fair prices, with community, quality and transparency at the center of everything we do. Pull up a chair — you’re part of the PotTed family now.",
      ),
    ]),
  },
  {
    title: "FAQs",
    slug: "faqs",
    intro: "Everything you need to know about ordering from PotTed.",
    nav: true,
    published: true,
    blocks: JSON.stringify([
      {
        type: "preguntas",
        title: "",
        items: [
          ...DEFAULT_FAQ,
          {
            q: "I didn’t get my order confirmation email",
            a: "Check your spam or junk folder and make sure the email you used at checkout is correct — it can take a few minutes to arrive. Still nothing? Contact us at usapotted@gmail.com with your full name and order details and we’ll sort it out.",
          },
        ],
      },
      {
        type: "boton",
        title: "Still have questions?",
        body: "Our team is happy to help with orders, products and lab results.",
        label: "Contact us",
        href: "/contact-us",
      },
    ] satisfies Block[]),
  },
  {
    title: "FDA and Hemp Disclaimer",
    slug: "fda-and-hemp",
    intro: "",
    nav: false,
    published: true,
    blocks: marked([text("", DEFAULT_DISCLAIMER)]),
  },
  ...["Privacy Policy|privacy-policy", "Shipping Policy|shipping-policy", "Refund Policy|refund-policy", "Terms of Service|terms-of-service"].map(
    (x) => {
      const [title, slug] = x.split("|") as [string, string];
      return {
        title,
        slug,
        intro: "",
        nav: false,
        published: false,
        blocks: marked([
          text(
            "",
            "Esta página se llena con el texto original al usar Panel → Importar. También puedes escribirla aquí y publicarla.",
          ),
        ]),
      };
    },
  ),
];

export async function ensureAdmin() {
  const [count] = await db.select({ n: sql<number>`cast(count(*) as signed)` }).from(schema.users);
  if (Number(count?.n ?? 0) > 0) return;
  if (!env.adminEmail || !env.adminPassword) {
    console.warn("⚠ No hay usuarios y faltan ADMIN_EMAIL / ADMIN_PASSWORD: no podrás entrar al panel.");
    return;
  }
  await db.insert(schema.users).values({
    email: env.adminEmail,
    name: "Administrador",
    passwordHash: await bcrypt.hash(env.adminPassword, 11),
  });
  console.log(`✓ Usuario administrador creado: ${env.adminEmail}`);
}

export async function seed() {
  await ensureAdmin();

  const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, "seeded")).limit(1);
  if (done) return;

  await saveSettings(DEFAULT_SETTINGS);

  await db.insert(schema.shippingMethods).values([
    {
      name: "USPS Shipping",
      description: "Tracked delivery anywhere we can ship",
      eta: "3 to 5 business days",
      price: 0,
      freeOver: null,
      sortOrder: 1,
    },
  ]);

  await db.insert(schema.paymentMethods).values([
    {
      name: "PayPal",
      description: "Pay with your PayPal balance, bank or card",
      instructions: "",
      provider: "paypal",
      requiresProof: false,
      sortOrder: 1,
    },
    {
      name: "Zelle",
      description: "Send the total with Zelle and upload your receipt",
      instructions:
        "Send the order total with Zelle to: (add your Zelle email or phone in the panel)\nInclude your order number in the memo.\n\nQuestions? Email usapotted@gmail.com",
      provider: "manual",
      requiresProof: true,
      isActive: false,
      sortOrder: 2,
    },
  ]);

  for (const [i, p] of PAGES.entries()) {
    await db.insert(schema.pages).values({
      title: p.title,
      slug: p.slug,
      intro: p.intro,
      blocks: p.blocks,
      showInNav: p.nav,
      showInFooter: true,
      isPublished: p.published,
      sortOrder: i + 1,
    });
  }

  const catIds = new Map<string, number>();
  for (const [i, c] of CATEGORIES.entries()) {
    const [ins] = await db
      .insert(schema.categories)
      .values({ name: c.name, slug: c.slug, description: c.description, sortOrder: i + 1 });
    catIds.set(c.slug, ins.insertId);
  }

  const productIds = new Map<string, number>();
  if (env.seedDemo) {
    let featuredOrder = 0;
    for (const p of SEED_PRODUCTS) {
      const [ins] = await db.insert(schema.products).values({
        name: p.name,
        slug: p.slug,
        tagline: p.tagline,
        strain: p.strain,
        weight: p.weight,
        potency: p.potency,
        description: p.description,
        details: p.details,
        price: p.price,
        categoryId: catIds.get(p.category) ?? null,
        colors: "[]",
        sizes: "[]",
        isFeatured: p.featured,
        featuredOrder: p.featured ? ++featuredOrder : 0,
        isNew: p.isNew,
      });
      const productId = ins.insertId;
      productIds.set(p.slug, productId);
      if (p.images.length) {
        await db
          .insert(schema.productImages)
          .values(p.images.map((url, i) => ({ productId, url, color: "", sortOrder: i })));
      }
      await db.insert(schema.productVariants).values({ productId, stock: 100, sku: p.slug.toUpperCase() });
    }
    console.log(`✓ Catálogo creado: ${SEED_PRODUCTS.length} productos.`);
  }

  await db.insert(schema.labReports).values(
    SEED_LAB_REPORTS.map((r) => ({
      title: r.title,
      section: r.section,
      fileUrl: r.url,
      productId: r.product ? (productIds.get(r.product) ?? null) : null,
      sortOrder: r.sort,
    })),
  );
  console.log(`✓ Lab results: ${SEED_LAB_REPORTS.length} reportes.`);

  await db.insert(schema.settings).values({ key: "seeded", value: new Date().toISOString() });
}
