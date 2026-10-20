import { useMemo, useRef, type ReactNode } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { trpc, type Out } from "@/lib/trpc";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { ProductCard } from "@/components/ProductCard";
import { HeroVibes } from "@/components/HeroVibes";
import { Loading, SButton, SLink, StrainTag, strainColor } from "@/components/store";
import { cx } from "@/components/ui";

type HomeData = Out["store"]["home"];
const EASE = [0.22, 1, 0.36, 1] as const;

/** Colores neón de los empaques, uno por línea de producto. */
const LINE_COLORS = ["#ff4fd8", "#2de2ff", "#ffd23f", "#b6ff3b", "#b894ff", "#ff8a3d"];

/* ───────────── Aparece al hacer scroll ───────────── */

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.75, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ───────────── Portada con foto propia (si se sube una en el panel) ───────────── */

function Hero({ data }: { data: HomeData }) {
  const shop = useShop()!;
  const h = shop.settings.home;
  const reduce = useReducedMotion();

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

  const layout = [
    "left-[2%] top-[30%] w-[50%] -rotate-[8deg] z-20",
    "right-[0%] top-[8%] w-[50%] rotate-[7deg] z-10",
    "left-[34%] top-[46%] w-[34%] rotate-[14deg] z-30",
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-[-20%] bottom-0 h-[34%] overflow-hidden" aria-hidden>
        <div className="grid-floor absolute inset-x-0 top-0 h-[260%] opacity-70" />
      </div>
      <div className="wrap relative grid grid-cols-[minmax(0,1fr)] items-center gap-x-10 pb-16 pt-10 lg:min-h-[calc(100dvh-112px)] lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-6">
        <div className="relative z-10">
          <h1 className="serif-xl chrome pb-[0.06em] text-[clamp(4.6rem,13.5vw,11.5rem)] uppercase">
            {h.heroTitle.split(" ").map((w, i) => (
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
          <p className="mt-7 max-w-[36ch] text-[clamp(1.1rem,1.6vw,1.35rem)] leading-snug text-navy-2">{h.heroSubtitle}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <SLink href={h.heroCtaHref || "/shop"} size="lg">
              {h.heroCtaLabel || "Shop now"}
            </SLink>
            <SLink href="/lab-results" size="lg" tone="outline">
              See lab results
            </SLink>
          </div>
        </div>

        <div className="relative mx-auto mt-12 aspect-square w-full max-w-[640px] lg:mt-0">
          <div
            className="absolute inset-[7%] rounded-full"
            style={{ background: "linear-gradient(180deg,#ffd23f 8%,#ff4fd8 78%)", boxShadow: "0 0 120px -20px #ff4fd8" }}
            aria-hidden
          />
          {h.heroImageUrl ? (
            <img src={h.heroImageUrl} alt="" className="absolute inset-0 size-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,0.55)]" />
          ) : (
            picks.map((p, i) => (
              <Link key={p.id} href={`/product/${p.slug}`} tabIndex={-1} className={cx("absolute", layout[i])}>
                <img src={imageFor(p.images)} alt={p.name} className="w-full drop-shadow-[0_28px_30px_rgba(0,0,0,0.55)]" />
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────────── Franja que corre ───────────── */

function Marquee() {
  const items = ["Lab tested", "21+ only", "Ships USPS", "Live rosin", "Indoor THCA", "Diamonds infused", "Premium flower"];
  const row = (
    <div className="flex shrink-0 items-center gap-8 pr-8">
      {items.map((t) => (
        <span key={t} className="flex items-center gap-8 whitespace-nowrap">
          <span className="serif text-[clamp(1.4rem,3vw,2.2rem)] uppercase">{t}</span>
          <Sparkles className="size-5 text-pink" aria-hidden />
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative -rotate-[1.2deg] border-y border-pink/40 bg-[linear-gradient(90deg,rgba(255,79,216,0.14),rgba(45,226,255,0.14))] py-4 shadow-[0_0_40px_-12px_rgba(255,79,216,0.6)]" aria-hidden>
      <div className="flex w-max animate-[marquee_28s_linear_infinite]">
        {row}
        {row}
      </div>
    </div>
  );
}

/* ───────────── Encabezado de sección ───────────── */

function SectionHead({
  kicker,
  title,
  text,
  href,
  cta,
}: {
  kicker?: string;
  title: ReactNode;
  text?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div className="min-w-0">
        {kicker && <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-cyan">{kicker}</p>}
        <h2 className="serif mt-2 text-[clamp(2.5rem,6vw,4.6rem)] uppercase">{title}</h2>
        {text && <p className="mt-3 max-w-[48ch] text-[17px] text-navy-2">{text}</p>}
      </div>
      {href && (
        <SLink href={href} tone="outline">
          {cta ?? "Shop all"}
          <ArrowRight className="size-4" aria-hidden />
        </SLink>
      )}
    </div>
  );
}

/* ───────────── Líneas de producto ───────────── */

function Lines({ items }: { items: HomeData["categories"] }) {
  return (
    <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
      {items.map((c, i) => {
        const color = LINE_COLORS[i % LINE_COLORS.length]!;
        return (
          <li key={c.id}>
            <Reveal delay={(i % 4) * 0.06} className="h-full">
              <Link
                href={`/shop/${c.slug}`}
                className="group relative flex aspect-[4/5] h-full flex-col overflow-hidden rounded-[26px] bg-paper-2 p-4 transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 sm:aspect-[5/6] sm:rounded-[32px] sm:p-6"
                style={{ boxShadow: `inset 0 0 0 1px ${color}33` }}
                onPointerEnter={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1.5px ${color}, 0 0 46px -10px ${color}`)}
                onPointerLeave={(e) => (e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${color}33`)}
              >
                <span
                  className="pointer-events-none absolute inset-x-[-10%] bottom-[-30%] h-[80%] rounded-full opacity-45 blur-2xl transition-opacity duration-300 group-hover:opacity-80"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="relative z-10 flex items-start justify-between gap-2">
                  <span className="serif text-[clamp(1.25rem,2.4vw,1.9rem)] uppercase leading-[0.95]">{c.name}</span>
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-full text-night transition-transform duration-300 group-hover:rotate-45 sm:size-11"
                    style={{ background: color }}
                    aria-hidden
                  >
                    <ArrowUpRight className="size-5" strokeWidth={2.4} />
                  </span>
                </span>
                {c.description && (
                  <span className="relative z-10 mt-2 line-clamp-2 hidden max-w-[30ch] text-[14px] text-navy-2 sm:block">{c.description}</span>
                )}
                {c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt=""
                    loading="lazy"
                    className="pointer-events-none relative z-10 mx-auto mt-auto max-h-[64%] w-[92%] object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.55)] transition-transform duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.06] group-hover:-rotate-2"
                  />
                )}
              </Link>
            </Reveal>
          </li>
        );
      })}
    </ul>
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
        className="no-scrollbar -mx-[clamp(16px,4vw,44px)] flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-[clamp(16px,4vw,44px)] px-[clamp(16px,4vw,44px)] pb-2 sm:gap-5"
      >
        {items.map((p) => (
          <li key={p.id} className="w-[64%] shrink-0 snap-start sm:w-[40%] lg:w-[calc((100%-60px)/4)]">
            <ProductCard product={p} />
          </li>
        ))}
      </ul>
      {items.length > 4 && (
        <div className="mt-6 hidden justify-end gap-2 lg:flex">
          <button type="button" aria-label="Previous" onClick={() => move(-1)} className="grid size-11 place-items-center rounded-full bg-paper-2 hover:glow-cyan">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" aria-label="Next" onClick={() => move(1)} className="grid size-11 place-items-center rounded-full bg-paper-2 hover:glow-cyan">
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
  const color = strainColor(product.strain);
  return (
    <section className="wrap mt-24 sm:mt-32">
      <Reveal>
        <div className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-8 overflow-hidden rounded-[36px] bg-paper-2 p-6 shadow-[inset_0_0_0_1px_rgba(255,79,216,0.3)] sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-16">
          <span className="pointer-events-none absolute -left-[10%] top-[10%] size-[60%] rounded-full opacity-40 blur-3xl" style={{ background: color }} aria-hidden />
          <Link href={`/product/${product.slug}`} className="relative mx-auto block aspect-square w-full max-w-[520px]">
            <span
              className="absolute inset-[10%] rounded-full"
              style={{ background: `linear-gradient(180deg, ${color} 5%, #ff4fd8 85%)`, boxShadow: "0 0 90px -20px #ff4fd8" }}
              aria-hidden
            />
            {img && (
              <img
                src={img}
                alt={product.name}
                data-showcase-img
                className="relative size-full animate-[float-y_5s_ease-in-out_infinite] object-contain p-[4%] drop-shadow-[0_30px_34px_rgba(0,0,0,0.6)]"
              />
            )}
          </Link>
          <div className="relative">
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-cyan">{h.showcaseTitle || "Featured product"}</p>
            <h2 className="serif mt-3 text-[clamp(2.4rem,5.6vw,4.4rem)] uppercase">{product.name}</h2>
            <div className="mt-4 flex items-center gap-3">
              <StrainTag strain={product.strain} className="text-[15px]" />
              {product.weight && <span className="text-[15px] text-navy-2">{product.weight}</span>}
            </div>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-navy-2">
              {h.showcaseText || product.tagline || product.description.split("\n")[0]}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <span className="serif text-[36px] tabular-nums">{money(product.price)}</span>
              {variant && (
                <SButton size="lg" onClick={() => cart.add(variant.id, 1, { el: document.querySelector("[data-showcase-img]"), src: img })}>
                  Add to cart
                </SButton>
              )}
              <SLink href={`/product/${product.slug}`} size="lg" tone="quiet">
                View details
              </SLink>
            </div>
          </div>
        </div>
      </Reveal>
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
  const lines = data.categories.filter((c) => shop.categories.some((x) => x.id === c.id));
  const perkIcons = [FlaskConical, Truck, ShieldCheck];
  const perkColors = ["#2de2ff", "#ff4fd8", "#ffd23f"];

  return (
    <>
      {!h.heroImageUrl && h.effects.some((e) => e.strain) && data.pool.length >= 3 ? (
        <HeroVibes pool={data.pool} />
      ) : (
        <Hero data={data} />
      )}

      <Marquee />

      {/* 1 · Líneas de producto: lo primero que se ve después de la portada */}
      {lines.length > 0 && (
        <section className="wrap mt-20 sm:mt-28" id="lines">
          <Reveal>
            <SectionHead
              kicker="Shop by line"
              title={
                <>
                  Find your <span className="neon-text">fix</span>
                </>
              }
              text="Every PotTed line in one place. Tap a line to see all its strains."
              href="/shop"
            />
          </Reveal>
          <Lines items={lines} />
        </section>
      )}

      {/* 2 · Más vendidos */}
      {best.length > 0 && (
        <section className="wrap mt-24 sm:mt-32">
          <Reveal>
            <SectionHead kicker="Fan favorites" title="Best sellers" text="The ones everybody keeps coming back for." href="/shop" />
          </Reveal>
          <Reveal className="mt-10" delay={0.1}>
            <Rail items={best} />
          </Reveal>
        </section>
      )}

      {/* 3 · Por efecto */}
      {h.effects.length > 0 && (
        <section className="wrap mt-24 sm:mt-32">
          <Reveal>
            <SectionHead kicker="Pick your mood" title={h.effectsTitle} text="Pick the mood first. We’ll match the strain." />
          </Reveal>
          <ul className="mt-10 grid gap-4 sm:gap-5 md:grid-cols-3">
            {h.effects.map((e, i) => {
              const color = strainColor(e.strain);
              return (
                <li key={e.title}>
                  <Reveal delay={i * 0.08} className="h-full">
                    <Link
                      href={`/shop?strain=${encodeURIComponent(e.strain)}`}
                      className="group relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[32px] bg-paper-2 p-7 transition-transform duration-300 hover:-translate-y-1.5 md:min-h-[420px]"
                      style={{ boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 40%, transparent)` }}
                    >
                      <span
                        className="pointer-events-none absolute -right-[20%] -top-[20%] size-[80%] rounded-full opacity-35 blur-3xl transition-opacity duration-300 group-hover:opacity-70"
                        style={{ background: color }}
                        aria-hidden
                      />
                      <div className="relative z-10">
                        <StrainTag strain={e.strain} className="text-[14px]" />
                        <h3 className="serif mt-2 text-[clamp(2rem,3.4vw,2.8rem)] uppercase">{e.title}</h3>
                        <p className="mt-2 max-w-[26ch] text-[16px] text-navy-2">{e.text}</p>
                        <span className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold" style={{ color }}>
                          Shop {e.title}
                          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                        </span>
                      </div>
                      {e.imageUrl && (
                        <img
                          src={e.imageUrl}
                          alt=""
                          loading="lazy"
                          className="pointer-events-none relative z-10 ml-auto mt-auto h-[200px] w-auto origin-bottom-right object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-[1.06] md:h-[250px]"
                        />
                      )}
                    </Link>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 4 · Producto destacado */}
      {data.showcase && <Showcase product={data.showcase} />}

      {/* 5 · Laboratorio y envíos */}
      {h.perks.length > 0 && (
        <section className="wrap mt-24 sm:mt-32">
          <Reveal>
            <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#1c1450,#0b0a1f_55%,#062433)] p-7 shadow-[inset_0_0_0_1px_rgba(45,226,255,0.25)] sm:p-12">
              <div className="pointer-events-none absolute inset-x-[-20%] bottom-0 h-[55%] overflow-hidden opacity-50" aria-hidden>
                <div className="grid-floor absolute inset-x-0 top-0 h-[260%]" />
              </div>
              <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-cyan">Why PotTed</p>
                  <h2 className="serif mt-2 text-[clamp(2.4rem,5.4vw,4.2rem)] uppercase">
                    Tested. Tracked. <span className="neon-text">Trusted.</span>
                  </h2>
                  <p className="mt-4 max-w-[42ch] text-[17px] text-navy-2">
                    Every batch comes with a third-party Certificate of Analysis you can open before you buy.
                  </p>
                  <div className="mt-8">
                    <SLink href="/lab-results" size="lg">
                      Browse lab results
                    </SLink>
                  </div>
                </div>
                <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {h.perks.map((p, i) => {
                    const Icon = perkIcons[i] ?? ShieldCheck;
                    const c = perkColors[i % perkColors.length]!;
                    return (
                      <li key={p.title} className="rounded-[24px] bg-paper/70 p-5 backdrop-blur" style={{ boxShadow: `inset 0 0 0 1px ${c}44` }}>
                        <span className="grid size-12 place-items-center rounded-2xl" style={{ background: `${c}22`, color: c, boxShadow: `0 0 24px -6px ${c}` }}>
                          <Icon className="size-6" strokeWidth={1.9} aria-hidden />
                        </span>
                        <h3 className="serif mt-4 text-[21px] uppercase">{p.title}</h3>
                        <p className="mt-1.5 text-[15px] text-navy-2">{p.text}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      {/* 6 · La historia */}
      <section className="wrap mt-24 grid grid-cols-[minmax(0,1fr)] items-center gap-10 sm:mt-32 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <Reveal className="relative">
          <div className="aspect-square overflow-hidden rounded-[36px] bg-paper-2 shadow-[0_0_0_1px_rgba(255,79,216,0.35),0_0_60px_-20px_rgba(255,79,216,0.7)]">
            {h.storyImageUrl && <img src={h.storyImageUrl} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-cyan">Our story</p>
          <h2 className="serif mt-2 text-[clamp(2.5rem,5.6vw,4.4rem)] uppercase">{h.storyTitle}</h2>
          <p className="mt-6 max-w-[52ch] text-[clamp(1.08rem,1.6vw,1.25rem)] leading-[1.6] text-navy-2">{h.storyText}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <SLink href="/shop" size="lg">
              Shop now
            </SLink>
            {shop.pages.some((p) => p.slug === "about-us") && (
              <SLink href="/about-us" size="lg" tone="outline">
                Our story
              </SLink>
            )}
          </div>
        </Reveal>
      </section>

      {/* 7 · Preguntas */}
      {h.faq.length > 0 && (
        <section className="wrap mt-24 grid gap-10 sm:mt-32 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <Reveal>
            <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-cyan">FAQ</p>
            <h2 className="serif mt-2 text-[clamp(2.4rem,5vw,3.8rem)] uppercase">{h.faqTitle}</h2>
            <p className="mt-4 max-w-[34ch] text-[17px] text-navy-2">
              Can’t find your answer?{" "}
              <Link href="/contact-us" className="font-semibold text-cyan underline underline-offset-4">
                Send us a message
              </Link>
              .
            </p>
          </Reveal>
          <Reveal delay={0.1} className="space-y-3">
            {h.faq.map((item, i) => (
              <details key={i} className="group rounded-[22px] bg-paper-2 px-5 shadow-[inset_0_0_0_1px_var(--color-paper-3)] open:shadow-[inset_0_0_0_1px_rgba(45,226,255,0.5)] sm:px-7">
                <summary className="flex list-none items-center justify-between gap-6 py-5 text-[17px] font-semibold sm:text-[18px] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-paper-3 transition-[transform,background-color] duration-300 group-open:rotate-180 group-open:bg-cyan group-open:text-night">
                    <ChevronDown className="size-5" aria-hidden />
                  </span>
                </summary>
                <p className="max-w-[64ch] pb-6 text-[16px] leading-relaxed text-navy-2">{item.a}</p>
              </details>
            ))}
          </Reveal>
        </section>
      )}
    </>
  );
}
