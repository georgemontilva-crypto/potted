import { useMemo, useState } from "react";
import { Link } from "wouter";
import { FileText, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Empty, Loading } from "@/components/store";

const anchor = (s: string) => `lab-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export default function LabResults() {
  const q = trpc.store.labReports.useQuery();
  const [term, setTerm] = useState("");

  const groups = useMemo(() => {
    const t = term.trim().toLowerCase();
    const map = new Map<string, NonNullable<typeof q.data>>();
    for (const r of q.data ?? []) {
      if (t && !`${r.title} ${r.section} ${r.batch}`.toLowerCase().includes(t)) continue;
      const key = r.section || "Other";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [q.data, term]);

  return (
    <div className="wrap pt-10 sm:pt-16">
      <header className="grid items-end gap-8 lg:grid-cols-[1fr_auto]">
        <div className="max-w-[760px]">
          <h1 className="serif-xl text-[clamp(3.4rem,9vw,7rem)]">Lab Results</h1>
          <p className="mt-6 max-w-[56ch] text-[19px] text-navy-2">
            Every PotTed product is tested by an independent, third-party lab. Find your product below and open its Certificate of
            Analysis (COA).
          </p>
        </div>
        <label className="relative block w-full lg:w-[340px]">
          <span className="sr-only">Search lab results</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-navy-3" aria-hidden />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search a strain or product"
            className="h-12 w-full rounded-full border border-paper-3 bg-white/80 pl-11 pr-4 text-[16px] placeholder:text-navy-3 focus:border-navy focus:outline-none focus:ring-4 focus:ring-sky/20"
          />
        </label>
      </header>

      {q.isLoading ? (
        <Loading />
      ) : groups.length === 0 ? (
        <Empty title="No results" text={term ? `Nothing matches “${term}”.` : "Lab results will appear here soon."} />
      ) : (
        <>
          {!term && groups.length > 1 && (
            <nav aria-label="Product types" className="no-scrollbar mt-10 flex gap-2 overflow-x-auto">
              {groups.map(([section, rows]) => (
                <a
                  key={section}
                  href={`#${anchor(section)}`}
                  className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-paper-2 px-4 text-[14.5px] font-medium hover:bg-paper-3"
                >
                  {section}
                  <span className="text-navy-3">{rows.length}</span>
                </a>
              ))}
            </nav>
          )}
          <div className="mt-12 space-y-16">
            {groups.map(([section, rows]) => (
              <section key={section} id={anchor(section)} className="scroll-mt-[96px]">
                <h2 className="serif text-[clamp(2rem,4vw,3rem)]">{section}</h2>
                <ul className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-4 border-t border-paper-3 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-[17px] font-semibold">{r.title}</p>
                        <p className="text-[14px] text-navy-2">
                          {[r.lab, r.batch && `Batch ${r.batch}`, r.testedAt].filter(Boolean).join(", ") ||
                            (r.productSlug ? (
                              <Link href={`/product/${r.productSlug}`} className="text-sky-ink underline underline-offset-2">
                                Shop this product
                              </Link>
                            ) : (
                              "Certificate of Analysis"
                            ))}
                        </p>
                      </div>
                      <a
                        href={r.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-navy px-4 text-[14px] font-semibold text-paper transition-colors hover:bg-sky-ink"
                        aria-label={`View ${r.title} certificate of analysis`}
                      >
                        <FileText className="size-4" aria-hidden />
                        View COA
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
