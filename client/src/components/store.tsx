import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "wouter";
import { ChevronDown, Loader2 } from "lucide-react";
import { cx } from "./ui";

/* Piezas de la tienda (inglés, estilo PotTed). El panel usa ./ui. */

type Tone = "ink" | "sun" | "outline" | "quiet";
type Size = "sm" | "md" | "lg";

const TONE: Record<Tone, string> = {
  // Botón principal: degradado neón rosa → naranja con brillo.
  ink: "bg-[linear-gradient(100deg,var(--color-pink),#ff6aa8_45%,var(--color-orange))] bg-[length:160%_100%] bg-left text-night shadow-[0_0_0_1px_rgba(255,79,216,0.4),0_10px_30px_-8px_rgba(255,79,216,0.7)] hover:bg-right hover:shadow-[0_0_0_1px_rgba(255,79,216,0.6),0_14px_38px_-6px_rgba(255,79,216,0.9)] [transition:background-position_.5s,box-shadow_.2s,transform_.2s]",
  sun: "bg-sun text-night shadow-[0_10px_30px_-10px_rgba(255,210,63,0.7)] hover:bg-[#ffe07a]",
  outline: "text-navy shadow-[inset_0_0_0_1.5px_rgba(246,243,255,0.35)] hover:text-cyan hover:shadow-[inset_0_0_0_1.5px_var(--color-cyan),0_0_24px_-6px_rgba(45,226,255,0.7)]",
  quiet: "text-navy hover:bg-paper-2",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px]",
  md: "h-11 px-6 text-[15px]",
  lg: "h-14 px-8 text-[16px]",
};
export const sbtn = (tone: Tone = "ink", size: Size = "md", className?: string) =>
  cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap",
    "transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
    TONE[tone],
    SIZE[size],
    className,
  );

export const SButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: Size; loading?: boolean }
>(function SButton({ tone = "ink", size = "md", loading, className, children, disabled, type = "button", ...rest }, ref) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} className={sbtn(tone, size, className)} {...rest}>
      {loading && <Loader2 className="size-4 animate-[spin_0.8s_linear_infinite]" aria-hidden />}
      {children}
    </button>
  );
});

export function SLink({
  href,
  tone = "ink",
  size = "md",
  className,
  children,
}: {
  href: string;
  tone?: Tone;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  if (/^https?:|^mailto:|^tel:/.test(href)) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={sbtn(tone, size, className)}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={sbtn(tone, size, className)}>
      {children}
    </Link>
  );
}

const control =
  "w-full rounded-[14px] border border-paper-3 bg-paper-2/80 px-4 text-[16px] text-navy placeholder:text-navy-3 transition-[border-color,box-shadow] duration-150 hover:border-navy-3 focus:border-cyan focus:bg-paper-2 focus:outline-none focus:ring-4 focus:ring-cyan/20 [&>option]:bg-paper-2";

export function SField({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[14px] font-semibold">
        {label}
        {optional && <span className="text-[13px] font-normal text-navy-3">Optional</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[13px] text-cherry">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[13px] leading-snug text-navy-2">{hint}</span>
      ) : null}
    </label>
  );
}

export const SInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(control, "h-12", className)} {...rest} />;
});

export const STextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function STextarea({ className, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cx(control, "py-3 leading-relaxed", className)} {...rest} />;
  },
);

export function SSelect({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cx("relative block", className)}>
      <select className={cx(control, "h-12 appearance-none pr-10")} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-navy-2" aria-hidden />
    </span>
  );
}

const STRAIN_COLOR: Record<string, string> = {
  indica: "var(--color-violet)",
  sativa: "var(--color-sun)",
  hybrid: "var(--color-leaf)",
  relaxing: "var(--color-violet)",
  uplifting: "var(--color-sun)",
  harmony: "var(--color-cyan)",
};
export const strainColor = (s: string) => STRAIN_COLOR[s.toLowerCase()] ?? "var(--color-sky-ink)";

/** Tipo de cepa con su color (punto + nombre). */
export function StrainTag({ strain, className }: { strain: string; className?: string }) {
  if (!strain) return null;
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] font-semibold", className)} style={{ color: strainColor(strain) }}>
      <span className="size-2 rounded-full" style={{ background: strainColor(strain) }} aria-hidden />
      {strain}
    </span>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center">
      <Loader2 className="size-6 animate-[spin_0.8s_linear_infinite] text-navy-3" aria-label="Loading" />
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-20 text-center">
      <h2 className="serif text-[clamp(1.8rem,4vw,2.6rem)]">{title}</h2>
      {text && <p className="mt-3 max-w-[46ch] text-[17px] text-navy-2">{text}</p>}
      {children && <div className="mt-7">{children}</div>}
    </div>
  );
}

/** Mensaje de un error de tRPC, en una sola línea. */
export function errorText(err: unknown, fallback = "Something went wrong. Please try again.") {
  const e = err as { message?: string };
  let msg = e?.message ?? fallback;
  if (msg.trim().startsWith("[")) {
    try {
      const issues = JSON.parse(msg) as { message: string }[];
      msg = issues[0]?.message ?? fallback;
    } catch {
      msg = fallback;
    }
  }
  return msg;
}

export const fmtDate = (d: Date | string, withTime = false) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
