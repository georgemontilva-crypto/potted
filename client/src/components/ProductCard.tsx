import { Link } from "wouter";
import { Plus } from "lucide-react";
import { imageFor, useMoney, type ProductCard as Card } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { StrainTag, strainColor } from "./store";
import { CompareButton, WishButton } from "./ListButtons";
import { cx } from "./ui";

/** Silueta para productos que todavía no tienen foto. */
export function NoPhoto({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid size-full place-items-center p-6 text-center",
        className,
      )}
    >
      <span className="serif max-w-[10ch] text-[26px] text-navy/25">
        {name}
      </span>
    </div>
  );
}

/** Inclina la foto en 3D siguiendo el mouse (solo con mouse y sin "reducir movimiento"). */
function tilt(e: React.PointerEvent<HTMLElement>) {
  if (
    e.pointerType !== "mouse" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const r = e.currentTarget.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  e.currentTarget.style.setProperty("--rx", `${(-y * 14).toFixed(2)}deg`);
  e.currentTarget.style.setProperty("--ry", `${(x * 18).toFixed(2)}deg`);
}
function untilt(e: React.PointerEvent<HTMLElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

export function ProductCard({
  product: p,
  className,
  size = "md",
}: {
  product: Card;
  className?: string;
  size?: "md" | "lg";
}) {
  const money = useMoney();
  const img = imageFor(p.images);
  const second = p.images[1]?.url;
  const soldOut = p.stock <= 0;

  return (
    <article className={cx("group relative flex flex-col", className)}>
      <div className="relative">
        <Link
          href={`/product/${p.slug}`}
          onPointerMove={tilt}
          onPointerLeave={untilt}
          style={{ perspective: 900 }}
          className="relative block aspect-[1/1.05] overflow-hidden rounded-[26px] bg-paper-2 shadow-[inset_0_0_0_1px_var(--color-paper-3)] transition-[box-shadow] duration-300 group-hover:shadow-[inset_0_0_0_1.5px_rgba(255,79,216,0.7),0_0_40px_-12px_rgba(255,79,216,0.8)]"
        >
          {img ? (
            <>
              <img
                src={img}
                alt={p.name}
                loading="lazy"
                className={cx(
                  "absolute inset-0 size-full object-contain p-[9%] drop-shadow-[0_18px_22px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_scale(1)] group-hover:[transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_scale(1.06)]",
                  second && "group-hover:opacity-0",
                )}
              />
              {second && (
                <img
                  src={second}
                  alt=""
                  loading="lazy"
                  aria-hidden
                  className="absolute inset-0 size-full object-contain p-[9%] opacity-0 drop-shadow-[0_18px_22px_rgba(0,0,0,0.55)] transition-[opacity,transform] duration-300 [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))_scale(1.06)] group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            <NoPhoto name={p.name} />
          )}
          {(p.isNew || soldOut || (p.compareAtPrice ?? 0) > p.price) && (
            <span
              className={cx(
                "absolute left-4 top-4 rounded-full px-3 py-1 text-[12px] font-semibold",
                soldOut
                  ? "bg-navy text-paper"
                  : p.compareAtPrice
                    ? "bg-cherry text-night"
                    : "bg-sun text-night",
              )}
            >
              {soldOut ? "Sold out" : p.compareAtPrice ? "Sale" : "New"}
            </span>
          )}
        </Link>
        {p.quickVariantId && (
          <button
            type="button"
            onClick={(e) =>
              cart.add(p.quickVariantId!, 1, {
                el:
                  e.currentTarget.closest("article")?.querySelector("img") ??
                  null,
                src: img,
              })
            }
            aria-label={`Add ${p.name} to cart`}
            className="absolute bottom-3 right-3 z-10 grid size-10 place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-pink),var(--color-orange))] text-night shadow-[0_6px_20px_-4px_rgba(255,79,216,0.8)] transition-transform duration-200 hover:scale-105 active:scale-95 sm:size-11"
          >
            <Plus className="size-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
        <WishButton id={p.id} name={p.name} />
        <CompareButton
          id={p.id}
          name={p.name}
          className="lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:focus-visible:opacity-100 lg:aria-pressed:opacity-100"
        />
      </div>

      <div className="mt-3.5 px-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <StrainTag strain={p.strain} />
          {p.weight && (
            <span className="whitespace-nowrap text-[13px] text-navy-3">
              {p.weight}
            </span>
          )}
        </div>
        <h3
          className={cx(
            "serif mt-1 leading-[1.08]",
            size === "lg"
              ? "text-[22px] sm:text-[26px]"
              : "text-[18px] sm:text-[21px]",
          )}
        >
          <Link
            href={`/product/${p.slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {p.name}
          </Link>
        </h3>
        <p className="mt-1.5 text-[15px] text-navy-2">
          <span className="font-semibold text-navy tabular-nums">
            {money(p.price)}
          </span>
          {p.compareAtPrice && p.compareAtPrice > p.price && (
            <s className="ml-1.5 text-navy-3 tabular-nums">
              {money(p.compareAtPrice)}
            </s>
          )}
        </p>
      </div>
    </article>
  );
}
