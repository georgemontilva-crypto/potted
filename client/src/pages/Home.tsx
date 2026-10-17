import { useMemo, useRef } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, FlaskConical, ShieldCheck, Truck } from "lucide-react";
import { trpc, type Out } from "@/lib/trpc";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { ProductCard } from "@/components/ProductCard";
import { Loading, SButton, SLink, StrainTag, strainColor } from "@/components/store";
import { cx } from "@/components/ui";

type HomeData = Out["store"]["home"];
const EASE = [0.22, 1, 0.36, 1] as const;

/* ───────────── Portada: la tapa de revista ───────────── */

function Hero({ data }: { data: HomeData }) {
  const shop = useShop()!;
  const h = shop.settings.home;
  const reduce = useReducedMotion();

  // Tres productos de categorías distintas para el collage.
  const picks = useMemo(() => {
    const pool = [...data.featured, ...data.latest].filter((p) => p.images.length);
    const out: typeof pool = [];
    for (const p of pool) {
      if (out.length === 3) break;
      if (!out.some((o) => o.categoryId === p.categoryId || o.id === p.id)) out.push(p);
    }
    for (const p of pool) {
      if (out.length === 3) break;
      if (!out.some((o) => o.id === p.id)) out.push(p);
    }
    return out;
  }, [data]);

  const words = h.heroTitle.split(" ");
  const layout = [
    "left-[2%] top-[30%] w-[50%] -rotate-[8deg] z-20",
    "right-[0%] top-[8%] w-[50%] rotate-[7deg] z-10",
    "left-[34%] top-[46%] w-[34%] rotate-[14deg] z-30",
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="wrap grid items-center gap-x-10 pb-16 pt-10 lg:min-h-[calc(100dvh-112px)] lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-6">
        <div className="relative z-10">
          <h1 className="serif-xl text-[clamp(4.6rem,13vw,11.5rem)]">
            {words.map((w, i) => (
              <motion.span
                key={i}
                className="mr-[0.18em] inline-block last:mr-0"
                initial={reduce ? false : { opacity: 0, y: "0.35em" }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: 0.08 + i * 0.12 }}
              >
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.45 }}
          >
            <p className="mt-7 max-w-[34ch] text-[clamp(1.1rem,1.6vw,1.35rem)] leading-snug text-navy-2">{h.heroSubtitle}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <SLink href={h.heroCtaHref || "/shop"} size="lg">
                {h.heroCtaLabel || "Shop now"}
              </SLink>
              <SLink href="/lab-results" size="lg" tone="outline">
                See lab results
              </SLink>
            </div>
            <ul className="mt-10 flex flex-wrap gap-2">
              {shop.categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/shop/${c.slug}`}
                    className="inline-flex h-9 items-center rounded-full bg-paper-2 px-4 text-[14px] font-medium transition-colors hover:bg-paper-3"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <div className="relative mx-auto mt-12 aspect-square w-full max-w-[640px] lg:mt-0" aria-hidden={!h.heroImageUrl}>
          <motion.div
            className="absolute inset-[7%] rounded-full bg-sun"
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: EASE }}
          />
          <div className="absolute inset-[7%] overflow-hidden rounded-full" aria-hidden>
            <div className="absolute inset-x-0 bottom-[18%] h-[3px] bg-navy/10" />
            <div className="absolute inset-x-0 bottom-[26%] h-[3px] bg-navy/10" />
            <div className="absolute inset-x-0 bottom-[34%] h-[3px] bg-navy/10" />
          </div>
          {h.heroImageUrl ? (
            <motion.img
              src={h.heroImageUrl}
              alt=""
              className="absolute inset-0 size-full object-contain drop-shadow-[0_30px_40px_rgba(23,32,59,0.25)]"
              initial={reduce ? false : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
            />
          ) : (
            picks.map((p, i) => (
              <motion.div
                key={p.id}
                className={cx("absolute", layout[i])}
                initial={reduce ? false : { opacity: 0, y: 90, rotate: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: EASE, delay: 0.25 + i * 0.14 }}
              >
                <Link href={`/product/${p.slug}`} tabIndex={-1}>
                  <img
                    src={imageFor(p.images)}
                    alt={p.name}
                    className="w-full drop-shadow-[0_28px_30px_rgba(23,32,59,0.28)] transition-transform duration-500 hover:-translate-y-2"
                  />
                </Link>
              </motion.div>
            ))
          )}
          <motion.img
            src="/brand/boost-and-dance.webp"
            alt=""
            className="absolute -bottom-[4%] -right-[2%] z-40 hidden w-[24%] sm:block"
            initial={reduce ? false : { opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, ease: EASE, delay: 0.75 }}
          />
        </div>
      </div>
    </section>
  );
}

/* ───────────── Encabezado de sección ───────────── */

function SectionHead({ title, text, href, cta }: { title: string; text?: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <div>
        <h2 className="serif text-[clamp(2.4rem,5.4vw,4.2rem)]">{title}</h2>
        {text && <p className="mt-3 max-w-[48ch] text-[18px] text-navy-2">{text}</p>}
      </div>
      {href && (
        <SLink href={href} tone="outline">
          {cta ?? "Shop all"}
        </SLink>
      )}
    </div>
  );
}

/* ───────────── Fila con desplazamiento lateral ───────────── */

function Rail({ items }: { items: HomeData["featured"] }) {
  const ref = useRef<HTMLUListElement>(null);
  const move = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <ul
        ref={ref}
        className="no-scrollbar -mx-[clamp(16px,4vw,44px)] flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-[clamp(16px,4vw,44px)] px-[clamp(16px,4vw,44px)] pb-2"
      >
        {items.map((p) => (
          <li key={p.id} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[calc((100%-60px)/4)]">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
      {items.length > 4 && (
        <div className="mt-6 hidden justify-end gap-2 lg:flex">
          <button type="button" aria-label="Previous" onClick={() => move(-1)} className="grid size-11 place-items-center rounded-full bg-paper-2 hover:bg-paper-3">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next" onClick={() => move(1)} className="grid size-11 place-items-center rounded-full bg-paper-2 hover:bg-paper-3">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────────── Producto destacado ───────────── */

function Showcase({ product }: { product: NonNullable<HomeData["showcase"]> }) {
  const shop = useShop()!;
  const h = shop.settings.home;
  const money = useMoney();
  const variant = product.variants.find((v) => v.stock > 0);
  const img = imageFor(product.images);
  return (
    <section className="wrap mt-28 sm:mt-36">
      <div className="grid items-center gap-10 overflow-hidden rounded-[40px] bg-paper-2 p-6 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-16">
        <Link href={`/product/${product.slug}`} className="relative mx-auto block aspect-square w-full max-w-[520px]">
          <span className="absolute inset-[8%] rounded-full" style={{ background: strainColor(product.strain), opacity: 0.14 }} aria-hidden />
          {img && <img src={img} alt={product.name} className="relative size-full object-contain p-[6%] drop-shadow-[0_30px_34px_rgba(23,32,59,0.25)]" />}
        </Link>
        <div>
          <p className="text-[15px] font-semibold text-sky-ink">{h.showcaseTitle || "Featured product"}</p>
          <h2 className="serif mt-3 text-[clamp(2.6rem,6vw,4.8rem)]">{product.name}</h2>
          <div className="mt-4 flex items-center gap-3">
            <StrainTag strain={product.strain} className="text-[15px]" />
            {product.weight && <span className="text-[15px] text-navy-2">{product.weight}</span>}
          </div>
          <p className="mt-6 max-w-[52ch] text-[18px] leading-relaxed text-navy-2">
            {h.showcaseText || product.tagline || product.description.split("\n")[0]}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="serif text-[34px] tabular-nums">{money(product.price)}</span>
            {variant && (
              <SButton size="lg" onClick={() => cart.add(variant.id)}>
                Add to cart
              </SButton>
            )}
            <SLink href={`/product/${product.slug}`} size="lg" tone="quiet">
              View details
            </SLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Inicio ───────────── */

export default function Home() {
  const shop = useShop()!;
  const h = shop.settings.home;
  const q = trpc.store.home.useQuery();
  if (q.isLoading || !q.data) return <Loading />;
  const data = q.data;
  const best = data.featured.length ? data.featured : data.latest;
  const perkIcons = [FlaskConical, Truck, ShieldCheck];

  return (
    <>
      <Hero data={data} />

      {best.length > 0 && (
        <section className="wrap mt-10 sm:mt-16">
          <SectionHead title={`${shop.settings.storeName}'s Best Sellers`} text="Discover our fan favorites!" href="/shop" />
          <div className="mt-10">
            <Rail items={best} />
          </div>
        </section>
      )}

      {/* La historia */}
      <section className="wrap mt-28 grid items-center gap-10 sm:mt-36 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="relative">
          <div className="aspect-square overflow-hidden rounded-[40px] bg-[#cfe3e8]">
            {h.storyImageUrl && <img src={h.storyImageUrl} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
          <img
            src="/brand/leaf.webp"
            alt=""
            aria-hidden
            className="absolute -right-6 -top-10 hidden w-28 rotate-[24deg] drop-shadow-md lg:block"
          />
        </div>
        <div>
          <h2 className="serif text-[clamp(2.6rem,6vw,4.6rem)]">{h.storyTitle}</h2>
          <p className="mt-7 max-w-[52ch] font-[family-name:var(--font-serif)] text-[clamp(1.2rem,1.9vw,1.5rem)] leading-[1.5] text-navy-2 [font-variation-settings:'SOFT'_100,'opsz'_24]">
            {h.storyText}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <SLink href="/shop" size="lg">
              Shop now
            </SLink>
            {shop.pages.some((p) => p.slug === "about-us") && (
              <SLink href="/about-us" size="lg" tone="quiet">
                Our story
              </SLink>
            )}
          </div>
        </div>
      </section>

      {/* Por efecto */}
      {h.effects.length > 0 && (
        <section className="wrap mt-28 sm:mt-36">
          <SectionHead title={h.effectsTitle} text="Pick the mood first. We’ll match the strain." />
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {h.effects.map((e) => (
              <li key={e.title}>
                <Link
                  href={`/shop?strain=${encodeURIComponent(e.strain)}`}
                  className="group relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-[32px] p-7 transition-transform duration-300 hover:-translate-y-1"
                  style={{ background: `color-mix(in srgb, ${strainColor(e.strain)} 16%, var(--color-paper))` }}
                >
                  <div className="relative z-10">
                    <StrainTag strain={e.strain} className="text-[14px]" />
                    <h3 className="serif mt-2 text-[clamp(2rem,3.2vw,2.6rem)]">{e.title}</h3>
                    <p className="mt-2 max-w-[26ch] text-[16px] text-navy-2">{e.text}</p>
                  </div>
                  {e.imageUrl && (
                    <img
                      src={e.imageUrl}
                      alt=""
                      loading="lazy"
                      className="pointer-events-none mt-auto ml-auto h-[260px] w-auto origin-bottom-right object-contain transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.showcase && <Showcase product={data.showcase} />}

      {/* Pre-rolls */}
      {data.prerolls.length > 0 && (
        <section className="wrap mt-28 sm:mt-36">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="serif text-[clamp(2.6rem,6vw,4.6rem)]">{h.prerollTitle}</h2>
              <p className="mt-5 max-w-[46ch] text-[18px] text-navy-2">{h.prerollText}</p>
              <div className="mt-8">
                <SLink href={`/shop/${h.prerollCategory}`} tone="outline">
                  Shop pre-rolls
                </SLink>
              </div>
            </div>
            {h.prerollImageUrl && (
              <img src={h.prerollImageUrl} alt="" loading="lazy" className="w-full rounded-[32px] object-cover" />
            )}
          </div>
          <div className="mt-12">
            <Rail items={data.prerolls} />
          </div>
        </section>
      )}

      {/* ¿Cuál es tu vibra? */}
      <section className="wrap mt-28 sm:mt-36">
        <div className="relative overflow-hidden rounded-[40px] bg-navy text-paper">
          {h.vibeImageUrl && (
            <picture>
              <source media="(max-width: 767px)" srcSet="/brand/vibe-mobile.webp" />
              <img src={h.vibeImageUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover object-[70%_center] opacity-90" />
            </picture>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/80 to-transparent md:via-navy/55" aria-hidden />
          <div className="relative max-w-[560px] px-7 py-16 sm:px-12 sm:py-24">
            <h2 className="serif text-[clamp(2.6rem,6vw,4.6rem)]">{h.vibeTitle}</h2>
            <p className="mt-5 text-[18px] leading-relaxed text-paper/80">{h.vibeText}</p>
            <div className="mt-8 flex flex-wrap gap-2">
              {shop.strains.slice(0, 6).map((s) => (
                <Link
                  key={s}
                  href={`/shop?strain=${encodeURIComponent(s)}`}
                  className="inline-flex h-11 items-center rounded-full bg-paper px-5 text-[15px] font-semibold text-navy transition-colors hover:bg-sun"
                >
                  {s}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Garantías */}
      {h.perks.length > 0 && (
        <section className="wrap mt-24 grid gap-10 sm:mt-28 md:grid-cols-[auto_1fr] md:items-center md:gap-16">
          <img src="/brand/delivery.webp" alt="" loading="lazy" className="mx-auto w-[220px] rounded-[28px] md:w-[260px]" />
          <ul className="grid gap-8 sm:grid-cols-3">
            {h.perks.map((p, i) => {
              const Icon = perkIcons[i] ?? ShieldCheck;
              return (
                <li key={p.title}>
                  <Icon className="size-7 text-sky-ink" strokeWidth={1.7} aria-hidden />
                  <h3 className="serif mt-4 text-[24px]">{p.title}</h3>
                  <p className="mt-2 text-[16px] text-navy-2">{p.text}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Preguntas */}
      {h.faq.length > 0 && (
        <section className="wrap mt-28 grid gap-10 sm:mt-36 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <div>
            <h2 className="serif text-[clamp(2.4rem,5vw,4rem)]">{h.faqTitle}</h2>
            <p className="mt-4 max-w-[34ch] text-[18px] text-navy-2">
              Can’t find your answer?{" "}
              <Link href="/contact-us" className="font-semibold text-sky-ink underline underline-offset-4">
                Send us a message
              </Link>
              .
            </p>
          </div>
          <div className="border-b border-paper-3">
            {h.faq.map((item, i) => (
              <details key={i} className="group border-t border-paper-3">
                <summary className="flex list-none items-center justify-between gap-6 py-6 text-[19px] font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-5 shrink-0 text-navy-2 transition-transform duration-300 group-open:rotate-180" aria-hidden />
                </summary>
                <p className="max-w-[64ch] pb-7 text-[17px] leading-relaxed text-navy-2">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
