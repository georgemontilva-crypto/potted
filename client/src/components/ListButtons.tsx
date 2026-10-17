import { ArrowLeftRight, Heart } from "lucide-react";
import { motion } from "motion/react";
import { compare, wishlist } from "@/lib/lists";
import { cx, toast } from "./ui";

/** Corazón para guardar en la lista de deseos. */
export function WishButton({ id, name, variant = "icon", className }: { id: number; name: string; variant?: "icon" | "pill"; className?: string }) {
  const ids = wishlist.use();
  const on = ids.includes(id);
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = wishlist.toggle(id);
    toast(r.added ? `${name} saved to your wishlist` : `${name} removed from your wishlist`);
  };
  const heart = (
    <motion.span key={String(on)} initial={on ? { scale: 0.5 } : false} animate={{ scale: [0.5, 1.3, 1] }} transition={{ duration: 0.4 }} className="grid place-items-center">
      <Heart className={cx("size-[18px]", on && "fill-cherry text-cherry")} strokeWidth={2} />
    </motion.span>
  );
  if (variant === "pill") {
    return (
      <button type="button" onClick={click} aria-pressed={on} className={cx("inline-flex h-11 items-center gap-2 rounded-full bg-paper-2 px-4 text-[14.5px] font-semibold hover:bg-paper-3", className)}>
        {heart}
        {on ? "Saved" : "Add to wishlist"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
      title={on ? "Remove from wishlist" : "Add to wishlist"}
      className={cx("grid size-10 place-items-center rounded-full bg-paper/85 text-navy shadow-sm backdrop-blur transition-colors hover:bg-paper", className)}
    >
      {heart}
    </button>
  );
}

/** Flechas para agregar al comparador (máximo 4 productos). */
export function CompareButton({ id, name, variant = "icon", className }: { id: number; name: string; variant?: "icon" | "pill"; className?: string }) {
  const ids = compare.use();
  const on = ids.includes(id);
  const click = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = compare.toggle(id);
    if (!r.added) toast(`${name} removed from compare`);
    else toast(r.dropped !== null ? `Added to compare. You can compare up to ${compare.max} products, so the oldest one was removed.` : `${name} added to compare`);
  };
  if (variant === "pill") {
    return (
      <button type="button" onClick={click} aria-pressed={on} className={cx("inline-flex h-11 items-center gap-2 rounded-full bg-paper-2 px-4 text-[14.5px] font-semibold hover:bg-paper-3", on && "bg-sky/25", className)}>
        <ArrowLeftRight className="size-[18px]" />
        {on ? "In compare" : "Compare"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from compare` : `Compare ${name}`}
      title={on ? "Remove from compare" : "Compare"}
      className={cx(
        "grid size-10 place-items-center rounded-full shadow-sm backdrop-blur transition-colors",
        on ? "bg-sky text-navy" : "bg-paper/85 text-navy hover:bg-paper",
        className,
      )}
    >
      <ArrowLeftRight className="size-[17px]" strokeWidth={2} />
    </button>
  );
}
