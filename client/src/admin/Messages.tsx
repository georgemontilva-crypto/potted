import { useState } from "react";
import { Download, Mail, Trash2 } from "lucide-react";
import { IconButton, Toggle, confirmDialog, toast, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { LoadError, Loading, PageHeader, Pill, Row, Tag, fmtDateTime } from "./common";

export default function Messages() {
  const [kind, setKind] = useState<"todos" | "contact" | "wholesale">("todos");
  const utils = trpc.useUtils();
  const q = trpc.admin.inquiries.list.useQuery({ kind });
  const refresh = () => {
    void utils.admin.inquiries.invalidate();
  };
  const mark = trpc.admin.inquiries.markRead.useMutation({ onSuccess: refresh, onError: toastError });
  const remove = trpc.admin.inquiries.remove.useMutation({ onSuccess: refresh, onError: toastError });
  const [open, setOpen] = useState<number | null>(null);

  return (
    <>
      <PageHeader title="Mensajes" description="Lo que llega por los formularios de contacto y de mayoristas. También se envía un aviso al correo de notificaciones." />
      <div className="mb-4 flex gap-2">
        <Pill active={kind === "todos"} onClick={() => setKind("todos")}>
          Todos
        </Pill>
        <Pill active={kind === "contact"} onClick={() => setKind("contact")}>
          Contacto
        </Pill>
        <Pill active={kind === "wholesale"} onClick={() => setKind("wholesale")}>
          Mayoristas
        </Pill>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          {q.data.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-2">No hay mensajes todavía.</p>
          ) : (
            <ul>
              {q.data.map((m) => (
                <Row key={m.id} className="items-start">
                  <button
                    type="button"
                    className="min-w-0 flex-1 basis-64 text-left"
                    onClick={() => {
                      setOpen(open === m.id ? null : m.id);
                      if (!m.isRead) mark.mutate({ id: m.id, value: true });
                    }}
                  >
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {!m.isRead && <span className="size-2 rounded-full bg-[#0a66c2]" aria-label="Sin leer" />}
                      {m.name}
                      <Tag tone={m.kind === "wholesale" ? "good" : "neutral"}>{m.kind === "wholesale" ? "Mayorista" : "Contacto"}</Tag>
                    </p>
                    <p className="text-[13px] text-ink-2">
                      {m.email}
                      {m.phone && `, ${m.phone}`} · {fmtDateTime(m.createdAt)}
                    </p>
                    {open !== m.id && m.message && <p className="mt-1 line-clamp-1 text-[14px] text-ink-2">{m.message}</p>}
                    {open === m.id && (
                      <div className="mt-3 space-y-1.5 text-[14px]">
                        {Object.entries(m.data)
                          .filter(([, v]) => v)
                          .map(([k, v]) => (
                            <p key={k}>
                              <span className="text-ink-2">{k}: </span>
                              {v}
                            </p>
                          ))}
                        {m.message && <p className="whitespace-pre-line rounded-xl bg-mist p-3">{m.message}</p>}
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-1">
                    <Toggle checked={m.isRead} onChange={(v) => mark.mutate({ id: m.id, value: v })} label="Leído" />
                    <a href={`mailto:${m.email}`} title="Responder" className="ml-2 grid size-10 place-items-center rounded-full hover:bg-mist">
                      <Mail className="size-[18px]" />
                    </a>
                    <IconButton
                      label="Eliminar mensaje"
                      onClick={async () => {
                        if (await confirmDialog({ title: `¿Eliminar el mensaje de ${m.name}?`, action: "Eliminar", danger: true }))
                          remove.mutate({ id: m.id });
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
      )}
    </>
  );
}

export function Subscribers() {
  const utils = trpc.useUtils();
  const q = trpc.admin.subscribers.list.useQuery();
  const remove = trpc.admin.subscribers.remove.useMutation({
    onSuccess: () => {
      toast("Suscriptor eliminado");
      void utils.admin.subscribers.invalidate();
    },
    onError: toastError,
  });
  const exportCsv = () => {
    const rows = [["email", "fecha", "origen"], ...(q.data ?? []).map((s) => [s.email, new Date(s.createdAt).toISOString(), s.source])];
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "suscriptores.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <>
      <PageHeader
        title="Suscriptores"
        description="Correos que se inscribieron al boletín. Descárgalos en CSV para tu herramienta de email marketing."
        actions={
          q.data && q.data.length > 0 ? (
            <button type="button" onClick={exportCsv} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-[15px] font-medium text-white">
              <Download className="size-4" />
              Descargar CSV
            </button>
          ) : undefined
        }
      />
      {q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <LoadError error={q.error} retry={() => q.refetch()} />
      ) : (
        <div className="rounded-[24px] bg-white p-5 sm:p-6">
          {q.data.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-2">Todavía no hay suscriptores.</p>
          ) : (
            <ul>
              {q.data.map((s) => (
                <Row key={s.id}>
                  <p className="min-w-0 flex-1 truncate font-medium">{s.email}</p>
                  <p className="text-[13px] text-ink-2">{fmtDateTime(s.createdAt)}</p>
                  <IconButton label={`Eliminar ${s.email}`} onClick={() => remove.mutate({ id: s.id })}>
                    <Trash2 className="size-[18px]" />
                  </IconButton>
                </Row>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
