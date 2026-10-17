import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { ChevronDown, FileText, FlaskConical, ShieldCheck, Truck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useMoney, useShop } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { ProductCard, NoPhoto } from "@/components/ProductCard";
import { QuantityStepper } from "@/components/CartDrawer";
import { Empty, Loading, SButton, SLink, StrainTag, strainColor } from "@/components/store";
import { cx } from "@/components/ui";

function Gallery({ images, name, strain }: { images: { url: string }[]; name: string; strain: string }) {
  const [i, setI] = useState(0);
  const current = images[i] ?? images[0];
  return (
    <div className="lg:sticky lg:top-[96px]">
      <div className="relative aspect-square overflow-hidden rounded-[36px] bg-paper-2">
        <span
          className="absolute inset-[12%] rounded-full"
          style={{ background: strainColor(strain || "x"), opacity: 0.12 }}
          aria-hidden
        />
        {current ? (
          <img
            key={current.url}
            src={current.url}
            alt={name}
            data-gallery-main
            className="relative size-full animate-[fade-in_0.35s_ease] object-contain p-[8%] drop-shadow-[0_30px_34px_rgba(23,32,59,0.22)]"
          />
        ) : (
          <NoPhoto name={name} />
        )}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-3">
          {images.map((img, n) => (
            <li key={img.url}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`Show photo ${n + 1}`}
                aria-current={n === i}
                className={cx(
                  "size-20 overflow-hidden rounded-[18px] bg-paper-2 transition-shadow",
                  n === i ? "shadow-[0_0_0_2px_var(--color-navy)]" : "hover:shadow-[0_0_0_1.5px_var(--color-paper-3)]",
                )}
              >
                <img src={img.url} alt="" className="size-full object-contain p-1.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fold({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-t border-paper-3">
      <summary className="flex list-none items-center justify-between gap-6 py-5 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-5 shrink-0 text-navy-2 transition-transform duration-300 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-6 text-[16px] leading-relaxed text-navy-2">{children}</div>
    </details>
  );
}

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const shop = useShop()!;
  const money = useMoney();
  const q = trpc.store.product.useQuery({ slug: slug ?? "" });
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);

  const p = q.data?.product;
  useEffect(() => {
    if (!p) return;
    setQty(1);
    setSize(p.sizes.find((s) => p.variants.some((v) => v.size === s && v.stock > 0)) ?? p.sizes[0] ?? "");
  }, [p]);

  if (q.isLoading) return <Loading />;
  if (!p) {
    return (
      <div className="wrap pt-10">
        <Empty title="This product isn’t available" text="It may have sold out or moved. Browse the rest of the shop.">
          <SLink href="/shop">Shop all products</SLink>
        </Empty>
      </div>
    );
  }

  const variant = p.variants.find((v) => (p.sizes.length ? v.size === size : true) && v.stock > 0) ??
    p.variants.find((v) => (p.sizes.length ? v.size === size : true));
  const available = variant?.stock ?? 0;
  const paragraphs = p.description.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  const details = p.details.split("\n").map((x) => x.trim()).filter(Boolean);

  return (
    <>
      <div className="wrap pt-6 sm:pt-10">
        <nav aria-label="Breadcrumb" className="text-[14px] text-navy-2">
          <Link href="/shop" className="hover:text-navy">
            Shop
          </Link>
          {p.category && (
            <>
              <span className="mx-2 text-navy-3">/</span>
              <Link href={`/shop/${p.category.slug}`} className="hover:text-navy">
                {p.category.name}
              </Link>
            </>
          )}
        </nav>

        <div className="mt-6 grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <Gallery images={p.images} name={p.name} strain={p.strain} />

          <div>
            <div className="flex items-center gap-3">
              <StrainTag strain={p.strain} className="text-[15px]" />
              {p.weight && <span className="rounded-full bg-paper-2 px-3 py-1 text-[13.5px] font-semibold">{p.weight}</span>}
            </div>
            <h1 className="serif mt-3 text-[clamp(2.8rem,6vw,4.8rem)]">{p.name}</h1>
            {p.tagline && <p className="mt-4 max-w-[48ch] text-[19px] leading-snug text-navy-2">{p.tagline}</p>}

            <p className="serif mt-7 text-[38px] tabular-nums">
              {money(p.price)}
              {p.compareAtPrice && p.compareAtPrice > p.price && (
                <s className="ml-3 text-[24px] text-navy-3">{money(p.compareAtPrice)}</s>
              )}
            </p>

            {p.sizes.length > 0 && (
              <fieldset className="mt-7">
                <legend className="text-[14px] font-semibold">Size</legend>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {p.sizes.map((s) => {
                    const out = !p.variants.some((v) => v.size === s && v.stock > 0);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        aria-pressed={size === s}
                        className={cx(
                          "h-11 min-w-14 rounded-full px-4 text-[15px] font-semibold transition-colors",
                          size === s ? "bg-navy text-paper" : "bg-paper-2 hover:bg-paper-3",
                          out && "text-navy-3 line-through",
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {available > 0 ? (
                <>
                  <QuantityStepper value={qty} max={Math.min(20, available)} onChange={setQty} />
                  <SButton size="lg" className="flex-1 sm:flex-none sm:min-w-[240px]" onClick={() => variant && cart.add(variant.id, qty, { el: document.querySelector("[data-gallery-main]"), src: p.images[0]?.url })}>
                    Add to cart
                  </SButton>
                </>
              ) : (
                <p className="rounded-full bg-paper-2 px-5 py-3 text-[15px] font-semibold">
                  Sold out — we’re restocking soon.
                </p>
              )}
            </div>
            {available > 0 && available <= 5 && (
              <p className="mt-3 text-[14px] font-semibold text-cherry">Only {available} left</p>
            )}

            <ul className="mt-8 grid gap-3 text-[15px] text-navy-2 sm:grid-cols-3">
              <li className="flex items-center gap-2.5">
                <FlaskConical className="size-[18px] shrink-0 text-sky-ink" aria-hidden />
                Third-party lab tested
              </li>
              <li className="flex items-center gap-2.5">
                <Truck className="size-[18px] shrink-0 text-sky-ink" aria-hidden />
                USPS, 3–5 business days
              </li>
              <li className="flex items-center gap-2.5">
                <ShieldCheck className="size-[18px] shrink-0 text-sky-ink" aria-hidden />
                21+ only
              </li>
            </ul>

            <div className="mt-10 border-b border-paper-3">
              <Fold title="Description" open>
                <div className="space-y-4">
                  {paragraphs.map((t, i) =>
                    /^(THCA|CBD):/.test(t) ? (
                      <p key={i} className="rounded-[14px] bg-paper-2 px-4 py-3 text-[15px] font-semibold text-navy">
                        {t}
                      </p>
                    ) : (
                      <p key={i}>{t}</p>
                    ),
                  )}
                </div>
              </Fold>
              {details.length > 0 && (
                <Fold title="Details">
                  <ul className="space-y-1.5">
                    {details.map((d, i) => {
                      const [k, ...rest] = d.split(":");
                      return rest.length ? (
                        <li key={i}>
                          <span className="font-semibold text-navy">{k}:</span>
                          {rest.join(":")}
                        </li>
                      ) : (
                        <li key={i}>{d}</li>
                      );
                    })}
                  </ul>
                </Fold>
              )}
              <Fold title="Lab results">
                {p.labReports.length ? (
                  <ul className="space-y-2">
                    {p.labReports.map((r) => (
                      <li key={r.id}>
                        <a
                          href={r.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 font-semibold text-sky-ink underline underline-offset-4"
                        >
                          <FileText className="size-4" aria-hidden />
                          {r.title} Certificate of Analysis
                        </a>
                        {(r.lab || r.testedAt) && (
                          <span className="ml-2 text-[14px]">{[r.lab, r.testedAt].filter(Boolean).join(", ")}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>
                    Every batch is tested by a third-party lab.{" "}
                    <Link href="/lab-results" className="font-semibold text-sky-ink underline underline-offset-4">
                      Browse all lab results
                    </Link>
                    .
                  </p>
                )}
              </Fold>
              <Fold title="Shipping">
                <p>
                  Orders ship with USPS and usually arrive in 3 to 5 business days.
                  {shop.settings.blockedStates.length > 0 &&
                    ` We can’t ship THCA products to ${shop.settings.blockedStates.join(", ")}.`}
                </p>
              </Fold>
            </div>
          </div>
        </div>
      </div>

      {q.data!.related.length > 0 && (
        <section className="wrap mt-28">
          <h2 className="serif text-[clamp(2.2rem,4.6vw,3.6rem)]">You might also like</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 lg:grid-cols-4">
            {q.data!.related.map((r) => (
              <li key={r.id}>
                <ProductCard product={r} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
