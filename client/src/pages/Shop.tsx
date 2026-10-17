import { Link, useLocation, useParams, useSearch } from "wouter";
import { X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { ProductCard } from "@/components/ProductCard";
import { Empty, Loading, SLink, SSelect, strainColor } from "@/components/store";
import { cx } from "@/components/ui";

type Sort = "destacados" | "nuevos" | "precio_asc" | "precio_desc" | "nombre";
const SORTS: [Sort, string][] = [
  ["destacados", "Featured"],
  ["nuevos", "Newest"],
  ["precio_asc", "Price: low to high"],
  ["precio_desc", "Price: high to low"],
  ["nombre", "Name"],
];

/**
 * Fila de chips que se desliza de lado. En el teléfono llega hasta el borde
 * de la pantalla y se desvanece a la derecha, para que se note que hay más.
 */
const scrollRow =
  "no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto -mx-[clamp(16px,4vw,44px)] px-[clamp(16px,4vw,44px)] [mask-image:linear-gradient(to_right,#000_82%,transparent)] lg:mx-0 lg:px-0 lg:[mask-image:none]";

const chip = (on: boolean) =>
  cx(
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14.5px] font-medium transition-colors",
    on ? "bg-navy text-paper" : "bg-paper-2 hover:bg-paper-3",
  );

export default function Shop() {
  const shop = useShop()!;
  const { slug } = useParams<{ slug?: string }>();
  const search = new URLSearchParams(useSearch());
  const [, navigate] = useLocation();
  const strain = search.get("strain") ?? "";
  const term = search.get("q") ?? "";
  const sort = (SORTS.find(([k]) => k === search.get("sort"))?.[0] ?? "destacados") as Sort;

  const q = trpc.store.products.useQuery({
    category: slug,
    strain: strain || undefined,
    search: term || undefined,
    sort,
  });

  const base = slug ? `/shop/${slug}` : "/shop";
  const withParams = (path: string, changes: Record<string, string>) => {
    const p = new URLSearchParams(search);
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    return qs ? `${path}?${qs}` : path;
  };

  const sortControl = (width: string) => (
    <label className="flex items-center gap-2 text-[14px] text-navy-2">
      <span className="hidden sm:inline">Sort</span>
      <SSelect
        value={sort}
        onChange={(e) => navigate(withParams(base, { sort: e.target.value === "destacados" ? "" : e.target.value }))}
        className={width}
        aria-label="Sort products"
      >
        {SORTS.map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SSelect>
    </label>
  );

  const category = q.data?.category;
  const title = term ? `Results for “${term}”` : (category?.name ?? (strain ? `${strain} picks` : "Shop all"));

  return (
    <div className="wrap pt-10 sm:pt-14">
      <header className="max-w-[820px]">
        <h1 className="serif-xl text-[clamp(3.4rem,9vw,7rem)]">{title}</h1>
        <p className="mt-5 max-w-[56ch] text-[18px] text-navy-2">
          {category?.description ||
            "Live rosin, crumble and pre-rolls — every product backed by a third-party Certificate of Analysis."}
        </p>
      </header>

      <div className="mt-8 border-b border-paper-3 bg-paper/92 py-3 backdrop-blur-md lg:sticky lg:top-[72px] lg:z-20 lg:-mx-[clamp(16px,4vw,44px)] lg:mt-10 lg:px-[clamp(16px,4vw,44px)]">
        <div className="flex items-center gap-x-6">
          <nav aria-label="Categories" className={cx(scrollRow, "-my-1 py-1")}>
            <Link href={withParams("/shop", {})} className={chip(!slug)}>
              All
            </Link>
            {shop.categories.map((c) => (
              <Link key={c.id} href={withParams(`/shop/${c.slug}`, {})} className={chip(slug === c.slug)}>
                {c.name}
              </Link>
            ))}
          </nav>
          <div className="hidden lg:block">{sortControl("w-[200px]")}</div>
        </div>
        {shop.strains.length > 1 && (
          <div className={cx(scrollRow, "mt-3")} role="group" aria-label="Filter by effect">
            {shop.strains.map((s) => {
              const on = strain === s;
              return (
                <Link
                  key={s}
                  href={withParams(base, { strain: on ? "" : s })}
                  aria-pressed={on}
                  className={cx(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors",
                    on ? "text-paper" : "bg-transparent shadow-[inset_0_0_0_1px_var(--color-paper-3)] hover:bg-paper-2",
                  )}
                  style={on ? { background: strainColor(s) } : { color: strainColor(s) }}
                >
                  {!on && <span className="size-2 rounded-full" style={{ background: strainColor(s) }} aria-hidden />}
                  {s}
                  {on && <X className="size-3.5" aria-hidden />}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {q.isLoading ? (
        <Loading />
      ) : !q.data || q.data.items.length === 0 ? (
        <Empty
          title="Nothing here yet"
          text={term ? `No products match “${term}”. Try another strain name.` : "No products match these filters right now."}
        >
          <SLink href="/shop">Show all products</SLink>
        </Empty>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-[14px] text-navy-2" aria-live="polite">
              {q.data.items.length} {q.data.items.length === 1 ? "product" : "products"}
            </p>
            <div className="lg:hidden">{sortControl("w-[190px]")}</div>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
            {q.data.items.map((p) => (
              <li key={p.id}>
                <ProductCard product={p} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
