import { useState, type FormEvent } from "react";
import { formatMoney, type Settings as StoreSettings } from "@shared/types";
import { Button, Field, Input, Select, Textarea, Toggle, toast, toastError } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Card, ImageInput, IntInput, PageHeader, SaveBar } from "./common";
import { SettingsLoader, useSaveSettings } from "./settingsForm";

const CURRENCIES: [code: string, name: string][] = [
  ["USD", "Dólar estadounidense (USD)"],
  ["COP", "Peso colombiano (COP)"],
  ["MXN", "Peso mexicano (MXN)"],
  ["EUR", "Euro (EUR)"],
  ["VES", "Bolívar venezolano (VES)"],
  ["PEN", "Sol peruano (PEN)"],
  ["CLP", "Peso chileno (CLP)"],
  ["ARS", "Peso argentino (ARS)"],
];
const LOCALES: [code: string, name: string][] = [
  ["es-CO", "Español (Colombia)"],
  ["es-MX", "Español (México)"],
  ["es-VE", "Español (Venezuela)"],
  ["es-ES", "Español (España)"],
  ["es-AR", "Español (Argentina)"],
  ["es-CL", "Español (Chile)"],
  ["es-PE", "Español (Perú)"],
  ["en-US", "Inglés (Estados Unidos)"],
];
const HEX = /^#[0-9a-fA-F]{6}$/;

export default function Settings() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <SettingsLoader>{(initial) => <StoreForm initial={initial} />}</SettingsLoader>
      <div className="mt-10">
        <Account />
      </div>
    </>
  );
}

/* ───────────── Ajustes de la tienda ───────────── */

function StoreForm({ initial }: { initial: StoreSettings }) {
  const [s, setS] = useState<StoreSettings>(initial);
  const [errors, setErrors] = useState<{ storeName?: string; accent?: string }>({});
  const save = useSaveSettings("Cambios guardados");
  const set = (p: Partial<StoreSettings>) => setS((x) => ({ ...x, ...p }));
  const [statesText, setStatesText] = useState(initial.blockedStates.join(", "));

  const submit = () => {
    const next: typeof errors = {};
    if (!s.storeName.trim()) next.storeName = "Escribe el nombre de la tienda.";
    if (!HEX.test(s.accent)) next.accent = "Escribe el color como #RRGGBB. Ej: #1d1d1f";
    setErrors(next);
    const first = next.storeName ?? next.accent;
    if (first) {
      toast(first, "error");
      return;
    }
    const clean: StoreSettings = {
      ...s,
      storeName: s.storeName.trim(),
      tagline: s.tagline.trim(),
      email: s.email.trim(),
      phone: s.phone.trim(),
      whatsapp: s.whatsapp.replace(/\D/g, ""),
      address: s.address.trim(),
      instagram: s.instagram.trim(),
      tiktok: s.tiktok.trim(),
      facebook: s.facebook.trim(),
      notifyEmail: s.notifyEmail.trim(),
    };
    setS(clean);
    save.mutate(clean);
  };

  return (
    <>
      <div className="space-y-4">
        <Card title="Marca">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la tienda" error={errors.storeName}>
              <Input
                value={s.storeName}
                maxLength={60}
                aria-invalid={Boolean(errors.storeName)}
                onChange={(e) => {
                  set({ storeName: e.target.value });
                  if (errors.storeName) setErrors((x) => ({ ...x, storeName: undefined }));
                }}
              />
            </Field>
            <Field label="Frase de la marca" optional>
              <Input value={s.tagline} maxLength={160} onChange={(e) => set({ tagline: e.target.value })} />
            </Field>
            <ImageInput
              label="Logo"
              hint="Si no subes logo, se muestra el nombre de la tienda."
              fit="contain"
              value={s.logoUrl}
              onChange={(url) => set({ logoUrl: url })}
              className="aspect-[2/1] max-w-[280px]"
            />
            <ImageInput
              label="Ícono de la pestaña"
              hint="El favicon. Se ve mejor cuadrado, en PNG o SVG."
              fit="contain"
              value={s.faviconUrl}
              onChange={(url) => set({ faviconUrl: url })}
              className="aspect-square max-w-[140px]"
            />
            <Field label="Color de acento" error={errors.accent} hint="Color de los botones principales.">
              <span className="flex items-center gap-2.5">
                <input
                  type="color"
                  aria-label="Elegir el color de acento"
                  value={HEX.test(s.accent) ? s.accent : "#1d1d1f"}
                  onChange={(e) => {
                    set({ accent: e.target.value });
                    setErrors((x) => ({ ...x, accent: undefined }));
                  }}
                  className="h-12 w-14 shrink-0 cursor-pointer rounded-ctl border border-line bg-white p-1.5"
                />
                <Input
                  aria-label="Color de acento en hexadecimal"
                  value={s.accent}
                  maxLength={7}
                  spellCheck={false}
                  autoCapitalize="none"
                  className="max-w-[160px]"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    set({ accent: raw && !raw.startsWith("#") ? `#${raw}` : raw });
                    setErrors((x) => ({ ...x, accent: undefined }));
                  }}
                />
              </span>
            </Field>
          </div>
        </Card>

        <Card title="Moneda">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Moneda">
              <Select value={s.currency} onChange={(e) => set({ currency: e.target.value })}>
                {!CURRENCIES.some(([code]) => code === s.currency) && <option value={s.currency}>{s.currency}</option>}
                {CURRENCIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato de números">
              <Select value={s.locale} onChange={(e) => set({ locale: e.target.value })}>
                {!LOCALES.some(([code]) => code === s.locale) && <option value={s.locale}>{s.locale}</option>}
                {LOCALES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-[15px]">
            <span className="text-ink-2">Así se ven los precios: </span>
            <span className="font-medium tabular-nums">{formatMoney(123450, s.currency, s.locale)}</span>
          </p>
          <p className="mt-3 text-[13px] leading-snug text-ink-2">
            Los precios se guardan tal cual: cambiar la moneda no convierte valores.
          </p>
        </Card>

        <Card title="Contacto y redes" description="Se muestran en el pie de página de la tienda. Deja vacío lo que no uses.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo de contacto" optional>
              <Input type="email" value={s.email} maxLength={160} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Correo de soporte" optional hint="Un segundo correo que sale en Contacto y en el pie.">
              <Input type="email" value={s.supportEmail} maxLength={160} onChange={(e) => set({ supportEmail: e.target.value })} />
            </Field>
            <Field label="Teléfono" optional>
              <Input type="tel" value={s.phone} maxLength={60} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="WhatsApp" optional hint="Con indicativo, solo números. Ej: 573001234567">
              <Input
                inputMode="numeric"
                value={s.whatsapp}
                maxLength={40}
                onChange={(e) => set({ whatsapp: e.target.value.replace(/[^\d+\s-]/g, "") })}
              />
            </Field>
            <Field label="Dirección" optional>
              <Input value={s.address} maxLength={240} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="Instagram" optional hint="El enlace completo de tu perfil.">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://instagram.com/tutienda"
                value={s.instagram}
                maxLength={240}
                onChange={(e) => set({ instagram: e.target.value })}
              />
            </Field>
            <Field label="TikTok" optional hint="El enlace completo de tu perfil.">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://tiktok.com/@tutienda"
                value={s.tiktok}
                maxLength={240}
                onChange={(e) => set({ tiktok: e.target.value })}
              />
            </Field>
            <Field label="Facebook" optional hint="El enlace completo de tu página.">
              <Input
                type="url"
                inputMode="url"
                placeholder="https://facebook.com/tutienda"
                value={s.facebook}
                maxLength={240}
                onChange={(e) => set({ facebook: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Venta y cumplimiento" description="Reglas que aplica la tienda en el checkout y textos legales.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Estados sin envío"
              className="sm:col-span-2"
              hint="Códigos de 2 letras separados por coma. No se pueden elegir en el checkout."
            >
              <Input
                value={statesText}
                onChange={(e) => setStatesText(e.target.value.toUpperCase())}
                onBlur={() => {
                  const list = [...new Set(statesText.split(/[^A-Za-z]+/).map((x) => x.trim().toUpperCase()).filter((x) => x.length === 2))];
                  set({ blockedStates: list });
                  setStatesText(list.join(", "));
                }}
              />
            </Field>
            <Field label="Aviso legal (disclaimer)" className="sm:col-span-2" hint="Sale en el pie de todas las páginas.">
              <Textarea value={s.disclaimer} rows={6} maxLength={4000} onChange={(e) => set({ disclaimer: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Verificación de edad">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Toggle
                checked={s.ageGate.enabled}
                onChange={(v) => set({ ageGate: { ...s.ageGate, enabled: v } })}
                label="Pedir confirmación de edad al entrar"
              />
            </div>
            <Field label="Edad mínima">
              <IntInput value={s.ageGate.minAge} max={25} onChange={(n) => set({ ageGate: { ...s.ageGate, minAge: Math.max(18, n ?? 21) } })} />
            </Field>
            <Field label="Título">
              <Input value={s.ageGate.title} maxLength={120} onChange={(e) => set({ ageGate: { ...s.ageGate, title: e.target.value } })} />
            </Field>
            <Field label="Texto" className="sm:col-span-2">
              <Textarea value={s.ageGate.text} rows={2} maxLength={400} onChange={(e) => set({ ageGate: { ...s.ageGate, text: e.target.value } })} />
            </Field>
          </div>
        </Card>

        <Card title="Boletín" description="El formulario de suscripción del pie de página.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Toggle checked={s.newsletter.enabled} onChange={(v) => set({ newsletter: { ...s.newsletter, enabled: v } })} label="Mostrar el boletín" />
            </div>
            <Field label="Título">
              <Input value={s.newsletter.title} maxLength={120} onChange={(e) => set({ newsletter: { ...s.newsletter, title: e.target.value } })} />
            </Field>
            <Field label="Cupón de bienvenida" optional hint="Se muestra al suscribirse. Créalo antes en Cupones.">
              <Input
                value={s.newsletter.coupon}
                maxLength={40}
                onChange={(e) => set({ newsletter: { ...s.newsletter, coupon: e.target.value.toUpperCase() } })}
              />
            </Field>
            <Field label="Texto" className="sm:col-span-2">
              <Input value={s.newsletter.text} maxLength={400} onChange={(e) => set({ newsletter: { ...s.newsletter, text: e.target.value } })} />
            </Field>
          </div>
        </Card>

        <Card title="Formularios">
          <div className="grid gap-4">
            <Field label="Texto de la página de mayoristas (/wholesale)">
              <Textarea value={s.wholesaleIntro} rows={3} maxLength={1200} onChange={(e) => set({ wholesaleIntro: e.target.value })} />
            </Field>
            <Field label="Texto de la página de contacto (/contact-us)">
              <Textarea value={s.contactIntro} rows={3} maxLength={1200} onChange={(e) => set({ contactIntro: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="Avisos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo para avisos" optional hint="A este correo llegan los pedidos nuevos.">
              <Input type="email" value={s.notifyEmail} maxLength={160} onChange={(e) => set({ notifyEmail: e.target.value })} />
            </Field>
            <Field label="Aviso de poco inventario" hint="Avisar en el inicio cuando un producto tenga estas unidades o menos.">
              <IntInput value={s.lowStock} max={999} onChange={(n) => set({ lowStock: n ?? 0 })} />
            </Field>
          </div>
        </Card>
      </div>

      <SaveBar>
        <Button loading={save.isPending} onClick={submit}>
          Guardar cambios
        </Button>
      </SaveBar>
    </>
  );
}

/* ───────────── Tu cuenta ───────────── */

function Account() {
  const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  if (!me.data) return null;
  return (
    <Card title="Tu cuenta" description="Con estos datos entras al panel.">
      <div className="grid gap-8 lg:grid-cols-2">
        <ProfileForm key={`${me.data.email}|${me.data.name}`} name={me.data.name} email={me.data.email} />
        <PasswordForm />
      </div>
    </Card>
  );
}

function ProfileForm({ name: initialName, email: initialEmail }: { name: string; email: string }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState("");

  const update = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast("Datos guardados");
      void utils.auth.me.invalidate();
    },
    onError: toastError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Escribe un correo válido.");
      return;
    }
    update.mutate({ name: name.trim(), email: email.trim() });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h3 className="text-[17px] font-semibold">Tus datos</h3>
      <Field label="Nombre" optional>
        <Input value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Correo" error={error}>
        <Input
          type="email"
          value={email}
          maxLength={191}
          autoComplete="username"
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={update.isPending}>
        Guardar datos
      </Button>
    </form>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; repeat?: string }>({});

  const change = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast("Contraseña cambiada");
      setCurrent("");
      setNext("");
      setRepeat("");
    },
    onError: toastError,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Escribe tu contraseña actual.";
    if (next.length < 8) found.next = "La nueva contraseña debe tener al menos 8 caracteres.";
    if (repeat !== next) found.repeat = "Las dos contraseñas no coinciden.";
    setErrors(found);
    if (Object.keys(found).length) return;
    change.mutate({ current, next });
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h3 className="text-[17px] font-semibold">Cambiar contraseña</h3>
      <Field label="Contraseña actual" error={errors.current}>
        <Input
          type="password"
          value={current}
          maxLength={200}
          autoComplete="current-password"
          onChange={(e) => {
            setCurrent(e.target.value);
            setErrors((x) => ({ ...x, current: undefined }));
          }}
        />
      </Field>
      <Field label="Nueva contraseña" error={errors.next} hint="Mínimo 8 caracteres.">
        <Input
          type="password"
          value={next}
          maxLength={200}
          autoComplete="new-password"
          onChange={(e) => {
            setNext(e.target.value);
            setErrors((x) => ({ ...x, next: undefined }));
          }}
        />
      </Field>
      <Field label="Repite la nueva contraseña" error={errors.repeat}>
        <Input
          type="password"
          value={repeat}
          maxLength={200}
          autoComplete="new-password"
          onChange={(e) => {
            setRepeat(e.target.value);
            setErrors((x) => ({ ...x, repeat: undefined }));
          }}
        />
      </Field>
      <Button type="submit" variant="secondary" loading={change.isPending}>
        Cambiar contraseña
      </Button>
    </form>
  );
}
