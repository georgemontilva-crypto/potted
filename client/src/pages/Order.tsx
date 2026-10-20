import { useEffect, useRef, useState } from "react";
import { useParams, useSearch } from "wouter";
import { Check, FileUp } from "lucide-react";
import { ORDER_STATUS_LABEL_EN, ORDER_TRACK_STEPS, formatMoney, type OrderStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useShop } from "@/lib/shop";
import { Empty, Loading, SButton, SLink, errorText, fmtDate } from "@/components/store";
import { cx, toast, uploadFile } from "@/components/ui";

const STEP_SHORT: Record<OrderStatus, string> = {
  pendiente: "Received",
  pagado: "Paid",
  preparando: "Preparing",
  enviado: "Shipped",
  entregado: "Delivered",
  cancelado: "Cancelled",
};

function Steps({ status }: { status: OrderStatus }) {
  const current = ORDER_TRACK_STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-5 gap-1 sm:gap-2" aria-label="Order status">
      {ORDER_TRACK_STEPS.map((s, i) => {
        const done = i <= current;
        return (
          <li key={s} aria-current={i === current ? "step" : undefined}>
            <div className={cx("h-2 rounded-full transition-colors", done ? "bg-sky" : "bg-paper-3")} />
            <p className={cx("mt-3 text-[12px] leading-tight sm:text-[14px]", done ? "font-semibold text-navy" : "text-navy-3")}>
              {STEP_SHORT[s]}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────── Botones de PayPal ───────────── */

type PaypalNS = {
  Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void>; close?: () => void; isEligible?: () => boolean };
};
declare global {
  interface Window {
    paypal?: PaypalNS;
  }
}

let sdkPromise: Promise<PaypalNS> | null = null;
function loadPaypal(clientId: string, currency: string) {
  sdkPromise ??= new Promise<PaypalNS>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${currency}&intent=capture&components=buttons&enable-funding=venmo,paylater`;
    s.async = true;
    s.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal didn’t load.")));
    s.onerror = () => {
      sdkPromise = null;
      reject(new Error("PayPal couldn’t load. Check your connection or disable ad blockers and reload."));
    };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

function PaypalButtons({ token, currency, onPaid }: { token: string; currency: string; onPaid: () => void }) {
  const cfg = trpc.store.paypalConfig.useQuery(undefined, { staleTime: Infinity });
  const create = trpc.store.paypalCreate.useMutation();
  const capture = trpc.store.paypalCapture.useMutation();
  const box = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cfg.data?.enabled || !box.current) return;
    let cancelled = false;
    let instance: { close?: () => void } | null = null;
    loadPaypal(cfg.data.clientId, currency)
      .then((paypal) => {
        if (cancelled || !box.current) return;
        box.current.innerHTML = "";
        const buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "pill", color: "gold", label: "pay", height: 50 },
          createOrder: async () => {
            setError("");
            const r = await create.mutateAsync({ token });
            return r.id;
          },
          onApprove: async (data: { orderID: string }, actions: { restart?: () => void }) => {
            setBusy(true);
            try {
              const r = await capture.mutateAsync({ token, paypalOrderId: data.orderID });
              if (r.status === "declined" && actions.restart) {
                actions.restart();
                return;
              }
              if (r.status === "paid") {
                toast("Payment received. Thank you!");
              } else {
                setError("Your payment is being reviewed. We’ll email you as soon as it’s confirmed.");
              }
              onPaid();
            } catch (e) {
              setError(errorText(e));
            } finally {
              setBusy(false);
            }
          },
          onError: (e: unknown) => setError(errorText(e, "PayPal had a problem. Please try again.")),
        });
        instance = buttons;
        void buttons.render(box.current);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      instance?.close?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.data?.enabled, cfg.data?.clientId, token, currency]);

  if (cfg.isLoading) return null;
  if (!cfg.data?.enabled) {
    return <p className="mt-5 text-[15px] text-navy-2">Online payment isn’t available right now. Contact us and we’ll help you finish your order.</p>;
  }
  return (
    <div className="mt-6 max-w-[420px]">
      {busy && <p className="mb-3 text-[15px] font-semibold">Confirming your payment…</p>}
      <div ref={box} className={cx(busy && "pointer-events-none opacity-50")} />
      {error && (
        <p role="alert" className="mt-3 text-[14px] text-cherry">
          {error}
        </p>
      )}
    </div>
  );
}

export default function Order() {
  const shop = useShop()!;
  const { token } = useParams<{ token: string }>();
  const isNew = new URLSearchParams(useSearch()).get("new") === "1";
  const q = trpc.store.order.useQuery({ token: token ?? "" }, { refetchOnWindowFocus: true });
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  if (q.isLoading) return <Loading />;
  const o = q.data;
  if (!o) {
    return (
      <div className="wrap pt-10">
        <Empty title="We couldn’t find that order" text="Check the link, or look it up with your order number and email.">
          <SLink href="/track">Find my order</SLink>
        </Empty>
      </div>
    );
  }

  const money = (c: number) => formatMoney(c, o.currency, shop.settings.locale);
  const firstName = o.customerName.split(" ")[0];
  const cancelled = o.status === "cancelado";
  const pending = o.status === "pendiente" && !o.paid;
  const isPaypal = o.paymentProvider === "paypal";
  const isPdf = o.paymentProofUrl.toLowerCase().endsWith(".pdf");

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      await uploadFile(f, "/api/upload/comprobante", { token: o.token });
      toast("Receipt uploaded");
      await q.refetch();
    } catch (err) {
      toast(errorText(err), "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="wrap max-w-[1080px] pt-10 sm:pt-14">
      <header>
        <p className="text-[16px] font-semibold text-sky-ink">Order {o.number}</p>
        <h1 className="serif-xl mt-3 text-[clamp(3rem,8vw,5.6rem)]">
          {cancelled
            ? "This order was cancelled."
            : pending && isPaypal
              ? "One last step."
              : isNew
                ? `Thanks, ${firstName}.`
                : `${ORDER_STATUS_LABEL_EN[o.status]}.`}
        </h1>
        <p className="mt-5 max-w-[56ch] text-[19px] text-navy-2">
          {cancelled
            ? "If you think this is a mistake, contact us with your order number."
            : pending && isPaypal
              ? `Pay ${money(o.total)} with PayPal to confirm your order. We saved it for you and sent the details to ${o.customerEmail}.`
              : isNew
                ? `We received your order and sent a confirmation to ${o.customerEmail}.`
                : `Placed on ${fmtDate(o.createdAt, true)}.`}
        </p>
      </header>

      {!cancelled && (
        <div className="mt-10">
          <Steps status={o.status} />
        </div>
      )}

      <div className="mt-12 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {pending && (
            <section className="rounded-[30px] bg-paper-2 p-6 sm:p-8" aria-labelledby="pay">
              <h2 id="pay" className="serif text-[30px]">
                {isPaypal ? "Pay with PayPal" : o.paymentRequiresProof ? "Pay and upload your receipt" : "How to pay"}
              </h2>
              <p className="mt-2 text-[16px] text-navy-2">
                {o.paymentMethod}. Total due: <strong className="font-semibold text-navy">{money(o.total)}</strong>
              </p>
              {isPaypal ? (
                <PaypalButtons token={o.token} currency={o.currency} onPaid={() => void q.refetch()} />
              ) : (
                <>
                  {o.paymentInstructions && (
                    <p className="mt-5 whitespace-pre-line rounded-[18px] bg-paper p-5 text-[15px] leading-relaxed">{o.paymentInstructions}</p>
                  )}
                  {o.paymentRequiresProof && (
                    <div className="mt-5">
                      <input
                        ref={file}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          void onFile(e.target.files?.[0]);
                          e.target.value = "";
                        }}
                      />
                      {o.paymentProofUrl ? (
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                          <p className="flex items-center gap-2.5 text-[16px] font-semibold">
                            <span className="grid size-6 place-items-center rounded-full bg-leaf text-night">
                              <Check className="size-3.5" strokeWidth={3} aria-hidden />
                            </span>
                            We got your receipt
                          </p>
                          <a href={o.paymentProofUrl} target="_blank" rel="noreferrer" className="text-[15px] text-navy-2 underline underline-offset-4 hover:text-navy">
                            {isPdf ? "Open PDF" : "View image"}
                          </a>
                          <button type="button" onClick={() => file.current?.click()} className="text-[15px] text-navy-2 underline underline-offset-4 hover:text-navy">
                            Replace file
                          </button>
                          <p className="w-full text-[14px] text-navy-2">We’ll review it and email you once your payment is confirmed.</p>
                        </div>
                      ) : (
                        <>
                          <SButton size="lg" loading={uploading} onClick={() => file.current?.click()}>
                            {!uploading && <FileUp className="size-[18px]" aria-hidden />}
                            Upload receipt
                          </SButton>
                          <p className="mt-3 text-[14px] text-navy-2">Photo or PDF, up to 15 MB. You can come back to this page any time.</p>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {o.trackingNumber && (
            <section className="rounded-[30px] bg-paper-2 p-6 sm:p-8" aria-labelledby="ship">
              <h2 id="ship" className="serif text-[30px]">
                Your shipment
              </h2>
              <p className="mt-2 text-[16px] text-navy-2">
                {o.shippingMethod}. Tracking number: <strong className="font-semibold text-navy">{o.trackingNumber}</strong>
              </p>
              {o.trackingUrl && (
                <div className="mt-5">
                  <SLink href={o.trackingUrl}>Track package</SLink>
                </div>
              )}
            </section>
          )}

          <section className="rounded-[30px] p-6 shadow-[inset_0_0_0_1px_var(--color-paper-3)] sm:p-8" aria-labelledby="items">
            <h2 id="items" className="serif text-[30px]">
              What you ordered
            </h2>
            <ul className="mt-3 divide-y divide-paper-3">
              {o.items.map((i, n) => (
                <li key={n} className="flex items-center gap-4 py-4">
                  <span className="size-[76px] shrink-0 overflow-hidden rounded-[16px] bg-paper-2">
                    {i.imageUrl && <img src={i.imageUrl} alt="" className="size-full object-contain p-1.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="serif block truncate text-[18px]">{i.name}</span>
                    <span className="block text-[14px] text-navy-2">
                      {[i.color, i.size].filter(Boolean).join(", ")}
                      {i.color || i.size ? ". " : ""}Qty {i.quantity}
                    </span>
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums">{money(i.price * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-2 border-t border-paper-3 pt-5 text-[15px]">
              <div className="flex justify-between">
                <dt className="text-navy-2">Subtotal</dt>
                <dd className="tabular-nums">{money(o.subtotal)}</dd>
              </div>
              {o.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-navy-2">Discount {o.couponCode}</dt>
                  <dd className="tabular-nums text-leaf">−{money(o.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-navy-2">Shipping</dt>
                <dd className="tabular-nums">{o.shippingCost === 0 ? "Free" : money(o.shippingCost)}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-2">
                <dt className="text-[17px] font-semibold">Total</dt>
                <dd className="serif text-[30px] tabular-nums">{money(o.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[30px] bg-paper-2 p-6">
            <h2 className="serif text-[22px]">Shipping to</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-navy-2">
              {o.customerName}
              <br />
              {o.address}
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-navy-2">
              <span className="font-semibold text-navy">{o.shippingMethod}</span>
              {o.shippingEta && (
                <>
                  <br />
                  {o.shippingEta}
                </>
              )}
            </p>
          </section>

          <section className="rounded-[30px] bg-paper-2 p-6">
            <h2 className="serif text-[22px]">History</h2>
            <ol className="mt-3 space-y-3.5">
              {[...o.events].reverse().map((e, i) => (
                <li key={i} className="text-[15px] leading-snug">
                  <span className="font-semibold">{ORDER_STATUS_LABEL_EN[e.status as OrderStatus] ?? e.status}</span>
                  <span className="block text-[13px] text-navy-2">{fmtDate(e.createdAt, true)}</span>
                </li>
              ))}
            </ol>
          </section>

          <SLink href="/shop" tone="outline" className="w-full">
            Keep shopping
          </SLink>
        </aside>
      </div>
    </div>
  );
}
