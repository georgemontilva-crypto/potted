import { Link } from "wouter";
import { Plus } from "lucide-react";
import { imageFor, useMoney, type ProductCard as Card } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { StrainTag } from "./store";
import { cx } from "./ui";

/** Silueta para productos que todavía no tienen foto. */
export function NoPhoto({ name, className }: { name: string; className?: string }) {
  return (
    <div className={cx("grid size-full place-items-center p-6 text-center", className)}>
      <span className="serif max-w-[10ch] text-[26px] text-navy/25">{name}</span>
    </div>
  );
}

export function ProductCard({ product: p, className, size = "md" }: { product: Card; className?: string; size?: "md" | "lg" }) {
  const money = useMoney();
  const img = imageFor(p.images);
  const second = p.images[1]?.url;
  const soldOut = p.stock <= 0;

  return (
    <article className={cx("group relative flex flex-col", className)}>
      <Link
        href={`/product/${p.slug}`}
        className="relative block aspect-[1/1.05] overflow-hidden rounded-[26px] bg-paper-2 transition-colors duration-300 group-hover:bg-paper-3"
      >
        {img ? (
          <>
            <img
              src={img}
              alt={p.name}
              loading="lazy"
              className={cx(
                "absolute inset-0 size-full object-contain p-[9%] drop-shadow-[0_18px_22px_rgba(23,32,59,0.18)] transition-[opacity,transform] duration-500 ease-apple group-hover:scale-[1.04]",
                second && "group-hover:opacity-0",
              )}
            />
            {second && (
              <img
                src={second}
                alt=""
                loading="lazy"
                aria-hidden
                className="absolute inset-0 size-full object-contain p-[9%] opacity-0 drop-shadow-[0_18px_22px_rgba(23,32,59,0.18)] transition-opacity duration-500 group-hover:opacity-100"
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
              soldOut ? "bg-navy text-paper" : p.compareAtPrice ? "bg-cherry text-white" : "bg-sun text-navy",
            )}
          >
            {soldOut ? "Sold out" : p.compareAtPrice ? "Sale" : "New"}
          </span>
        )}
      </Link>

      <div className="mt-4 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <StrainTag strain={p.strain} />
            {p.weight && <span className="text-[13px] text-navy-3">{p.weight}</span>}
          </div>
          <h3 className={cx("serif mt-1", size === "lg" ? "text-[26px]" : "text-[21px]")}>
            <Link href={`/product/${p.slug}`} className="after:absolute after:inset-0 after:content-['']">
              {p.name}
            </Link>
          </h3>
          <p className="mt-1 text-[15px] text-navy-2">
            <span className="font-semibold text-navy tabular-nums">{money(p.price)}</span>
            {p.compareAtPrice && p.compareAtPrice > p.price && (
              <s className="ml-1.5 text-navy-3 tabular-nums">{money(p.compareAtPrice)}</s>
            )}
          </p>
        </div>
        {p.quickVariantId && (
          <button
            type="button"
            onClick={() => cart.add(p.quickVariantId!)}
            aria-label={`Add ${p.name} to cart`}
            className="relative z-10 mt-1 grid size-11 shrink-0 place-items-center rounded-full bg-navy text-paper transition-[background-color,transform] duration-200 hover:bg-sky-ink active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.2} />
          </button>
        )}
      </div>
    </article>
  );
}
