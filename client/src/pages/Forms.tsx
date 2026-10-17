import { useState, type FormEvent } from "react";
import { Check, Mail, MapPin, Phone } from "lucide-react";
import { US_STATES } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { SButton, SField, SInput, SLink, SSelect, STextarea, errorText } from "@/components/store";
import { cx } from "@/components/ui";

const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

function Sent({ title, text }: { title: string; text: string }) {
  return (
    <div role="status" className="rounded-[30px] bg-paper-2 p-8 sm:p-10">
      <span className="grid size-12 place-items-center rounded-full bg-leaf text-white">
        <Check className="size-6" strokeWidth={2.6} aria-hidden />
      </span>
      <h2 className="serif mt-6 text-[34px]">{title}</h2>
      <p className="mt-3 max-w-[44ch] text-[17px] text-navy-2">{text}</p>
      <div className="mt-7">
        <SLink href="/shop" tone="outline">
          Back to the shop
        </SLink>
      </div>
    </div>
  );
}

/* ───────────── Mayoristas ───────────── */

const CUSTOMER_TYPES = ["Consumer", "Retailer / Store", "Wholesaler"];
const VOLUMES = ["Under $1,000", "$1,000 – $5,000", "$5,000 – $15,000", "$15,000+"];

export function Wholesale() {
  const shop = useShop()!;
  const products = trpc.store.products.useQuery({ sort: "nombre" });
  const [f, setF] = useState({ first: "", last: "", email: "", phone: "", state: "", type: "", volume: "", comments: "", website: "" });
  const [interest, setInterest] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const send = trpc.store.inquiry.useMutation({
    onSuccess: () => setSent(true),
    onError: (e) => setErrors({ form: errorText(e) }),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!f.first.trim()) next.first = "Enter your first name.";
    if (!f.last.trim()) next.last = "Enter your last name.";
    if (!okEmail(f.email)) next.email = "Enter a valid email address.";
    if (f.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a phone number.";
    if (!f.state) next.state = "Choose your state.";
    if (!f.type) next.type = "Choose the option that fits you.";
    if (!f.volume) next.volume = "Choose an estimated volume.";
    setErrors(next);
    if (Object.keys(next).length) return;
    send.mutate({
      kind: "wholesale",
      name: `${f.first.trim()} ${f.last.trim()}`,
      email: f.email.trim(),
      phone: f.phone.trim(),
      message: f.comments.trim(),
      website: f.website,
      fields: {
        State: f.state,
        "Type of customer": f.type,
        "Estimated order volume": f.volume,
        "Products of interest": interest.join(", "),
      },
    });
  };

  return (
    <div className="wrap pt-10 sm:pt-16">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-[110px]">
          <h1 className="serif-xl text-[clamp(3.4rem,9vw,6.6rem)]">Wholesale</h1>
          <p className="mt-6 max-w-[44ch] text-[19px] text-navy-2">{shop.settings.wholesaleIntro}</p>
          <img src="/brand/pre-rolls.webp" alt="" className="mt-10 hidden w-full max-w-[480px] rounded-[32px] lg:block" />
        </div>

        {sent ? (
          <Sent title="Thanks — we got it." text="Our wholesale team will review your request and get back to you by email." />
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
            <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden />
            <SField label="First name" error={errors.first}>
              <SInput autoComplete="given-name" value={f.first} onChange={set("first")} />
            </SField>
            <SField label="Last name" error={errors.last}>
              <SInput autoComplete="family-name" value={f.last} onChange={set("last")} />
            </SField>
            <SField label="Email address" error={errors.email}>
              <SInput type="email" autoComplete="email" value={f.email} onChange={set("email")} />
            </SField>
            <SField label="Phone number" error={errors.phone}>
              <SInput type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} />
            </SField>
            <SField label="State" error={errors.state}>
              <SSelect value={f.state} onChange={set("state")}>
                <option value="">Choose…</option>
                {US_STATES.map(([code, name]) => (
                  <option key={code} value={name}>
                    {name}
                  </option>
                ))}
              </SSelect>
            </SField>
            <SField label="Estimated order volume" error={errors.volume}>
              <SSelect value={f.volume} onChange={set("volume")}>
                <option value="">Choose…</option>
                {VOLUMES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </SSelect>
            </SField>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-[14px] font-semibold">Type of customer</legend>
              <div className="flex flex-wrap gap-2">
                {CUSTOMER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={f.type === t}
                    onClick={() => setF((x) => ({ ...x, type: t }))}
                    className={cx(
                      "h-11 rounded-full px-5 text-[15px] font-semibold transition-colors",
                      f.type === t ? "bg-navy text-paper" : "bg-paper-2 hover:bg-paper-3",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {errors.type && <p className="mt-1.5 text-[13px] text-cherry">{errors.type}</p>}
            </fieldset>
            {(products.data?.items.length ?? 0) > 0 && (
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 flex w-full justify-between text-[14px] font-semibold">
                  Products of interest <span className="text-[13px] font-normal text-navy-3">Optional</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {products.data!.items.map((p) => {
                    const on = interest.includes(p.name);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setInterest((x) => (on ? x.filter((n) => n !== p.name) : [...x, p.name]))}
                        className={cx(
                          "h-9 rounded-full px-3.5 text-[14px] font-medium transition-colors",
                          on ? "bg-sky text-navy" : "bg-paper-2 hover:bg-paper-3",
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            <SField label="Additional comments or questions" optional className="sm:col-span-2">
              <STextarea rows={4} value={f.comments} onChange={set("comments")} maxLength={4000} />
            </SField>
            {errors.form && <p className="text-[14px] text-cherry sm:col-span-2">{errors.form}</p>}
            <div className="sm:col-span-2">
              <SButton type="submit" size="lg" loading={send.isPending}>
                Send request
              </SButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ───────────── Contacto ───────────── */

export function Contact() {
  const shop = useShop()!;
  const s = shop.settings;
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const send = trpc.store.inquiry.useMutation({
    onSuccess: () => setSent(true),
    onError: (e) => setErrors({ form: errorText(e) }),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (f.name.trim().length < 2) next.name = "Enter your name.";
    if (!okEmail(f.email)) next.email = "Enter a valid email address.";
    if (f.message.trim().length < 5) next.message = "Write a short message so we know how to help.";
    setErrors(next);
    if (Object.keys(next).length) return;
    send.mutate({
      kind: "contact",
      name: f.name.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      message: f.message.trim(),
      website: f.website,
      fields: { Company: f.company.trim() },
    });
  };

  const rows = [
    s.email && { icon: Mail, label: s.email, href: `mailto:${s.email}`, note: "Fastest replies" },
    s.supportEmail && { icon: Mail, label: s.supportEmail, href: `mailto:${s.supportEmail}`, note: "" },
    s.phone && { icon: Phone, label: s.phone, href: `tel:${s.phone.replace(/[^\d+]/g, "")}`, note: "" },
    s.address && { icon: MapPin, label: s.address, href: `https://maps.google.com/?q=${encodeURIComponent(s.address)}`, note: "" },
  ].filter(Boolean) as { icon: typeof Mail; label: string; href: string; note: string }[];

  return (
    <div className="wrap pt-10 sm:pt-16">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div>
          <h1 className="serif-xl text-[clamp(3.4rem,9vw,6.6rem)]">Contact us</h1>
          <p className="mt-6 max-w-[42ch] text-[19px] text-navy-2">{s.contactIntro}</p>
          <ul className="mt-10 space-y-5">
            {rows.map((r) => (
              <li key={r.label}>
                <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="group flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-2 text-sky-ink group-hover:bg-sun group-hover:text-navy">
                    <r.icon className="size-5" aria-hidden />
                  </span>
                  <span className="pt-2.5">
                    <span className="block text-[17px] font-semibold group-hover:underline">{r.label}</span>
                    {r.note && <span className="block text-[14px] text-navy-2">{r.note}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {sent ? (
          <Sent title="Message sent." text="Thanks for reaching out. We usually reply within one business day." />
        ) : (
          <form onSubmit={submit} noValidate className="grid gap-4 rounded-[32px] bg-paper-2 p-6 sm:grid-cols-2 sm:p-9">
            <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} className="hidden" aria-hidden />
            <SField label="Full name" error={errors.name}>
              <SInput autoComplete="name" value={f.name} onChange={set("name")} />
            </SField>
            <SField label="Email address" error={errors.email}>
              <SInput type="email" autoComplete="email" value={f.email} onChange={set("email")} />
            </SField>
            <SField label="Phone number" optional>
              <SInput type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} />
            </SField>
            <SField label="Company" optional>
              <SInput autoComplete="organization" value={f.company} onChange={set("company")} />
            </SField>
            <SField label="Message" error={errors.message} className="sm:col-span-2">
              <STextarea rows={6} value={f.message} onChange={set("message")} maxLength={5000} />
            </SField>
            {errors.form && <p className="text-[14px] text-cherry sm:col-span-2">{errors.form}</p>}
            <div className="sm:col-span-2">
              <SButton type="submit" size="lg" loading={send.isPending}>
                Send message
              </SButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
