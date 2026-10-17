import { useState } from "react";
import { DownloadCloud } from "lucide-react";
import { Button, Field, Input, Toggle, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Card, Loading, PageHeader, fmtDateTime } from "./common";

export default function Importer() {
  const status = trpc.admin.importer.status.useQuery(undefined, {
    refetchInterval: (q) => (q.state.data?.running ? 1500 : false),
  });
  const utils = trpc.useUtils();
  const [opts, setOpts] = useState({ posts: true, pages: true, products: true, labReports: true, overwrite: false });
  const [source, setSource] = useState("");
  const start = trpc.admin.importer.start.useMutation({
    onSuccess: () => void utils.admin.importer.status.invalidate(),
    onError: toastError,
  });

  if (!status.data) return <Loading />;
  const s = status.data;
  const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Importar del sitio anterior"
        description="Copia el contenido de la tienda vieja en WordPress: artículos del blog, páginas (About, políticas…), fotos de productos y los PDF de laboratorio. Todo se guarda en tu propio almacenamiento, así que el sitio viejo se puede apagar después."
      />
      <div className="space-y-4">
        <Card title="Qué importar">
          <div className="space-y-4">
            <Field label="Dirección del sitio anterior" hint="Debe seguir en línea mientras importas. Si el dominio ya apunta a esta tienda, usa la dirección temporal del sitio viejo.">
              <Input value={source || s.defaultSource} onChange={(e) => setSource(e.target.value)} spellCheck={false} autoCapitalize="none" />
            </Field>
            <Toggle checked={opts.posts} onChange={(v) => setOpts((o) => ({ ...o, posts: v }))} label="Artículos del blog" hint="Con sus imágenes y portadas" />
            <Toggle checked={opts.pages} onChange={(v) => setOpts((o) => ({ ...o, pages: v }))} label="Páginas" hint="About Us, FDA and Hemp, Privacy, Shipping, Refund y Terms" />
            <Toggle checked={opts.products} onChange={(v) => setOpts((o) => ({ ...o, products: v }))} label="Fotos de productos" hint="Completa las fotos que faltan y crea productos que no existan aquí" />
            <Toggle checked={opts.labReports} onChange={(v) => setOpts((o) => ({ ...o, labReports: v }))} label="PDF de laboratorio" hint="Copia los certificados que todavía apuntan al sitio viejo" />
            <Toggle
              checked={opts.overwrite}
              onChange={(v) => setOpts((o) => ({ ...o, overwrite: v }))}
              label="Reemplazar lo que ya editaste"
              hint="Apagado: no toca artículos, páginas ni fotos que ya cambiaste en este panel"
            />
            <Button
              size="lg"
              loading={start.isPending}
              disabled={s.running}
              onClick={() => start.mutate({ source: (source || s.defaultSource).trim(), ...opts })}
            >
              <DownloadCloud className="size-5" aria-hidden />
              {s.running ? "Importando…" : "Empezar a importar"}
            </Button>
          </div>
        </Card>

        {(s.running || s.startedAt) && (
          <Card title={s.running ? "En curso" : "Última importación"}>
            <p className="text-[15px] font-medium">{s.step}</p>
            {s.total > 0 && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-mist">
                  <div className="h-full rounded-full bg-good transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1.5 text-[13px] text-ink-2">
                  {s.done} de {s.total} elementos
                  {s.startedAt && `, empezó ${fmtDateTime(s.startedAt)}`}
                  {s.finishedAt && `, terminó ${fmtDateTime(s.finishedAt)}`}
                </p>
              </div>
            )}
            {s.log.length > 0 && (
              <ul className="mt-4 space-y-1 text-[14px] text-ink-2">
                {s.log.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {s.errors.length > 0 && (
              <details className="mt-4 rounded-xl bg-bad/8 p-4 text-[13px] text-bad">
                <summary className="cursor-pointer font-medium">{s.errors.length} avisos</summary>
                <ul className="mt-2 space-y-1">
                  {s.errors.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </details>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
