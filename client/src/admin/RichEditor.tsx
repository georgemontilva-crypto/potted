import { useEffect, useRef, useState } from "react";
import { Bold, Code2, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Undo2 } from "lucide-react";
import { Spinner, Textarea, cx, toastError, uploadFile } from "@/components/ui";

/**
 * Editor de texto enriquecido sencillo (negritas, títulos, listas, enlaces e
 * imágenes). El servidor limpia el HTML al guardar.
 */
export function RichEditor({
  value,
  onChange,
  minHeight = 360,
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef(value);
  const [raw, setRaw] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  // Solo se reescribe el contenido cuando el valor cambia desde afuera.
  useEffect(() => {
    if (raw || !ref.current) return;
    if (value !== last.current || ref.current.innerHTML === "") {
      ref.current.innerHTML = value;
      last.current = value;
    }
  }, [value, raw]);

  const emit = () => {
    const html = ref.current?.innerHTML ?? "";
    last.current = html;
    onChange(html);
  };

  const cmd = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  };

  const tools: { label: string; icon: typeof Bold; run: () => void }[] = [
    { label: "Título", icon: Heading2, run: () => cmd("formatBlock", "<h2>") },
    { label: "Subtítulo", icon: Heading3, run: () => cmd("formatBlock", "<h3>") },
    { label: "Negrita", icon: Bold, run: () => cmd("bold") },
    { label: "Cursiva", icon: Italic, run: () => cmd("italic") },
    { label: "Lista", icon: List, run: () => cmd("insertUnorderedList") },
    { label: "Lista numerada", icon: ListOrdered, run: () => cmd("insertOrderedList") },
    { label: "Cita", icon: Quote, run: () => cmd("formatBlock", "<blockquote>") },
    {
      label: "Enlace",
      icon: Link2,
      run: () => {
        const url = window.prompt("Dirección del enlace (https://… o /shop)");
        if (url) cmd("createLink", url);
      },
    },
    { label: "Imagen", icon: ImagePlus, run: () => file.current?.click() },
    { label: "Quitar formato", icon: Undo2, run: () => cmd("formatBlock", "<p>") },
  ];

  return (
    <div className="overflow-hidden rounded-ctl border border-line bg-white focus-within:border-ink">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-mist-2 bg-mist/60 p-1.5">
        {!raw &&
          tools.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.label}
              aria-label={t.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={t.run}
              className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-white hover:text-ink"
            >
              <t.icon className="size-[18px]" />
            </button>
          ))}
        {busy && <Spinner className="ml-2 size-4" />}
        <button
          type="button"
          onClick={() => setRaw((r) => !r)}
          className={cx(
            "ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium",
            raw ? "bg-ink text-white" : "text-ink-2 hover:bg-white",
          )}
        >
          <Code2 className="size-4" />
          HTML
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const url = await uploadFile(f);
            cmd("insertHTML", `<img src="${url}" alt="" />`);
          } catch (err) {
            toastError(err);
          } finally {
            setBusy(false);
          }
        }}
      />
      {raw ? (
        <Textarea
          value={value}
          onChange={(e) => {
            last.current = "";
            onChange(e.target.value);
          }}
          rows={18}
          spellCheck={false}
          className="rounded-none border-0 font-mono text-[13px] focus:ring-0"
        />
      ) : (
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onBlur={emit}
          className="prose-potted max-w-none px-5 py-4 text-[16px] focus:outline-none [&_img]:max-w-[420px]"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
