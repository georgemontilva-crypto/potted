import { z } from "zod";

/* ───────────── Pedidos ───────────── */

export const ORDER_STATUSES = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente de pago",
  pagado: "Pago confirmado",
  preparando: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Etiquetas en inglés para el cliente (tienda y correos). */
export const ORDER_STATUS_LABEL_EN: Record<OrderStatus, string> = {
  pendiente: "Awaiting payment",
  pagado: "Payment confirmed",
  preparando: "Preparing",
  enviado: "Shipped",
  entregado: "Delivered",
  cancelado: "Cancelled",
};

/** Pasos que ve el cliente en el seguimiento (cancelado va aparte). */
export const ORDER_TRACK_STEPS: OrderStatus[] = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
];

/* ───────────── Producto ───────────── */

export const colorSchema = z.object({
  name: z.string().min(1).max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type ProductColor = z.infer<typeof colorSchema>;

/* ───────────── Bloques de las subpáginas ───────────── */

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("texto"),
    title: z.string().max(200).default(""),
    body: z.string().max(20000).default(""),
    align: z.enum(["izquierda", "centro"]).default("izquierda"),
  }),
  z.object({
    type: z.literal("imagen"),
    url: z.string().max(600).default(""),
    caption: z.string().max(300).default(""),
  }),
  z.object({
    type: z.literal("imagen_texto"),
    url: z.string().max(600).default(""),
    title: z.string().max(200).default(""),
    body: z.string().max(20000).default(""),
    imageSide: z.enum(["izquierda", "derecha"]).default("izquierda"),
  }),
  z.object({
    type: z.literal("preguntas"),
    title: z.string().max(200).default(""),
    items: z
      .array(z.object({ q: z.string().max(300), a: z.string().max(5000) }))
      .max(60)
      .default([]),
  }),
  z.object({
    type: z.literal("html"),
    title: z.string().max(200).default(""),
    /** HTML ya limpio (se sanea en el servidor al guardar). */
    html: z.string().max(400000).default(""),
  }),
  z.object({
    type: z.literal("boton"),
    title: z.string().max(200).default(""),
    body: z.string().max(2000).default(""),
    label: z.string().max(60).default(""),
    href: z.string().max(400).default(""),
  }),
]);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const BLOCK_LABEL: Record<BlockType, string> = {
  texto: "Texto",
  imagen: "Imagen",
  imagen_texto: "Imagen con texto",
  preguntas: "Preguntas frecuentes",
  html: "Contenido enriquecido (HTML)",
  boton: "Llamado con botón",
};

/* ───────────── Ajustes de la tienda ───────────── */

const faqItem = z.object({ q: z.string().max(300), a: z.string().max(5000) });
const effectTile = z.object({
  title: z.string().max(60),
  text: z.string().max(240),
  strain: z.string().max(40),
  imageUrl: z.string().max(600),
});

export const settingsSchema = z.object({
  storeName: z.string().min(1).max(60),
  tagline: z.string().max(160),
  logoUrl: z.string().max(600),
  logoDarkUrl: z.string().max(600),
  faviconUrl: z.string().max(600),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  announcement: z.string().max(200),
  announcementHref: z.string().max(400),

  currency: z.string().length(3),
  locale: z.string().min(2).max(10),

  email: z.string().max(160),
  supportEmail: z.string().max(160),
  phone: z.string().max(60),
  whatsapp: z.string().max(40),
  address: z.string().max(240),
  instagram: z.string().max(240),
  tiktok: z.string().max(240),
  facebook: z.string().max(240),

  notifyEmail: z.string().max(160),
  lowStock: z.number().int().min(0).max(999),

  /** Estados de EE. UU. a los que no se puede enviar (códigos de 2 letras). */
  blockedStates: z.array(z.string().length(2)).max(60),
  /** Aviso legal que sale en el pie de todas las páginas. */
  disclaimer: z.string().max(4000),
  ageGate: z.object({
    enabled: z.boolean(),
    minAge: z.number().int().min(18).max(25),
    title: z.string().max(120),
    text: z.string().max(400),
  }),
  newsletter: z.object({
    enabled: z.boolean(),
    title: z.string().max(120),
    text: z.string().max(400),
    /** Cupón que se muestra al suscribirse ("" = solo agradecimiento). */
    coupon: z.string().max(40),
  }),
  wholesaleIntro: z.string().max(1200),
  contactIntro: z.string().max(1200),

  home: z.object({
    heroTitle: z.string().max(80),
    heroSubtitle: z.string().max(240),
    heroImageUrl: z.string().max(600),
    heroProductId: z.number().int().nullable(),
    heroCtaLabel: z.string().max(40),
    heroCtaHref: z.string().max(400),
    showcaseProductId: z.number().int().nullable(),
    showcaseTitle: z.string().max(120),
    showcaseText: z.string().max(600),
    storyTitle: z.string().max(160),
    storyText: z.string().max(1200),
    storyImageUrl: z.string().max(600),
    effectsTitle: z.string().max(120),
    effects: z.array(effectTile).max(4),
    prerollTitle: z.string().max(120),
    prerollText: z.string().max(600),
    prerollImageUrl: z.string().max(600),
    prerollCategory: z.string().max(140),
    vibeTitle: z.string().max(120),
    vibeText: z.string().max(800),
    vibeImageUrl: z.string().max(600),
    faqTitle: z.string().max(120),
    faq: z.array(faqItem).max(20),
    perks: z
      .array(z.object({ title: z.string().max(60), text: z.string().max(200) }))
      .max(4),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_DISCLAIMER =
  "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure or prevent any disease. Must be 21 years or older to purchase from this website. This product is not intended for children, or pregnant or lactating women. Consult with a physician before use if you have a serious medical condition or use prescription medications. A Doctor’s advice should be sought before using this and any dietary supplement product. All trademarks and copyrights are property of their respective owners and are not affiliated with nor do they endorse this product. By using this site, you agree to follow the Privacy Policy and all Terms & Conditions printed on this site. Void Where Prohibited by Law. Products on this site contain less than 0.3% Δ9-THC. Our THCA products are not allowed to be shipped to the following states: HI, ID, MN, OR, RI, UT, VT.";

export const DEFAULT_FAQ = [
  {
    q: "How does the dab disposable work",
    a: "Click the button 5 times and wait for 40 seconds, it should display ‘ready’ on the device, then you can start smoking",
  },
  {
    q: "Will I receive the same product that I see in the picture?",
    a: "We strive to ensure that the products you receive closely match the images on our website. However, cannabis is a natural product, and slight variations in color, size, or texture may occur due to factors like strain, harvest, and curing. Rest assured, the quality and potency of every product are rigorously tested to meet our premium standards. What you see is what you’ll experience—top-tier cannabis every time.",
  },
  {
    q: "Where can I view my sales receipt?",
    a: "A copy of your receipt is emailed to you at the time of purchase, and you can view your order at any time from the link in that email or on the Track Order page using your order number and email. Can’t find it? Reach out to our support team, and we’ll be happy to assist!",
  },
  {
    q: "How can I return an item?",
    a: "Due to the nature of cannabis products, we’re unable to accept returns once the packaging has been opened. However, if you’ve received a damaged or incorrect item, please contact our support team within 30 days of delivery. We’ll work with you to resolve the issue through a replacement or store credit. Your satisfaction is our priority!",
  },
  {
    q: "Will you restock items indicated as “out of stock?”",
    a: "Yes, we aim to restock popular items as quickly as possible. However, restock times may vary depending on the strain or product availability. Stay tuned—your favorite products are worth the wait!",
  },
  {
    q: "Where can I ship my order?",
    a: "At checkout, you’ll be able to enter your address to confirm if delivery is available in your area. Please note that we comply with all local and state regulations regarding cannabis shipping. If you have questions about your location, feel free to reach out to our support team!",
  },
];

export const DEFAULT_SETTINGS: Settings = {
  storeName: "PotTed",
  tagline: "Premium Cannabis - Perfect Vibes",
  logoUrl: "/brand/logo-potted.webp",
  logoDarkUrl: "",
  faviconUrl: "/brand/logo-new-1.webp",
  accent: "#17203b",
  announcement:
    "We are only accepting PayPal payments at this time. For alternative payment methods, please send us a chat or email at usapotted@gmail.com",
  announcementHref: "",

  currency: "USD",
  locale: "en-US",

  email: "usapotted@gmail.com",
  supportEmail: "info@pottedusa.com",
  phone: "(863) 576-8833",
  whatsapp: "",
  address: "7901 4th St N, Suite 300, St. Petersburg, FL 33702",
  instagram: "",
  tiktok: "",
  facebook: "",

  notifyEmail: "",
  lowStock: 5,

  blockedStates: ["HI", "ID", "MN", "OR", "RI", "UT", "VT"],
  disclaimer: DEFAULT_DISCLAIMER,
  ageGate: {
    enabled: true,
    minAge: 21,
    title: "Are you over 21?",
    text: "You must be 21 years of age or older to view page. Please verify your age to enter.",
  },
  newsletter: {
    enabled: true,
    title: "Enjoy the vibe?",
    text: "Join our newsletter and share the love with your friends!",
    coupon: "",
  },
  wholesaleIntro:
    "If you are interested in getting our products at wholesale rates, please fill out the form below and we will be in contact.",
  contactIntro: "Questions about an order, a product or a lab result? Send us a message and we’ll get back to you.",

  home: {
    heroTitle: "Get PotTed.",
    heroSubtitle:
      "Premium Cannabis - Perfect Vibes. Explore Our Collection – Premium Flower, Concentrates, Pre-Rolls, and More.",
    heroImageUrl: "",
    heroProductId: null,
    heroCtaLabel: "Shop now",
    heroCtaHref: "/shop",
    showcaseProductId: null,
    showcaseTitle: "Featured Product",
    showcaseText: "",
    storyTitle: "Ready to get PotTed?",
    storyText:
      "At PotTed, we believe cannabis should be an experience, not just a product. That’s why we bring you only the finest, handpicked selections—from frosty flower to potent concentrates, pre-rolls, and beyond. Each item is crafted to deliver the smoothest, most consistent highs, so you can focus on what matters most: the VIBE.",
    storyImageUrl: "/brand/about-lounge.webp",
    effectsTitle: "Shop By Effects",
    effects: [
      { title: "Chill & Nap", text: "Indica picks for slow evenings and deep relaxation.", strain: "Indica", imageUrl: "/brand/chill-and-nap.webp" },
      { title: "Boost & Dance", text: "Sativa picks for the lift, the energy and the good times.", strain: "Sativa", imageUrl: "/brand/boost-and-dance.webp" },
      { title: "Relax & Meditate", text: "Hybrid picks for that sweet spot in between.", strain: "Hybrid", imageUrl: "/brand/relax-and-meditate.webp" },
    ],
    prerollTitle: "Roll'd Up & Ready",
    prerollText:
      "Our pre-rolls deliver the perfect smoke every time. Rolled to perfection with our premium flower, these pre-rolls are packed with rich flavor, smooth hits, and potent effects.",
    prerollImageUrl: "/brand/pre-rolls.webp",
    prerollCategory: "pre-rolls",
    vibeTitle: "What's Your Vibe?",
    vibeText:
      "Indica for the chill, Sativa for the lift, or Hybrid for that sweet spot in between—whatever your vibe, we've got the strain to make it happen. Whether you’re unwinding or turning up, we’re here to help you find the perfect cannabis experience at PotTed.",
    vibeImageUrl: "/brand/vibe.webp",
    faqTitle: "Frequently Asked Questions",
    faq: DEFAULT_FAQ,
    perks: [
      { title: "Lab tested", text: "Every batch ships with a third-party Certificate of Analysis." },
      { title: "Fast USPS shipping", text: "Orders ship with USPS and arrive in 3 to 5 business days." },
      { title: "Secure checkout", text: "Pay safely with PayPal. Zelle available on request." },
    ],
  },
};

/** Tipos de cepa / efecto que se usan como filtro en la tienda. */
export const STRAIN_SUGGESTIONS = ["Indica", "Sativa", "Hybrid", "Relaxing", "Uplifting", "Harmony"];

export const US_STATES: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"],
  ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

/* ───────────── Dinero ───────────── */

/** Los precios se guardan en centavos (enteros). */
export function formatMoney(cents: number, currency = "USD", locale = "en-US") {
  const noDecimals = ["COP", "CLP", "PYG", "JPY", "VES"].includes(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: noDecimals ? 0 : cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Rutas que usa la tienda y no pueden ser el slug de una subpágina. */
export const RESERVED_SLUGS = [
  "shop",
  "product",
  "product-category",
  "effects",
  "cart",
  "order",
  "track",
  "lab-results",
  "blog",
  "wholesale",
  "contact-us",
  "wishlist",
  "compare",
  "brand",
  "seed",
  "wp-content",
  "admin",
  "api",
  "tienda",
  "producto",
  "categoria",
  "carrito",
  "checkout",
  "pedido",
  "seguimiento",
  "media",
  "demo",
  "assets",
];
