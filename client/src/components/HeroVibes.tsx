import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useLocation } from "wouter";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import type { Out } from "@/lib/trpc";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { SLink } from "./store";
import { cx } from "./ui";

type Card = Out["store"]["home"]["pool"][number];
const EASE = [0.22, 1, 0.36, 1] as const;

/* Cada vibra agrupa los tipos de producto que le corresponden. */
const GROUPS: Record<string, string[]> = {
  indica: ["indica", "relaxing"],
  sativa: ["sativa", "uplifting"],
  hybrid: ["hybrid", "harmony"],
};
/* Color del sol para cada vibra. */
const SUN: Record<string, string> = {
  indica: "#b894ff",
  sativa: "#ffd23f",
  hybrid: "#4ff09a",
  relaxing: "#b894ff",
  uplifting: "#ffd23f",
  harmony: "#2de2ff",
};
const NIGHT = "#0b0a1f";

function mix(hex: string, base: string, amount: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex);
  const b = p(base);
  return `#${a.map((v, i) => Math.round(v * amount + b[i]! * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
}

/** Tres productos de la vibra, de categorías distintas cuando se puede. */
function pick(pool: Card[], strain: string): Card[] {
  const group = GROUPS[strain.toLowerCase()] ?? [strain.toLowerCase()];
  const mine = pool.filter((p) => group.includes(p.strain.toLowerCase()));
  const source = mine.length >= 2 ? mine : pool;
  const out: Card[] = [];
  for (const p of source) {
    if (out.length === 3) break;
    if (!out.some((o) => o.categoryId === p.categoryId)) out.push(p);
  }
  for (const p of source) {
    if (out.length === 3) break;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

/** Calcomanía circular que gira, como sello de lata retro. */
function Sticker({ reduce }: { reduce: boolean | null }) {
  const text = "LAB TESTED ✦ 21+ ONLY ✦ SHIPS USPS ✦ PREMIUM ✦ ";
  return (
    <motion.div
      className="absolute left-[2%] top-[4%] z-40 size-[24%] min-w-[92px]"
      animate={reduce ? undefined : { rotate: 360 }}
      transition={{ duration: 22, ease: "linear", repeat: Infinity }}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="size-full">
        <circle cx="100" cy="100" r="98" fill="#0b0a1f" stroke="var(--color-pink)" strokeWidth="3" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="var(--color-cyan)" strokeWidth="2" strokeDasharray="3 6" />
        <path id="sticker-ring" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" fill="none" />
        <text fill="#f6f3ff" fontSize="16" fontWeight="700" fontFamily="var(--font-sans)">
          <textPath href="#sticker-ring" textLength="462" lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
        <text x="100" y="114" textAnchor="middle" fill="var(--color-sun)" fontSize="42" fontFamily="var(--font-serif)" fontWeight="800">
          21+
        </text>
      </svg>
    </motion.div>
  );
}

/** Capa que se desplaza con el puntero según su profundidad. */
function Depth({
  mx,
  my,
  depth,
  className,
  children,
}: {
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth: number;
  className?: string;
  children: React.ReactNode;
}) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
}

const SLOTS = [
  { cls: "left-[0%] top-[32%] w-[52%] z-20", rot: -9, depth: 26 },
  { cls: "right-[-2%] top-[8%] w-[50%] z-10", rot: 8, depth: 14 },
  { cls: "left-[36%] top-[44%] w-[33%] z-30", rot: 13, depth: 40 },
];

export function HeroVibes({ pool }: { pool: Card[] }) {
  const shop = useShop()!;
  const h = shop.settings.home;
  const money = useMoney();
  const reduce = useReducedMotion();
  const [, navigate] = useLocation();

  const vibes = h.effects.filter((e) => e.strain);
  const startAt = Math.max(0, vibes.findIndex((v) => v.strain.toLowerCase() === "sativa"));
  const [idx, setIdx] = useState(startAt);
  const [auto, setAuto] = useState(true);
  const [hoverStage, setHoverStage] = useState(false);
  const [hint, setHint] = useState(true);
  const dragged = useRef(0);

  const vibe = vibes[idx];
  const strain = vibe?.strain ?? "";
  const sun = SUN[strain.toLowerCase()] ?? "#ffd23f";
  const bg = mix(sun, NIGHT, 0.1);
  const picks = useMemo(() => pick(pool, strain), [pool, strain]);

  // Cambia de vibra sola hasta que la persona toque algo.
  useEffect(() => {
    if (!auto || reduce || hoverStage || vibes.length < 2) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setIdx((i) => (i + 1) % vibes.length);
    }, 4200);
    return () => clearInterval(t);
  }, [auto, reduce, hoverStage, vibes.length]);

  // Parallax con el puntero.
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 90, damping: 18, mass: 0.6 });
  const my = useSpring(rawY, { stiffness: 90, damping: 18, mass: 0.6 });
  const onMove = (e: RPointerEvent<HTMLElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    rawX.set((e.clientX - r.left) / r.width - 0.5);
    rawY.set((e.clientY - r.top) / r.height - 0.5);
  };

  const choose = (i: number) => {
    setAuto(false);
    setIdx(i);
  };

  if (!vibe) return null;
  const shopHref = `/shop?strain=${encodeURIComponent(strain)}`;

  return (
    <motion.section
      className="relative overflow-hidden"
      animate={{ backgroundColor: bg }}
      initial={false}
      transition={{ duration: 0.8, ease: EASE }}
      onPointerMove={onMove}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
    >
      {/* Piso de grilla 80s */}
      <div className="pointer-events-none absolute inset-x-[-20%] bottom-0 h-[34%] overflow-hidden lg:h-[18%]" aria-hidden>
        <div className="grid-floor absolute inset-x-0 top-0 h-[260%] opacity-70" />
      </div>
      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-[34%] h-px lg:hidden"
        animate={{ backgroundColor: sun, boxShadow: `0 0 24px 4px ${sun}` }}
        transition={{ duration: 0.8 }}
        aria-hidden
      />
      <div className="wrap relative grid grid-cols-[minmax(0,1fr)] items-center gap-x-10 pb-14 pt-8 lg:min-h-[calc(100dvh-112px)] lg:grid-cols-[1.02fr_1fr] lg:pb-16 lg:pt-4">
        <div className="relative z-10 min-w-0">
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
          <p className="mt-6 max-w-[36ch] text-[clamp(1.05rem,1.5vw,1.3rem)] leading-snug text-navy-2">{h.heroSubtitle}</p>

          <div className="mt-9">
            <p className="text-[13px] font-bold uppercase tracking-[0.18em] text-cyan">What’s your vibe?</p>
            <div role="tablist" aria-label="Choose your vibe" className="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {vibes.map((v, i) => {
                const on = i === idx;
                const c = SUN[v.strain.toLowerCase()] ?? "#ffd23f";
                return (
                  <button
                    key={v.title}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => choose(i)}
                    className={cx(
                      "relative flex h-[60px] shrink-0 items-center gap-2.5 rounded-full pl-1.5 pr-5 text-[15px] font-semibold transition-colors duration-300",
                      on ? "text-night" : "bg-paper-2/70 text-navy shadow-[inset_0_0_0_1.5px_var(--color-paper-3)] backdrop-blur hover:shadow-[inset_0_0_0_1.5px_var(--color-navy-3)]",
                    )}
                  >
                    {on && (
                      <motion.span
                        layoutId="vibe-pill"
                        className="absolute inset-0 rounded-full bg-[linear-gradient(100deg,var(--color-pink),var(--color-orange))] shadow-[0_0_30px_-4px_rgba(255,79,216,0.8)]"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-full" style={{ background: c }}>
                      {v.imageUrl && (
                        <img
                          src={v.imageUrl}
                          alt=""
                          className="absolute -bottom-[10%] left-1/2 h-[125%] w-auto max-w-none -translate-x-1/2 object-contain"
                        />
                      )}
                    </span>
                    <span className="relative">{v.title}</span>
                    {on && auto && !reduce && (
                      <motion.span
                        key={`bar-${idx}`}
                        className="absolute bottom-[7px] left-[62px] right-5 h-[2px] origin-left rounded-full bg-night/60"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: hoverStage ? 0 : 1 }}
                        transition={{ duration: hoverStage ? 0.2 : 4.2, ease: "linear" }}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={vibe.title}
                className="mt-4 min-h-[2.8em] max-w-[40ch] text-[16px] text-navy-2"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                aria-live="polite"
              >
                {vibe.text}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <SLink href={shopHref} size="lg">
              Shop {vibe.title}
            </SLink>
            <SLink href="/lab-results" size="lg" tone="outline">
              See lab results
            </SLink>
          </div>
        </div>

        {/* Escenario */}
        <div
          className="relative mx-auto mt-12 aspect-square w-full max-w-[620px] select-none lg:mt-0"
          onPointerEnter={() => setHoverStage(true)}
          onPointerLeave={() => setHoverStage(false)}
        >
          <Depth mx={mx} my={my} depth={-10} className="absolute inset-[7%]">
            <motion.div
              className="size-full rounded-full"
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                background: `linear-gradient(180deg, ${sun} 8%, #ff4fd8 78%)`,
                boxShadow: `0 0 90px -10px ${sun}, 0 0 160px -30px #ff4fd8`,
              }}
              transition={{ duration: 0.7, ease: EASE }}
            />
            {!reduce && (
              <motion.div
                key={strain}
                className="absolute inset-0 rounded-full border-[3px]"
                style={{ borderColor: sun }}
                initial={{ scale: 1, opacity: 0.9 }}
                animate={{ scale: 1.28, opacity: 0 }}
                transition={{ duration: 1.1, ease: "easeOut" }}
                aria-hidden
              />
            )}
            {/* Franjas del atardecer 80s, del color del fondo. */}
            <div className="absolute inset-0 overflow-hidden rounded-full" aria-hidden>
              {[
                [10, 5.5],
                [20, 4.5],
                [29, 3.5],
                [37, 2.6],
                [44, 1.8],
              ].map(([b, hgt]) => (
                <motion.div
                  key={b}
                  className="absolute inset-x-0"
                  style={{ bottom: `${b}%`, height: `${hgt}%` }}
                  animate={{ backgroundColor: bg }}
                  transition={{ duration: 0.8, ease: EASE }}
                />
              ))}
            </div>
          </Depth>

          <Depth mx={mx} my={my} depth={8} className="absolute inset-0 z-40 pointer-events-none">
            <Sticker reduce={reduce} />
          </Depth>

          <AnimatePresence mode="popLayout" initial={false}>
            {picks.map((p, i) => {
              const slot = SLOTS[i]!;
              return (
                <Depth key={`${strain}-${p.id}`} mx={mx} my={my} depth={slot.depth} className={cx("absolute", slot.cls)}>
                  <motion.div
                    className="group relative cursor-grab touch-pan-y active:cursor-grabbing"
                    initial={reduce ? false : { opacity: 0, y: 120, rotate: slot.rot - 20, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, rotate: slot.rot, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -140, rotate: slot.rot + 25, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 140, damping: 16, delay: i * 0.07 }}
                    drag
                    dragSnapToOrigin
                    dragElastic={0.55}
                    dragTransition={{ bounceStiffness: 260, bounceDamping: 14 }}
                    whileHover={reduce ? undefined : { scale: 1.05, rotate: slot.rot * 0.4 }}
                    whileDrag={{ scale: 1.12, rotate: 0, zIndex: 60 }}
                    onDragStart={() => {
                      dragged.current = Date.now();
                      setAuto(false);
                      setHint(false);
                    }}
                    onDragEnd={() => {
                      dragged.current = Date.now();
                    }}
                    onClick={() => {
                      if (Date.now() - dragged.current > 250) navigate(`/product/${p.slug}`);
                    }}
                    role="link"
                    aria-label={`${p.name}, ${money(p.price)}`}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/product/${p.slug}`)}
                  >
                    <img
                      src={imageFor(p.images)}
                      alt=""
                      draggable={false}
                      className="pointer-events-none w-full drop-shadow-[0_28px_30px_rgba(0,0,0,0.55)]"
                    />
                    <span className="pointer-events-none absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-navy px-3.5 py-1.5 text-[13px] font-semibold text-paper opacity-0 shadow-float transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      {p.name} {money(p.price)}
                    </span>
                  </motion.div>
                </Depth>
              );
            })}
          </AnimatePresence>

          <Depth mx={mx} my={my} depth={52} className="pointer-events-none absolute -bottom-[3%] right-0 z-50 w-[25%] sm:-right-[3%] sm:w-[27%]">
            <AnimatePresence mode="wait" initial={false}>
              {vibe.imageUrl && (
                <motion.img
                  key={vibe.imageUrl}
                  src={vibe.imageUrl}
                  alt=""
                  className="w-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)]"
                  initial={reduce ? false : { opacity: 0, x: 40, rotate: 8 }}
                  animate={{ opacity: 1, x: 0, rotate: 0 }}
                  exit={{ opacity: 0, x: -30, rotate: -8 }}
                  transition={{ duration: 0.45, ease: EASE }}
                />
              )}
            </AnimatePresence>
          </Depth>

          <AnimatePresence>
            {hint && !reduce && (
              <motion.p
                className="pointer-events-none absolute -bottom-8 left-[8%] z-50 text-[15px] font-medium text-navy-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 1.6 }}
              >
                ↖ psst, grab one and give it a toss
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

    </motion.section>
  );
}
