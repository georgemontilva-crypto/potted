import { and, eq, isNull, like } from "drizzle-orm";
import { db, schema } from "./db";
import { env } from "./env";

/**
 * Productos que se agregan después del primer arranque. Cada lote corre una
 * sola vez (queda anotado en settings) y nunca pisa lo que ya existe: si un
 * producto con ese slug ya está, no se toca, así que lo que edites en el
 * panel se respeta.
 */

type NewProduct = {
  slug: string;
  name: string;
  category: string;
  strain: string;
  weight: string;
  potency?: string;
  tagline: string;
  description: string;
  details: string;
  price: number;
  image: string;
  isActive: boolean;
  /** Parte del nombre del PDF de laboratorio que le corresponde. */
  labFile?: string;
  /** Si el PDF ya se copió y perdió su nombre: título del reporte. */
  labTitle?: string;
};

type Batch = {
  id: string;
  categories: { name: string; slug: string; description: string }[];
  products: NewProduct[];
};

const hashHoles = (name: string, slugBase: string, strain: string, labFile?: string): NewProduct => ({
  slug: `${slugBase}-hash-holes`,
  name: `${name} Hash Holes`,
  category: "hash-holes",
  strain,
  weight: "2 × 2g",
  tagline: `Two ${name} hash hole pre-rolls with a live rosin core.`,
  description: `Potted Hash Holes ${name} comes as a 2-pack of 2g pre-rolls, 4 grams total. Each pre-roll is packed with 1.5g of premium indoor THCA flower and a 0.5g core of live rosin running right through the center, rolled in a RAW cone.\n\nSlow, even burn and a rich ${strain.toLowerCase()} experience from the first pull to the last.`,
  details: `Format: 2 pre-rolls × 2g (4g total)\nEach pre-roll: 1.5g THCA flower + 0.5g live rosin\nEffect: ${strain}\nCone: RAW\nThird-party lab tested — see Lab Results`,
  price: 1999,
  image: `/products/${slugBase}-hash-holes.webp`,
  isActive: true,
  labFile,
  labTitle: name.replace(" F*ck", ""),
});

const meltz = (flavor: string, slugBase: string, strain: string, blend: string, labFile: string): NewProduct => ({
  slug: `meltz-${slugBase}`,
  name: `Meltz ${flavor} Gummies`,
  category: "meltz-gummies",
  strain,
  weight: "2 ct bag",
  potency: blend,
  tagline: `${flavor} gummies, 1500mg per cube. Potent AF.`,
  description: `Meltz ${flavor} gummies by Potted. Each bag holds 2 gummies at 1500mg per cube, 3000mg per bag, with a ${blend} blend.\n\nRide the universe 'till the black hole. Start low and go slow.`,
  details: `Format: 2 gummies per bag\nStrength: 1500mg per cube, 3000mg per bag\nBlend: ${blend}\nEffect: ${strain}\nDisplay box: 25 bags (75,000mg)\nThird-party lab tested — see Lab Results`,
  price: 2999,
  image: `/products/meltz-${slugBase}.webp`,
  // Oculto hasta confirmar el precio y la presentación que se vende.
  isActive: false,
  labFile,
  labTitle: flavor,
});

const BATCHES: Batch[] = [
  {
    id: "2026-10-hash-holes-meltz",
    categories: [
      {
        name: "Hash Holes",
        slug: "hash-holes",
        description: "2g THCA pre-rolls with a live rosin core running through the center. Sold in 2-packs.",
      },
      {
        name: "Meltz Gummies",
        slug: "meltz-gummies",
        description: "Potent AF gummies in big fruit flavors. 1500mg per cube.",
      },
    ],
    products: [
      hashHoles("Pink Zaza", "pink-zaza", "Sativa"),
      hashHoles("Alaskan Thunder F*ck", "alaskan-thunder", "Sativa", "hh-1-5g-alaskan-thunder"),
      hashHoles("Jelly Rancherz", "jelly-rancherz", "Sativa", "hh-1-5g-jelly-rancherz"),
      hashHoles("Plan Z", "plan-z", "Hybrid", "hh-1-5g-plan-z"),
      hashHoles("Sherb Pie", "sherb-pie", "Hybrid", "hh-1-5g-sherb-pie"),
      hashHoles("Bubble Bath", "bubble-bath", "Indica", "hh-1-5g-bubble-bath"),
      hashHoles("White Truffle", "white-truffle", "Indica", "hh-1-5g-white-truffle"),
      hashHoles("Forbidden Fruit", "forbidden-fruit", "Indica", "hh-1-5g-forbidden-fruit"),
      meltz("Fruit Punch", "fruit-punch", "Hybrid", "D8-THC + D9 + THC-P + CBN + HHC", "5g-g-fruit-punch"),
      meltz("Pineapple", "pineapple", "Indica", "D9 + THC-P + CBN + THC-H", "5g-g-pineapple"),
      meltz("Blue Raspberry", "blue-raspberry", "Indica", "D9 + THC-P + CBN + THC-H", "5g-g-blue-raspberry"),
      meltz("Watermelon", "watermelon", "Sativa", "THC-B + D8 + D9 + THC-P", "5g-g-watermelon"),
      meltz("Grape", "grape", "Sativa", "THC-B + D8 + D9 + THC-P", "5g-g-grape"),
      meltz("Sour Apple", "sour-apple", "Hybrid", "D8-THC + D9 + THC-P + CBN + HHC", "5g-g-sour-apple"),
    ],
  },
];

const KEY = "catalog_updates";

export async function applyCatalogUpdates() {
  if (!env.seedDemo) return;
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY)).limit(1);
  let done: string[] = [];
  try {
    done = row ? (JSON.parse(row.value) as string[]) : [];
  } catch {
    done = [];
  }

  for (const batch of BATCHES) {
    if (done.includes(batch.id)) continue;
    const catIds = new Map<string, number>();
    const allCats = await db.select().from(schema.categories);
    let order = Math.max(0, ...allCats.map((c) => c.sortOrder));
    for (const c of batch.categories) {
      const found = allCats.find((x) => x.slug === c.slug);
      if (found) {
        catIds.set(c.slug, found.id);
        continue;
      }
      const [ins] = await db.insert(schema.categories).values({ ...c, sortOrder: ++order });
      catIds.set(c.slug, ins.insertId);
    }

    let created = 0;
    for (const p of batch.products) {
      const [exists] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.slug, p.slug)).limit(1);
      if (exists) continue;
      const [ins] = await db.insert(schema.products).values({
        name: p.name,
        slug: p.slug,
        tagline: p.tagline,
        strain: p.strain,
        weight: p.weight,
        potency: p.potency ?? "",
        description: p.description,
        details: p.details,
        price: p.price,
        categoryId: catIds.get(p.category) ?? null,
        colors: "[]",
        sizes: "[]",
        isActive: p.isActive,
        isNew: true,
      });
      const productId = ins.insertId;
      await db.insert(schema.productImages).values({ productId, url: p.image, color: "", sortOrder: 0 });
      await db.insert(schema.productVariants).values({ productId, stock: 100, sku: p.slug.toUpperCase() });
      if (p.labFile) {
        const [r] = await db
          .update(schema.labReports)
          .set({ productId })
          .where(and(like(schema.labReports.fileUrl, `%${p.labFile}%`), isNull(schema.labReports.productId)));
        if (r.affectedRows === 0 && p.labTitle) {
          const section = p.category === "meltz-gummies" ? "Gummies" : "Pre-rolls";
          await db
            .update(schema.labReports)
            .set({ productId })
            .where(
              and(
                eq(schema.labReports.title, p.labTitle),
                eq(schema.labReports.section, section),
                isNull(schema.labReports.productId),
              ),
            );
        }
      }
      created++;
    }

    done.push(batch.id);
    const value = JSON.stringify(done);
    await db.insert(schema.settings).values({ key: KEY, value }).onDuplicateKeyUpdate({ set: { value } });
    console.log(`✓ Catálogo actualizado (${batch.id}): ${created} productos nuevos.`);
  }
}
