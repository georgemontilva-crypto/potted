import { Link, useParams, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { Empty, Loading, SLink, fmtDate } from "@/components/store";
import { cx } from "@/components/ui";

function Cover({ url, title, className }: { url: string; title: string; className?: string }) {
  return (
    <div className={cx("overflow-hidden rounded-[28px] bg-paper-2", className)}>
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="grid size-full place-items-center p-8">
          <span className="serif text-center text-[22px] text-navy/30">{title}</span>
        </div>
      )}
    </div>
  );
}

export function BlogList() {
  const page = Math.max(1, Number(new URLSearchParams(useSearch()).get("page") ?? "1") || 1);
  const q = trpc.store.posts.useQuery({ page, perPage: 13 });
  if (q.isLoading) return <Loading />;
  const items = q.data?.items ?? [];
  const [lead, ...rest] = page === 1 ? items : [undefined, ...items];

  return (
    <div className="wrap pt-10 sm:pt-16">
      <h1 className="serif-xl text-[clamp(3.4rem,9vw,7rem)]">The PotTed Blog</h1>
      <p className="mt-5 max-w-[52ch] text-[19px] text-navy-2">Guides on THCA, strains, lab reports and getting the most out of every session.</p>

      {items.length === 0 ? (
        <Empty title="No articles yet" text="Check back soon." />
      ) : (
        <>
          {lead && (
            <Link href={`/blog/${lead.slug}`} className="group mt-12 grid items-center gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
              <Cover url={lead.coverUrl} title={lead.title} className="aspect-[3/2]" />
              <div>
                <p className="text-[14px] text-navy-2">{fmtDate(lead.publishedAt)}</p>
                <h2 className="serif mt-3 text-[clamp(2.2rem,4.4vw,3.6rem)] group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                  {lead.title}
                </h2>
                {lead.excerpt && <p className="mt-4 max-w-[52ch] text-[18px] text-navy-2">{lead.excerpt}</p>}
              </div>
            </Link>
          )}
          <ul className="mt-16 grid gap-x-6 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map(
              (p) =>
                p && (
                  <li key={p.id}>
                    <Link href={`/blog/${p.slug}`} className="group block">
                      <Cover url={p.coverUrl} title={p.title} className="aspect-[3/2]" />
                      <p className="mt-4 text-[14px] text-navy-2">{fmtDate(p.publishedAt)}</p>
                      <h2 className="serif mt-1.5 text-[24px] group-hover:underline group-hover:underline-offset-4">{p.title}</h2>
                    </Link>
                  </li>
                ),
            )}
          </ul>
          {(q.data?.pages ?? 1) > 1 && (
            <nav aria-label="Pages" className="mt-16 flex items-center justify-center gap-3">
              {page > 1 && (
                <SLink href={page === 2 ? "/blog" : `/blog?page=${page - 1}`} tone="outline">
                  Newer articles
                </SLink>
              )}
              <span className="px-3 text-[15px] text-navy-2">
                Page {page} of {q.data!.pages}
              </span>
              {page < q.data!.pages && (
                <SLink href={`/blog?page=${page + 1}`} tone="outline">
                  Older articles
                </SLink>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const shop = useShop()!;
  const q = trpc.store.post.useQuery({ slug: slug ?? "" });
  if (q.isLoading) return <Loading />;
  const p = q.data;
  if (!p) {
    return (
      <div className="wrap pt-10">
        <Empty title="Article not found" text="It may have moved. Browse the latest articles instead.">
          <SLink href="/blog">Go to the blog</SLink>
        </Empty>
      </div>
    );
  }
  return (
    <article className="wrap pt-10 sm:pt-16">
      <header className="mx-auto max-w-[860px]">
        <Link href="/blog" className="text-[15px] font-semibold text-sky-ink hover:underline">
          Blog
        </Link>
        <h1 className="serif mt-4 text-[clamp(2.6rem,6.4vw,4.8rem)]">{p.title}</h1>
        <p className="mt-5 text-[15px] text-navy-2">
          {fmtDate(p.publishedAt)}
          {p.author && <span> by {p.author}</span>}
        </p>
      </header>
      {p.coverUrl && (
        <img src={p.coverUrl} alt="" className="mx-auto mt-10 aspect-[3/2] w-full max-w-[1080px] rounded-[36px] bg-paper-2 object-cover" />
      )}
      <div className="prose-potted mx-auto mt-12 max-w-[720px]" dangerouslySetInnerHTML={{ __html: p.body }} />

      <aside className="mx-auto mt-16 max-w-[720px] rounded-[30px] bg-paper-2 p-7 sm:p-9">
        <h2 className="serif text-[30px]">Find your vibe at {shop.settings.storeName}</h2>
        <p className="mt-2 text-[17px] text-navy-2">Lab-tested live rosin, crumble and pre-rolls, shipped fast across the USA.</p>
        <div className="mt-6">
          <SLink href="/shop">Shop now</SLink>
        </div>
      </aside>

      {p.more.length > 0 && (
        <section className="mx-auto mt-24 max-w-[1080px]">
          <h2 className="serif text-[clamp(2rem,4vw,3rem)]">Keep reading</h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {p.more.map((m) => (
              <li key={m.id}>
                <Link href={`/blog/${m.slug}`} className="group block">
                  <Cover url={m.coverUrl} title={m.title} className="aspect-[3/2]" />
                  <h3 className="serif mt-4 text-[21px] group-hover:underline group-hover:underline-offset-4">{m.title}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
