import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Check, Lock } from "lucide-react";
import { US_STATES } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useMoney, useShop } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { useCartDetails } from "@/lib/useCartDetails";
import { CartLineRow } from "@/components/CartDrawer";
import { Empty, Loading, SButton, SField, SInput, SLink, SSelect, STextarea, errorText } from "@/components/store";
import { cx, toast } from "@/components/ui";

const FORM_KEY = "potted.checkout.v1";
const EMPTY = {
  name: "",
  email: "",
  phone: "",
  address: "",
  addressExtra: "",
  city: "",
  region: "",
  postalCode: "",
  notes: "",
};
type Form = typeof EMPTY;
type ErrKey = keyof Form | "shipping" | "payment" | "age";

function loadForm(): Form {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(FORM_KEY) ?? "{}"), notes: "" };
  } catch {
    return EMPTY;
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-paper-3 pt-8">
      <h2 className="serif text-[30px]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  text,
  aside,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  text?: string;
  aside?: ReactNode;
  name: string;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer items-center gap-4 rounded-[18px] bg-paper-2 px-5 py-4 transition-shadow duration-150",
        selected ? "shadow-[0_0_0_2px_var(--color-navy)]" : "shadow-[0_0_0_1px_var(--color-paper-3)] hover:shadow-[0_0_0_1.5px_var(--color-navy-3)]",
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        aria-hidden
        className={cx(
          "grid size-[22px] shrink-0 place-items-center rounded-full transition-colors",
          selected ? "bg-navy text-paper" : "shadow-[inset_0_0_0_1.5px_var(--color-paper-3)]",
        )}
      >
        {selected && <Check className="size-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{title}</span>
        {text && <span className="block text-[14px] leading-snug text-navy-2">{text}</span>}
      </span>
      {aside && <span className="shrink-0 text-[15px] font-semibold tabular-nums">{aside}</span>}
    </label>
  );
}

export default function Checkout() {
  const money = useMoney();
  const shop = useShop()!;
  const blocked = shop.settings.blockedStates;
  const [, navigate] = useLocation();
  const { rows, subtotal, loading, hasProblems, refetch } = useCartDetails();
  const options = trpc.store.checkoutOptions.useQuery();

  const [form, setForm] = useState<Form>(loadForm);
  const [errors, setErrors] = useState<Partial<Record<ErrKey, string>>>({});
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [age, setAge] = useState(false);
  const [couponText, setCouponText] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; type: string; value: number } | null>(null);
  const [placed, setPlaced] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(FORM_KEY, JSON.stringify({ ...form, notes: "" }));
    } catch {
      /* almacenamiento bloqueado */
    }
  }, [form]);

  useEffect(() => {
    if (!options.data) return;
    setShippingId((cur) => cur ?? options.data.shipping[0]?.id ?? null);
    setPaymentId((cur) => cur ?? options.data.payment[0]?.id ?? null);
  }, [options.data]);

  const discount = useMemo(() => {
    if (!coupon) return 0;
    return coupon.type === "porcentaje"
      ? Math.round((subtotal * Math.min(100, coupon.value)) / 100)
      : Math.min(subtotal, coupon.value);
  }, [coupon, subtotal]);

  const shipCost = (s: { price: number; freeOver: number | null }) =>
    s.freeOver !== null && subtotal - discount >= s.freeOver ? 0 : s.price;
  const shipping = options.data?.shipping.find((s) => s.id === shippingId);
  const payment = options.data?.payment.find((p) => p.id === paymentId);
  const shippingCost = shipping ? shipCost(shipping) : 0;
  const total = Math.max(0, subtotal - discount) + shippingCost;

  const applyCoupon = trpc.store.coupon.useMutation({
    onSuccess: (c) => {
      setCoupon({ code: c.code, type: c.type, value: c.value });
      setCouponText("");
      toast(`Coupon ${c.code} applied`);
    },
    onError: (e) => toast(errorText(e), "error"),
  });

  const create = trpc.store.createOrder.useMutation({
    onSuccess: ({ token }) => {
      setPlaced(true);
      cart.clear();
      navigate(`/order/${token}?new=1`);
    },
    onError: (err) => {
      toast(errorText(err), "error");
      void refetch();
    },
  });

  const set = (key: keyof Form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((x) => ({ ...x, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.name.trim().length < 3) next.name = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a phone number.";
    if (form.address.trim().length < 4) next.address = "Enter your street address.";
    if (form.city.trim().length < 2) next.city = "Enter your city.";
    if (!form.region) next.region = "Choose your state.";
    else if (blocked.includes(form.region)) next.region = `We can’t ship to ${form.region}.`;
    if (!/^\d{5}(-\d{4})?$/.test(form.postalCode.trim())) next.postalCode = "Enter a 5-digit ZIP code.";
    if (!shippingId) next.shipping = "Choose a shipping method.";
    if (!paymentId) next.payment = "Choose a payment method.";
    if (!age) next.age = `Please confirm you are ${shop.settings.ageGate.minAge} or older.`;
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`f-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    create.mutate({
      items: rows.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
      customer: { ...form, email: form.email.trim(), postalCode: form.postalCode.trim(), document: "", country: "United States" },
      shippingMethodId: shippingId!,
      paymentMethodId: paymentId!,
      couponCode: coupon?.code ?? "",
      ageConfirmed: true,
    });
  };

  if (loading || options.isLoading) return <Loading />;
  if (rows.length === 0 && !placed) {
    return (
      <div className="wrap pt-10">
        <Empty title="Your cart is empty" text="Add something you love before checking out.">
          <SLink href="/shop">Shop all products</SLink>
        </Empty>
      </div>
    );
  }

  return (
    <div className="wrap pt-10 sm:pt-14">
      <h1 className="serif-xl text-[clamp(3.2rem,8vw,6rem)]">Checkout</h1>

      <form onSubmit={submit} noValidate className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-x-[5vw] gap-y-10 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-10">
          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <SField label="Full name" error={errors.name} className="sm:col-span-2">
                <SInput id="f-name" autoComplete="name" value={form.name} onChange={set("name")} />
              </SField>
              <SField label="Email" error={errors.email} hint="We’ll send your receipt and tracking here.">
                <SInput id="f-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} />
              </SField>
              <SField label="Phone" error={errors.phone}>
                <SInput id="f-phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set("phone")} />
              </SField>
            </div>
          </Section>

          <Section title="Shipping address">
            <div className="grid gap-4 sm:grid-cols-6">
              <SField label="Street address" error={errors.address} className="sm:col-span-6">
                <SInput id="f-address" autoComplete="address-line1" value={form.address} onChange={set("address")} />
              </SField>
              <SField label="Apartment, suite, etc." optional className="sm:col-span-6">
                <SInput autoComplete="address-line2" value={form.addressExtra} onChange={set("addressExtra")} />
              </SField>
              <SField label="City" error={errors.city} className="sm:col-span-3">
                <SInput id="f-city" autoComplete="address-level2" value={form.city} onChange={set("city")} />
              </SField>
              <SField label="State" error={errors.region} className="sm:col-span-2">
                <SSelect id="f-region" autoComplete="address-level1" value={form.region} onChange={set("region")}>
                  <option value="">Choose…</option>
                  {US_STATES.map(([code, name]) => (
                    <option key={code} value={code} disabled={blocked.includes(code)}>
                      {name}
                      {blocked.includes(code) ? " (no shipping)" : ""}
                    </option>
                  ))}
                </SSelect>
              </SField>
              <SField label="ZIP code" error={errors.postalCode} className="sm:col-span-1">
                <SInput id="f-postalCode" autoComplete="postal-code" inputMode="numeric" value={form.postalCode} onChange={set("postalCode")} />
              </SField>
            </div>
            {blocked.length > 0 && (
              <p className="mt-3 text-[14px] text-navy-2">
                We ship within the United States. THCA products can’t ship to {blocked.join(", ")}.
              </p>
            )}
          </Section>

          <Section title="Shipping method">
            <div id="f-shipping" className="space-y-3" role="radiogroup" aria-label="Shipping method">
              {options.data?.shipping.length === 0 && (
                <p className="text-[15px] text-navy-2">No shipping methods are available right now. Contact us to complete your order.</p>
              )}
              {options.data?.shipping.map((s) => {
                const cost = shipCost(s);
                return (
                  <OptionCard
                    key={s.id}
                    name="shipping"
                    selected={s.id === shippingId}
                    onSelect={() => setShippingId(s.id)}
                    title={s.name}
                    text={[s.eta, s.description].filter(Boolean).join(". ")}
                    aside={cost === 0 ? "Free" : money(cost)}
                  />
                );
              })}
              {errors.shipping && <p className="text-[14px] text-cherry">{errors.shipping}</p>}
            </div>
          </Section>

          <Section title="Payment">
            <div id="f-payment" className="space-y-3" role="radiogroup" aria-label="Payment method">
              {options.data?.payment.length === 0 && (
                <p className="text-[15px] text-navy-2">
                  Online payment isn’t available right now. Email us at{" "}
                  <a className="font-semibold underline" href={`mailto:${shop.settings.email}`}>
                    {shop.settings.email}
                  </a>{" "}
                  to place your order.
                </p>
              )}
              {options.data?.payment.map((p) => (
                <OptionCard
                  key={p.id}
                  name="payment"
                  selected={p.id === paymentId}
                  onSelect={() => setPaymentId(p.id)}
                  title={p.name}
                  text={p.description}
                />
              ))}
              {errors.payment && <p className="text-[14px] text-cherry">{errors.payment}</p>}
              <p className="pt-1 text-[14px] text-navy-2">
                {payment?.provider === "paypal"
                  ? "After you place the order you’ll pay securely with PayPal on the next screen."
                  : "After you place the order you’ll see how to pay. We ship once your payment is confirmed."}
              </p>
            </div>
          </Section>

          <Section title="Order notes">
            <SField optional label="Anything we should know about delivery?">
              <STextarea rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} />
            </SField>
          </Section>
        </div>

        <aside className="rounded-[30px] bg-paper-2 p-6 sm:p-7 lg:sticky lg:top-[96px]" aria-label="Order summary">
          <h2 className="serif text-[26px]">Your order</h2>
          <ul className="mt-2 divide-y divide-paper-3 [&_.bg-paper-2]:bg-paper">
            {rows.map((r) => (
              <CartLineRow key={r.variantId} row={r} compact />
            ))}
          </ul>

          <div className="mt-2 border-t border-paper-3 pt-5">
            {coupon ? (
              <div className="flex items-center justify-between rounded-[14px] bg-paper px-4 py-3 text-[15px]">
                <span>
                  Coupon <strong className="font-semibold">{coupon.code}</strong> applied
                </span>
                <button type="button" onClick={() => setCoupon(null)} className="text-[14px] text-navy-2 underline underline-offset-4 hover:text-navy">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <SInput
                  aria-label="Coupon code"
                  placeholder="Coupon code"
                  value={couponText}
                  onChange={(e) => setCouponText(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (couponText.trim()) applyCoupon.mutate({ code: couponText, subtotal });
                    }
                  }}
                />
                <SButton
                  tone="outline"
                  className="h-12"
                  loading={applyCoupon.isPending}
                  disabled={!couponText.trim()}
                  onClick={() => applyCoupon.mutate({ code: couponText, subtotal })}
                >
                  Apply
                </SButton>
              </div>
            )}
          </div>

          <dl className="mt-5 space-y-2 text-[15px]">
            <div className="flex justify-between">
              <dt className="text-navy-2">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-navy-2">Discount</dt>
                <dd className="tabular-nums text-leaf">−{money(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-navy-2">Shipping</dt>
              <dd className="tabular-nums">{!shipping ? "—" : shippingCost === 0 ? "Free" : money(shippingCost)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-paper-3 pt-4">
              <dt className="text-[17px] font-semibold">Total</dt>
              <dd className="serif text-[32px] tabular-nums">{money(total)}</dd>
            </div>
          </dl>

          <label id="f-age" className="mt-6 flex cursor-pointer items-start gap-3 text-[14.5px] leading-snug">
            <input
              type="checkbox"
              checked={age}
              onChange={(e) => {
                setAge(e.target.checked);
                if (errors.age) setErrors((x) => ({ ...x, age: undefined }));
              }}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-navy)]"
            />
            <span>
              I confirm I am {shop.settings.ageGate.minAge} or older and that these products are legal where I live.
            </span>
          </label>
          {errors.age && <p className="mt-2 text-[14px] text-cherry">{errors.age}</p>}

          <SButton type="submit" size="lg" className="mt-6 w-full" loading={create.isPending} disabled={hasProblems || rows.length === 0}>
            <Lock className="size-4" aria-hidden />
            {payment?.provider === "paypal" ? "Place order and pay" : "Place order"}
          </SButton>
          {hasProblems && <p className="mt-3 text-[14px] text-cherry">Adjust the items marked in red to continue.</p>}
        </aside>
      </form>
    </div>
  );
}
