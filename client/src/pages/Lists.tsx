import { Link } from "wouter";
import { ArrowLeftRight, FileText, Heart, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { compare, wishlist } from "@/lib/lists";
import { cart } from "@/lib/cart";
import { imageFor, useMoney } from "@/lib/shop";
import { ProductCard, NoPhoto } from "@/components/ProductCard";
import { Empty, Loading, SButton, SLink, StrainTag } from "@/components/store";

function EmptyList({ icon: Icon, title, text }: { icon: typeof Heart; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="grid size-24 place-items-center rounded-full bg-paper-2 text-navy-3">
        <Icon className="size-10" strokeWidth={1.6} />
      </span>
      <h2 className="serif mt-7 text-[clamp(2rem,4vw,2.8rem)]">{title}</h2>
      <p className="mt-3 max-w-[46ch] text-[17px] text-navy-2">{text}</p>
      <div className="mt-7">
        <SLink href="/shop">Return to shop</SLink>
      </div>
    </div>
  );
}

export function Wishlist() {
  const ids = wishlist.use();
  const q = trpc.store.productsByIds.useQuery({ ids }, { enabled: ids.length > 0 });
  const items = q.data ?? [];
  return (
    <div className="wrap pt-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="serif-xl text-[clamp(3.4rem,9vw,7rem)]">Wishlist</h1>
        {ids.length > 0 && (
          <button type="button" onClick={() => wishlist.clear()} className="text-[15px] text-navy-2 underline underline-offset-4 hover:text-navy">
            Clear wishlist
          </button>
        )}
      </div>
      {ids.length === 0 ? (
        <EmptyList
          icon={Heart}
          title="This wishlist is empty."
          text="Tap the heart on any product to save it here. Your wishlist stays on this device."
        />
      ) : q.isLoading ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title="These products are no longer available" text="Browse the shop to find something new.">
          <SLink href="/shop">Return to shop</SLink>
        </Empty>
      ) : (
        <>
          <p className="mt-4 text-[16px] text-navy-2">
            {items.length} saved {items.length === 1 ? "product" : "products"}. Saved on this device.
          </p>
          <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-6 md:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => (
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

export function Compare() {
  const ids = compare.use();
  const money = useMoney();
  const q = trpc.store.compare.useQuery({ ids }, { enabled: ids.length > 0 });
  const items = q.data ?? [];

  const rows: { label: string; render: (p: (typeof items)[number]) => React.ReactNode }[] = [
    { label: "Price", render: (p) => <span className="serif text-[24px] tabular-nums">{money(p.price)}</span> },
    { label: "Effect", render: (p) => (p.strain ? <StrainTag strain={p.strain} className="text-[15px]" /> : "—") },
    { label: "Weight", render: (p) => p.weight || "—" },
    { label: "Category", render: (p) => p.category?.name ?? "—" },
    { label: "Lab result", render: (p) => p.potency || "—" },
    {
      label: "COA",
      render: (p) =>
        p.labReports[0] ? (
          <a href={p.labReports[0].fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-sky-ink underline underline-offset-4">
            <FileText className="size-4" />
            View COA
          </a>
        ) : (
          "—"
        ),
    },
    {
      label: "Availability",
      render: (p) => {
        const stock = p.variants.reduce((n, v) => n + v.stock, 0);
        return stock > 0 ? <span className="font-semibold text-leaf">In stock</span> : <span className="font-semibold text-cherry">Sold out</span>;
      },
    },
    { label: "Description", render: (p) => <span className="line-clamp-5 text-[14.5px]">{p.tagline || p.description}</span> },
  ];

  return (
    <div className="wrap pt-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="serif-xl text-[clamp(3.4rem,9vw,7rem)]">Compare</h1>
        {ids.length > 0 && (
          <button type="button" onClick={() => compare.clear()} className="text-[15px] text-navy-2 underline underline-offset-4 hover:text-navy">
            Clear compare list
          </button>
        )}
      </div>
      {ids.length === 0 ? (
        <EmptyList
          icon={ArrowLeftRight}
          title="Compare list is empty."
          text={`Tap the arrows on up to ${compare.max} products to see them side by side.`}
        />
      ) : q.isLoading ? (
        <Loading />
      ) : (
        <div className="no-scrollbar -mx-[clamp(16px,4vw,44px)] mt-10 overflow-x-auto px-[clamp(16px,4vw,44px)]">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr>
                <th className="w-[150px]" />
                {items.map((p) => {
                  const variant = p.variants.find((v) => v.stock > 0);
                  const img = imageFor(p.images);
                  return (
                    <th key={p.id} className="px-2 pb-6 align-top font-normal">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => compare.remove(p.id)}
                          aria-label={`Remove ${p.name} from compare`}
                          className="absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full bg-paper/85 hover:bg-paper"
                        >
                          <X className="size-4" />
                        </button>
                        <Link href={`/product/${p.slug}`} className="block aspect-square overflow-hidden rounded-[24px] bg-paper-2">
                          {img ? <img src={img} alt="" className="size-full object-contain p-[10%]" /> : <NoPhoto name={p.name} />}
                        </Link>
                      </div>
                      <Link href={`/product/${p.slug}`} className="serif mt-4 block text-[22px] hover:underline">
                        {p.name}
                      </Link>
                      {variant && (
                        <SButton size="sm" className="mt-3" onClick={() => cart.add(variant.id, 1)}>
                          Add to cart
                        </SButton>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-paper-3">
                  <th scope="row" className="py-4 pr-4 align-top text-[14px] font-semibold text-navy-2">
                    {r.label}
                  </th>
                  {items.map((p) => (
                    <td key={p.id} className="px-2 py-4 align-top text-[15px] text-navy-2">
                      {r.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
