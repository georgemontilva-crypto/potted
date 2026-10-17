import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ExternalLink, Plus } from "lucide-react";
import { Button, ButtonLink, Field, Input, Textarea, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { slugify } from "@shared/types";
import { Card, ImageInput, LoadError, Loading, NotFound, PageHeader, Row, SaveBar, SearchInput, Tag, Thumb, errorCode, fmtDate, useDebounced } from "./common";
import { RichEditor } from "./RichEditor";

export default function Posts() {
  const [term, setTerm] = useState("");
  const search = useDebounced(term);
  const q = trpc.admin.posts.list.useQuery({ search: search || undefined });
  return (
    <>
      <PageHeader
        title="Blog"
        description="Artículos que se ven en /blog. Para traer los del sitio anterior usa Importar."
        actions={
          <ButtonLink href="/admin/blog/nuevo">
            <Plus className="size-4" aria-hidden />
            Nuevo artículo
          </ButtonLink>
        }
      />
      <SearchInput value={term} onChange={setTerm} placeholder="Buscar por título" label="Buscar artículos" className="mb-4 w-full sm:w-[320px]" />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          {q.data.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-2">Todavía no hay artículos.</p>
          ) : (
            <ul>
              {q.data.map((p) => (
                <Row key={p.id}>
                  <Link href={`/admin/blog/${p.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                    <Thumb src={p.coverUrl} className="h-12 w-[72px]" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.title}</span>
                      <span className="text-[13px] text-ink-2">{fmtDate(p.publishedAt)}</span>
                    </span>
                  </Link>
                  {!p.isPublished && <Tag tone="warn">Borrador</Tag>}
                </Row>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

const toInputDate = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

export function PostEditor({ id }: { id: number | null }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const q = trpc.admin.posts.get.useQuery({ id: id ?? 0 }, { enabled: id !== null });
  const [f, setF] = useState<{
    title: string;
    slug: string;
    excerpt: string;
    coverUrl: string;
    body: string;
    author: string;
    seoDescription: string;
    isPublished: boolean;
    date: string;
  } | null>(id === null ? { title: "", slug: "", excerpt: "", coverUrl: "", body: "", author: "", seoDescription: "", isPublished: true, date: toInputDate(new Date()) } : null);

  if (id !== null && q.data && !f) {
    const p = q.data;
    setF({ title: p.title, slug: p.slug, excerpt: p.excerpt, coverUrl: p.coverUrl, body: p.body, author: p.author, seoDescription: p.seoDescription, isPublished: p.isPublished, date: toInputDate(p.publishedAt) });
  }

  const save = trpc.admin.posts.save.useMutation({
    onSuccess: (r) => {
      toast("Artículo guardado");
      void utils.admin.posts.invalidate();
      if (id === null) navigate(`/admin/blog/${r.id}`, { replace: true });
      else setF((x) => (x ? { ...x, slug: r.slug } : x));
    },
    onError: toastError,
  });
  const remove = trpc.admin.posts.remove.useMutation({
    onSuccess: () => {
      void utils.admin.posts.invalidate();
      navigate("/admin/blog", { replace: true });
    },
    onError: toastError,
  });

  if (id !== null && q.isError) {
    return errorCode(q.error) === "NOT_FOUND" ? (
      <NotFound title="Ese artículo no existe" href="/admin/blog" action="Volver al blog" />
    ) : (
      <LoadError error={q.error} retry={() => q.refetch()} />
    );
  }
  if (!f) return <Loading />;
  const patch = (p: Partial<typeof f>) => setF((x) => (x ? { ...x, ...p } : x));

  return (
    <>
      <PageHeader back={{ href: "/admin/blog", label: "Blog" }} title={id === null ? "Nuevo artículo" : f.title || "Artículo"} />
      <div className="space-y-4">
        <Card title="Artículo">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <Input value={f.title} maxLength={255} onChange={(e) => patch({ title: e.target.value })} />
            </Field>
            <Field label="Dirección" hint={`Quedará en /blog/${slugify(f.slug || f.title) || "…"}`}>
              <Input value={f.slug} maxLength={191} placeholder={slugify(f.title)} onChange={(e) => patch({ slug: e.target.value })} onBlur={() => patch({ slug: slugify(f.slug) })} />
            </Field>
            <Field label="Fecha de publicación">
              <Input type="date" value={f.date} onChange={(e) => patch({ date: e.target.value })} />
            </Field>
            <Field label="Autor" optional>
              <Input value={f.author} maxLength={120} onChange={(e) => patch({ author: e.target.value })} />
            </Field>
            <div className="flex items-end pb-2">
              <Toggle checked={f.isPublished} onChange={(v) => patch({ isPublished: v })} label="Publicado" />
            </div>
          </div>
        </Card>
        <Card title="Portada">
          <ImageInput label="Imagen de portada" value={f.coverUrl} onChange={(url) => patch({ coverUrl: url })} className="aspect-[3/2] max-w-[420px]" optional />
        </Card>
        <Card title="Contenido">
          <RichEditor value={f.body} onChange={(body) => patch({ body })} minHeight={480} />
        </Card>
        <Card title="Buscadores">
          <div className="space-y-4">
            <Field label="Extracto" optional hint="Sale en la lista del blog. Si lo dejas vacío se toma del texto.">
              <Textarea rows={3} value={f.excerpt} maxLength={600} onChange={(e) => patch({ excerpt: e.target.value })} />
            </Field>
            <Field label="Descripción para Google" optional>
              <Textarea rows={2} value={f.seoDescription} maxLength={300} onChange={(e) => patch({ seoDescription: e.target.value })} />
            </Field>
          </div>
        </Card>
      </div>
      <SaveBar>
        {id !== null && (
          <>
            <Button
              variant="danger"
              className="mr-auto"
              loading={remove.isPending}
              onClick={async () => {
                if (await confirmDialog({ title: "¿Eliminar este artículo?", action: "Eliminar", danger: true })) remove.mutate({ id });
              }}
            >
              Eliminar
            </Button>
            {f.isPublished && f.slug && (
              <ButtonLink href={`/blog/${f.slug}`} variant="secondary" external>
                Ver artículo
                <ExternalLink className="size-4" aria-hidden />
              </ButtonLink>
            )}
          </>
        )}
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              id: id ?? undefined,
              title: f.title.trim(),
              slug: f.slug.trim(),
              excerpt: f.excerpt.trim(),
              coverUrl: f.coverUrl,
              body: f.body,
              author: f.author.trim(),
              seoDescription: f.seoDescription.trim(),
              isPublished: f.isPublished,
              publishedAt: f.date ? new Date(`${f.date}T12:00:00Z`) : null,
            })
          }
        >
          Guardar artículo
        </Button>
      </SaveBar>
    </>
  );
}
