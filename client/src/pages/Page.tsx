import { Fragment } from "react";
import { useParams } from "wouter";
import { ChevronDown } from "lucide-react";
import type { Block } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { Empty, Loading, SLink } from "@/components/store";
import { cx } from "@/components/ui";

/** Párrafos separados por una línea en blanco; los saltos simples se respetan. */
function Prose({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className={cx("space-y-4 text-[18px] leading-[1.65] text-navy-2", className)}>
      {paras.map((p, i) => (
        <p key={i}>
          {p.split("\n").map((line, j, arr) => (
            <Fragment key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "texto":
      return (
        <section className={cx("mx-auto max-w-[760px]", block.align === "centro" && "text-center")}>
          {block.title && <h2 className="serif text-[clamp(2rem,4vw,3rem)]">{block.title}</h2>}
          {block.body && <Prose text={block.body} className={block.title ? "mt-5" : undefined} />}
        </section>
      );
    case "html":
      return (
        <section className="mx-auto max-w-[760px]">
          {block.title && <h2 className="serif mb-6 text-[clamp(2rem,4vw,3rem)]">{block.title}</h2>}
          <div className="prose-potted" dangerouslySetInnerHTML={{ __html: block.html }} />
        </section>
      );
    case "imagen":
      if (!block.url) return null;
      return (
        <figure>
          <img src={block.url} alt={block.caption} loading="lazy" className="w-full rounded-[36px] bg-paper-2 object-cover" />
          {block.caption && <figcaption className="mt-3 text-center text-[14px] text-navy-2">{block.caption}</figcaption>}
        </figure>
      );
    case "imagen_texto":
      return (
        <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className={cx("aspect-square overflow-hidden rounded-[36px] bg-paper-2", block.imageSide === "derecha" && "md:order-2")}>
            {block.url && <img src={block.url} alt="" loading="lazy" className="size-full object-cover" />}
          </div>
          <div>
            {block.title && <h2 className="serif text-[clamp(2rem,4vw,3rem)]">{block.title}</h2>}
            {block.body && <Prose text={block.body} className="mt-5" />}
          </div>
        </section>
      );
    case "preguntas":
      return (
        <section className="mx-auto max-w-[820px]">
          {block.title && <h2 className="serif mb-6 text-[clamp(2rem,4vw,3rem)]">{block.title}</h2>}
          <div className="border-b border-paper-3">
            {block.items.map((item, i) => (
              <details key={i} className="group border-t border-paper-3">
                <summary className="flex list-none items-center justify-between gap-6 py-6 text-[20px] font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="size-5 shrink-0 text-navy-2 transition-transform duration-300 group-open:rotate-180" aria-hidden />
                </summary>
                <Prose text={item.a} className="pb-7 text-[17px]" />
              </details>
            ))}
          </div>
        </section>
      );
    case "boton":
      return (
        <section className="rounded-[36px] bg-paper-2 px-6 py-16 text-center sm:py-20">
          {block.title && <h2 className="serif mx-auto max-w-[18ch] text-[clamp(2.2rem,4.6vw,3.6rem)]">{block.title}</h2>}
          {block.body && <p className="mx-auto mt-4 max-w-[48ch] text-[18px] text-navy-2">{block.body}</p>}
          {block.label && block.href && (
            <div className="mt-8">
              <SLink href={block.href} size="lg">
                {block.label}
              </SLink>
            </div>
          )}
        </section>
      );
  }
}

export function NotFound() {
  return (
    <div className="wrap pt-10">
      <Empty title="This page doesn’t exist" text="The link may be mistyped, or the page has moved.">
        <SLink href="/">Go to the home page</SLink>
      </Empty>
    </div>
  );
}

export default function Page() {
  const { slug } = useParams<{ slug?: string }>();
  const q = trpc.store.page.useQuery({ slug: slug ?? "" }, { enabled: Boolean(slug) });

  if (!slug) return <NotFound />;
  if (q.isLoading) return <Loading />;
  if (!q.data) return <NotFound />;

  const page = q.data;
  return (
    <article className="wrap pt-10 sm:pt-16">
      <header className="mx-auto max-w-[820px]">
        <h1 className="serif-xl text-[clamp(3.2rem,8.5vw,6.4rem)]">{page.title}</h1>
        {page.intro && <p className="mt-6 text-[21px] leading-snug text-navy-2 sm:text-[24px]">{page.intro}</p>}
      </header>
      <div className="mt-14 space-y-16 sm:mt-20 sm:space-y-24">
        {page.blocks.map((b, i) => (
          <BlockView key={i} block={b} />
        ))}
      </div>
    </article>
  );
}
