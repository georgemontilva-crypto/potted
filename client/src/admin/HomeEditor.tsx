import { useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import type { Settings } from "@shared/types";
import { Button, ButtonLink, Field, IconButton, Input, Select, Textarea } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Card, ImageInput, PageHeader, SaveBar } from "./common";
import { SettingsLoader, useSaveSettings } from "./settingsForm";

type Home = Settings["home"];
const MAX_PERKS = 4;

export default function HomeEditor() {
  return (
    <>
      <PageHeader title="Portada" description="Los textos e imágenes de la página de inicio de la tienda." />
      <SettingsLoader>{(initial) => <Form initial={initial} />}</SettingsLoader>
    </>
  );
}

function Form({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const save = useSaveSettings("Portada guardada");
  const products = trpc.admin.products.list.useQuery();
  const cats = trpc.admin.categories.list.useQuery();

  const set = (p: Partial<Settings>) => setS((x) => ({ ...x, ...p }));
  const setHome = (p: Partial<Home>) => setS((x) => ({ ...x, home: { ...x.home, ...p } }));
  const home = s.home;

  const productOptions = (products.data ?? []).map((p) => (
    <option key={p.id} value={p.id}>
      {p.isActive ? p.name : `${p.name} (oculto)`}
    </option>
  ));
  const toId = (v: string) => (v ? Number(v) : null);
  /** Si el producto elegido ya no existe, se avisa en la misma lista. */
  const goneOption = (id: number | null) =>
    id !== null && products.data && !products.data.some((p) => p.id === id) ? <option value={id}>Producto eliminado</option> : null;

  return (
    <>
      <div className="space-y-4">
        <Card title="Barra de anuncio" description="La franja que va arriba de todo en la tienda.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Texto del anuncio" hint="Déjalo vacío para ocultarla.">
              <Input value={s.announcement} maxLength={200} onChange={(e) => set({ announcement: e.target.value })} />
            </Field>
            <Field label="Enlace del anuncio" optional hint="A dónde lleva al tocarlo. Ej: /shop">
              <Input
                value={s.announcementHref}
                maxLength={400}
                placeholder="/shop"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => set({ announcementHref: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Principal" description="Lo primero que ve quien entra a la tienda.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <Input value={home.heroTitle} maxLength={80} onChange={(e) => setHome({ heroTitle: e.target.value })} />
            </Field>
            <Field label="Subtítulo" optional className="sm:col-span-2">
              <Textarea value={home.heroSubtitle} rows={2} maxLength={240} onChange={(e) => setHome({ heroSubtitle: e.target.value })} />
            </Field>
            <Field label="Texto del botón">
              <Input value={home.heroCtaLabel} maxLength={40} onChange={(e) => setHome({ heroCtaLabel: e.target.value })} />
            </Field>
            <Field label="Enlace del botón">
              <Input
                value={home.heroCtaHref}
                maxLength={400}
                placeholder="/shop"
                autoCapitalize="none"
                spellCheck={false}
                onChange={(e) => setHome({ heroCtaHref: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <ImageInput
                label="Foto de portada"
                hint="Opcional. Reemplaza el collage automático de productos. Usa un PNG o WebP sin fondo."
                value={home.heroImageUrl}
                onChange={(url) => setHome({ heroImageUrl: url })}
                className="aspect-[16/9] max-w-[520px]"
              />
            </div>
          </div>
        </Card>

        <Card title="Producto destacado" description="Un producto grande con botón para agregar al carrito.">
          <div className="grid gap-4">
            <Field label="Producto">
              <Select value={home.showcaseProductId ?? ""} onChange={(e) => setHome({ showcaseProductId: toId(e.target.value) })}>
                <option value="">Automático</option>
                {goneOption(home.showcaseProductId)}
                {productOptions}
              </Select>
            </Field>
            <Field label="Título">
              <Input value={home.showcaseTitle} maxLength={120} onChange={(e) => setHome({ showcaseTitle: e.target.value })} />
            </Field>
            <Field label="Texto" optional>
              <Textarea value={home.showcaseText} rows={3} maxLength={600} onChange={(e) => setHome({ showcaseText: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Historia" description="Un bloque para contar quién está detrás de la marca.">
          <div className="grid gap-4">
            <Field label="Título">
              <Input value={home.storyTitle} maxLength={160} onChange={(e) => setHome({ storyTitle: e.target.value })} />
            </Field>
            <Field label="Texto" optional>
              <Textarea value={home.storyText} rows={5} maxLength={1200} onChange={(e) => setHome({ storyText: e.target.value })} />
            </Field>
            <ImageInput label="Imagen" value={home.storyImageUrl} onChange={(url) => setHome({ storyImageUrl: url })} className="aspect-square max-w-[240px]" />
          </div>
        </Card>

        <Card title="Comprar por efecto" description="Tarjetas que llevan a la tienda filtrada por tipo (Indica, Sativa, Hybrid…).">
          <div className="space-y-4">
            <Field label="Título de la sección">
              <Input value={home.effectsTitle} maxLength={120} onChange={(e) => setHome({ effectsTitle: e.target.value })} />
            </Field>
            {home.effects.map((ef, i) => {
              const upd = (p: Partial<typeof ef>) => setHome({ effects: home.effects.map((x, n) => (n === i ? { ...x, ...p } : x)) });
              return (
                <div key={i} className="grid gap-4 rounded-[20px] bg-mist p-4 md:grid-cols-[160px_minmax(0,1fr)_auto]">
                  <ImageInput label="Ilustración" value={ef.imageUrl} onChange={(url) => upd({ imageUrl: url })} fit="contain" className="aspect-[3/4] w-[160px]" />
                  <div className="grid content-start gap-3 sm:grid-cols-2">
                    <Field label="Título">
                      <Input value={ef.title} maxLength={60} onChange={(e) => upd({ title: e.target.value })} />
                    </Field>
                    <Field label="Tipo que filtra" hint="Igual que en los productos.">
                      <Input value={ef.strain} maxLength={40} onChange={(e) => upd({ strain: e.target.value })} />
                    </Field>
                    <Field label="Texto" className="sm:col-span-2">
                      <Input value={ef.text} maxLength={240} onChange={(e) => upd({ text: e.target.value })} />
                    </Field>
                  </div>
                  <IconButton label={`Quitar la tarjeta ${i + 1}`} onClick={() => setHome({ effects: home.effects.filter((_, n) => n !== i) })}>
                    <Trash2 className="size-[18px]" aria-hidden />
                  </IconButton>
                </div>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              disabled={home.effects.length >= 4}
              onClick={() => setHome({ effects: [...home.effects, { title: "", text: "", strain: "", imageUrl: "" }] })}
            >
              <Plus className="size-4" aria-hidden />
              Agregar tarjeta
            </Button>
          </div>
        </Card>

        <Card title="Pre-rolls" description="Sección con los productos de una categoría.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título">
              <Input value={home.prerollTitle} maxLength={120} onChange={(e) => setHome({ prerollTitle: e.target.value })} />
            </Field>
            <Field label="Categoría que se muestra">
              <Select value={home.prerollCategory} onChange={(e) => setHome({ prerollCategory: e.target.value })}>
                <option value="">Ocultar la sección</option>
                {(cats.data ?? []).map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Texto" className="sm:col-span-2">
              <Textarea value={home.prerollText} rows={3} maxLength={600} onChange={(e) => setHome({ prerollText: e.target.value })} />
            </Field>
            <ImageInput label="Imagen" value={home.prerollImageUrl} onChange={(url) => setHome({ prerollImageUrl: url })} className="aspect-[4/3] max-w-[280px]" optional />
          </div>
        </Card>

        <Card title="¿Cuál es tu vibra?" description="Banda oscura con imagen de fondo y accesos a cada tipo.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Título" className="sm:col-span-2">
              <Input value={home.vibeTitle} maxLength={120} onChange={(e) => setHome({ vibeTitle: e.target.value })} />
            </Field>
            <Field label="Texto" className="sm:col-span-2">
              <Textarea value={home.vibeText} rows={3} maxLength={800} onChange={(e) => setHome({ vibeText: e.target.value })} />
            </Field>
            <ImageInput label="Imagen de fondo" value={home.vibeImageUrl} onChange={(url) => setHome({ vibeImageUrl: url })} className="aspect-[16/9] max-w-[360px]" optional />
          </div>
        </Card>

        <Card title="Preguntas frecuentes" description="Salen al final de la portada.">
          <div className="space-y-3">
            <Field label="Título de la sección">
              <Input value={home.faqTitle} maxLength={120} onChange={(e) => setHome({ faqTitle: e.target.value })} />
            </Field>
            {home.faq.map((item, i) => (
              <div key={i} className="flex items-start gap-2 rounded-[20px] bg-mist p-4">
                <div className="grid min-w-0 flex-1 gap-2.5">
                  <Input
                    aria-label={`Pregunta ${i + 1}`}
                    placeholder="Pregunta"
                    value={item.q}
                    maxLength={300}
                    onChange={(e) => setHome({ faq: home.faq.map((x, n) => (n === i ? { ...x, q: e.target.value } : x)) })}
                  />
                  <Textarea
                    aria-label={`Respuesta ${i + 1}`}
                    placeholder="Respuesta"
                    rows={3}
                    value={item.a}
                    maxLength={5000}
                    onChange={(e) => setHome({ faq: home.faq.map((x, n) => (n === i ? { ...x, a: e.target.value } : x)) })}
                  />
                </div>
                <IconButton label={`Quitar la pregunta ${i + 1}`} onClick={() => setHome({ faq: home.faq.filter((_, n) => n !== i) })}>
                  <Trash2 className="size-[18px]" aria-hidden />
                </IconButton>
              </div>
            ))}
            <Button variant="secondary" size="sm" disabled={home.faq.length >= 20} onClick={() => setHome({ faq: [...home.faq, { q: "", a: "" }] })}>
              <Plus className="size-4" aria-hidden />
              Agregar pregunta
            </Button>
          </div>
        </Card>

        <Card title="Ventajas" description={`Hasta ${MAX_PERKS} razones cortas para comprar: envío, cambios, pagos.`}>
          {home.perks.length > 0 && (
            <ul className="mb-4 space-y-3">
              {home.perks.map((perk, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
                    <Input
                      aria-label={`Título de la ventaja ${i + 1}`}
                      placeholder="Título. Ej: Envío rápido"
                      value={perk.title}
                      maxLength={60}
                      onChange={(e) => setHome({ perks: home.perks.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)) })}
                    />
                    <Input
                      aria-label={`Texto de la ventaja ${i + 1}`}
                      placeholder="Texto. Ej: Despachamos en 24 horas hábiles."
                      value={perk.text}
                      maxLength={200}
                      onChange={(e) => setHome({ perks: home.perks.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)) })}
                    />
                  </div>
                  <IconButton
                    label={`Quitar la ventaja ${i + 1}`}
                    className="mt-1"
                    onClick={() => setHome({ perks: home.perks.filter((_, n) => n !== i) })}
                  >
                    <Trash2 className="size-[18px]" aria-hidden />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={home.perks.length >= MAX_PERKS}
            onClick={() => setHome({ perks: [...home.perks, { title: "", text: "" }] })}
          >
            <Plus className="size-4" aria-hidden />
            Agregar ventaja
          </Button>
        </Card>
      </div>

      <SaveBar>
        <ButtonLink href="/" variant="secondary" external>
          Ver tienda
          <ExternalLink className="size-4" aria-hidden />
        </ButtonLink>
        <Button
          loading={save.isPending}
          onClick={() => {
            // Las ventajas sin título ni texto no se guardan.
            const clean: Settings = {
              ...s,
              home: {
                ...home,
                perks: home.perks.filter((p) => p.title.trim() || p.text.trim()),
                faq: home.faq.filter((f) => f.q.trim() && f.a.trim()),
                effects: home.effects.filter((f) => f.title.trim()),
              },
            };
            setS(clean);
            save.mutate(clean);
          }}
        >
          Guardar portada
        </Button>
      </SaveBar>
    </>
  );
}
