import { useMemo, useState } from "react";
import { ExternalLink, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Field, IconButton, Input, Modal, Select, Toggle, confirmDialog, toast, toastError, uploadFile } from "@/components/ui";
import { trpc, type Out } from "@/lib/trpc";
import { LoadError, Loading, PageHeader, Pill, Row, SearchInput, Tag } from "./common";

type Report = Out["admin"]["labReports"]["list"][number];

export default function LabReports() {
  const utils = trpc.useUtils();
  const q = trpc.admin.labReports.list.useQuery();
  const [editing, setEditing] = useState<Report | "new" | null>(null);
  const [section, setSection] = useState("");
  const [term, setTerm] = useState("");
  const refresh = () => utils.admin.labReports.list.invalidate();
  const toggle = trpc.admin.labReports.toggle.useMutation({ onSuccess: refresh, onError: toastError });
  const remove = trpc.admin.labReports.remove.useMutation({
    onSuccess: () => {
      toast("Reporte eliminado");
      void refresh();
    },
    onError: toastError,
  });

  const sections = useMemo(() => [...new Set((q.data ?? []).map((r) => r.section || "Otros"))], [q.data]);
  const rows = (q.data ?? []).filter(
    (r) =>
      (!section || (r.section || "Otros") === section) &&
      (!term.trim() || `${r.title} ${r.productName ?? ""}`.toLowerCase().includes(term.trim().toLowerCase())),
  );
  const imp = trpc.admin.importer.status.useQuery();
  const oldHost = imp.data ? new URL(imp.data.defaultSource).host.replace(/^www\./, "") : "";
  const external = oldHost ? (q.data ?? []).filter((r) => r.fileUrl.includes(oldHost)).length : 0;

  return (
    <>
      <PageHeader
        title="Lab results"
        description="Los certificados de análisis (COA) que se ven en /lab-results. Si enlazas un reporte a un producto, también aparece en la ficha de ese producto."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            Nuevo reporte
          </Button>
        }
      />
      {external > 0 && (
        <p className="mb-4 rounded-[20px] bg-warn/10 px-5 py-4 text-[14px] text-warn">
          {external} reportes todavía apuntan al sitio anterior. Usa <strong>Importar</strong> para copiarlos a tu almacenamiento antes de
          apagar el sitio viejo.
        </p>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <SearchInput value={term} onChange={setTerm} placeholder="Buscar por producto" label="Buscar reportes" className="w-full sm:w-[300px]" />
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              <Pill active={!section} onClick={() => setSection("")} count={q.data.length}>
                Todos
              </Pill>
              {sections.map((s) => (
                <Pill key={s} active={section === s} onClick={() => setSection(s)} count={q.data.filter((r) => (r.section || "Otros") === s).length}>
                  {s}
                </Pill>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-white p-5 sm:p-6">
            {rows.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-ink-2">No hay reportes con ese filtro.</p>
            ) : (
              <ul>
                {rows.map((r) => (
                  <Row key={r.id}>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {r.title}
                        <Tag>{r.section || "Otros"}</Tag>
                        {r.productName && <Tag tone="good">{r.productName}</Tag>}
                      </p>
                      <p className="truncate text-[13px] text-ink-2">{[r.lab, r.batch, r.testedAt].filter(Boolean).join(", ") || r.fileUrl}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Toggle checked={r.isPublished} onChange={(v) => toggle.mutate({ id: r.id, value: v })} label="Visible" />
                      <a href={r.fileUrl} target="_blank" rel="noreferrer" title="Abrir" className="ml-2 grid size-10 place-items-center rounded-full hover:bg-mist">
                        <ExternalLink className="size-[18px]" />
                      </a>
                      <IconButton label={`Editar ${r.title}`} onClick={() => setEditing(r)}>
                        <Pencil className="size-[18px]" />
                      </IconButton>
                      <IconButton
                        label={`Eliminar ${r.title}`}
                        onClick={async () => {
                          if (await confirmDialog({ title: `¿Eliminar el reporte de ${r.title}?`, action: "Eliminar", danger: true }))
                            remove.mutate({ id: r.id });
                        }}
                      >
                        <Trash2 className="size-[18px]" />
                      </IconButton>
                    </div>
                  </Row>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      {editing && (
        <ReportForm
          key={editing === "new" ? "new" : editing.id}
          report={editing === "new" ? null : editing}
          sections={sections}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function ReportForm({
  report,
  sections,
  onClose,
  onSaved,
}: {
  report: Report | null;
  sections: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const products = trpc.admin.products.list.useQuery();
  const [f, setF] = useState({
    title: report?.title ?? "",
    section: report?.section ?? sections[0] ?? "",
    fileUrl: report?.fileUrl ?? "",
    productId: report?.productId ?? null,
    lab: report?.lab ?? "",
    batch: report?.batch ?? "",
    testedAt: report?.testedAt ?? "",
    isPublished: report?.isPublished ?? true,
  });
  const [busy, setBusy] = useState(false);
  const save = trpc.admin.labReports.save.useMutation({
    onSuccess: () => {
      toast("Reporte guardado");
      onSaved();
      onClose();
    },
    onError: toastError,
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={report ? "Editar reporte" : "Nuevo reporte"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={save.isPending} disabled={busy} onClick={() => save.mutate({ id: report?.id, ...f })}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Producto o cepa">
          <Input value={f.title} maxLength={160} onChange={set("title")} placeholder="Ej: Gelato" />
        </Field>
        <Field label="Grupo" hint="Agrupa los reportes en la página (3 Gram Crumble, Pre-rolls…).">
          <Input value={f.section} maxLength={120} list="lab-sections" onChange={set("section")} />
          <datalist id="lab-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </Field>
        <Field label="Archivo (PDF o imagen)" hint={f.fileUrl ? f.fileUrl : "Sube el PDF del laboratorio, hasta 15 MB."}>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-mist px-5 text-[15px] font-medium hover:bg-mist-2">
            <FileUp className="size-4" />
            {busy ? "Subiendo…" : f.fileUrl ? "Cambiar archivo" : "Subir archivo"}
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setBusy(true);
                try {
                  const url = await uploadFile(file);
                  setF((x) => ({ ...x, fileUrl: url, title: x.title || file.name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " ") }));
                } catch (err) {
                  toastError(err);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </Field>
        <Field label="Producto de la tienda" optional hint="Muestra el reporte en la ficha del producto.">
          <Select value={f.productId ?? ""} onChange={(e) => setF((x) => ({ ...x, productId: e.target.value ? Number(e.target.value) : null }))}>
            <option value="">Ninguno</option>
            {(products.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Laboratorio" optional>
            <Input value={f.lab} maxLength={160} onChange={set("lab")} />
          </Field>
          <Field label="Lote" optional>
            <Input value={f.batch} maxLength={80} onChange={set("batch")} />
          </Field>
          <Field label="Fecha" optional>
            <Input type="date" value={f.testedAt} onChange={set("testedAt")} />
          </Field>
        </div>
        <Toggle checked={f.isPublished} onChange={(v) => setF((x) => ({ ...x, isPublished: v }))} label="Visible en la tienda" />
      </div>
    </Modal>
  );
}
