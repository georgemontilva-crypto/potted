import { Resend } from "resend";
import { ORDER_STATUS_LABEL_EN, formatMoney, type OrderStatus } from "../shared/types";
import { env } from "./env";
import { getSettings } from "./settings";
import type { schema } from "./db";

type Order = typeof schema.orders.$inferSelect;
type Item = typeof schema.orderItems.$inferSelect;

let resend: Resend | null = null;
const client = () => (resend ??= new Resend(env.resendKey));

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function send(to: string, subject: string, html: string) {
  if (!env.resendKey || !env.emailFrom || !to) return;
  try {
    const { error } = await client().emails.send({ from: env.emailFrom, to, subject, html });
    if (error) console.warn("Resend rechazó el correo:", error.message);
  } catch (err) {
    console.warn("No se pudo enviar el correo:", (err as Error).message);
  }
}

function layout(storeName: string, title: string, body: string, cta?: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f6f1e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#15233a">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <p style="font-size:18px;font-weight:600;letter-spacing:-0.01em;margin:0 0 20px">${esc(storeName)}</p>
    <div style="background:#fff;border-radius:24px;padding:32px">
      <h1 style="font-size:26px;line-height:1.15;letter-spacing:-0.02em;margin:0 0 16px">${esc(title)}</h1>
      ${body}
      ${
        cta
          ? `<p style="margin:28px 0 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#15233a;color:#fff;text-decoration:none;border-radius:999px;padding:13px 24px;font-size:15px">${esc(cta.label)}</a></p>`
          : ""
      }
    </div>
  </div></body></html>`;
}

function itemsTable(order: Order, items: Item[], locale: string, es = false) {
  const m = (c: number) => formatMoney(c, order.currency, locale);
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:15px">${esc(i.name)}<br>
          <span style="color:#6e6e73;font-size:13px">${esc([i.color, i.size].filter(Boolean).join(" / "))} × ${i.quantity}</span></td>
        <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:15px;text-align:right;white-space:nowrap">${m(i.price * i.quantity)}</td>
      </tr>`,
    )
    .join("");
  const line = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;font-size:15px;${bold ? "font-weight:600" : "color:#6e6e73"}">${label}</td><td style="padding:6px 0;font-size:15px;text-align:right;${bold ? "font-weight:600" : ""}">${value}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${rows}
    ${line("Subtotal", m(order.subtotal))}
    ${order.discount > 0 ? line(`${es ? "Descuento" : "Discount"} ${esc(order.couponCode)}`, `−${m(order.discount)}`) : ""}
    ${line(`${es ? "Envío" : "Shipping"} (${esc(order.shippingMethod)})`, order.shippingCost === 0 ? (es ? "Gratis" : "Free") : m(order.shippingCost))}
    ${line("Total", m(order.total), true)}
  </table>`;
}

const trackUrl = (order: Order) => `${env.publicUrl}/order/${order.token}`;

export async function sendOrderCreated(order: Order, items: Item[]) {
  const s = await getSettings();
  const paypal = order.paymentProvider === "paypal";
  const pay =
    !paypal && order.paymentInstructions
      ? `<div style="background:#f6f1e7;border-radius:16px;padding:16px;margin:20px 0 0;font-size:14px;line-height:1.5;white-space:pre-line"><strong>${esc(order.paymentMethod)}</strong>\n${esc(order.paymentInstructions)}</div>`
      : "";
  const next = paypal
    ? " If you didn’t finish paying with PayPal, you can complete the payment from the link below."
    : order.paymentRequiresProof
      ? " Once you’ve paid, upload your receipt from the order link below."
      : "";
  const body = `<p style="font-size:15px;line-height:1.5;color:#4b5568;margin:0 0 8px">Hi ${esc(order.customerName.split(" ")[0] ?? "")}, we received your order <strong style="color:#15233a">${esc(order.number)}</strong>.${next}</p>${itemsTable(order, items, s.locale)}${pay}`;
  await send(
    order.customerEmail,
    `We received your order ${order.number}`,
    layout(s.storeName, "Thanks for your order", body, env.publicUrl ? { label: "View my order", href: trackUrl(order) } : undefined),
  );

  if (s.notifyEmail) {
    const adminBody = `<p style="font-size:15px;line-height:1.5;color:#4b5568;margin:0 0 8px">${esc(order.customerName)} · ${esc(order.customerEmail)} · ${esc(order.customerPhone)}<br>${esc([order.address, order.addressExtra, order.city, order.region, order.postalCode].filter(Boolean).join(", "))}<br>Pago: ${esc(order.paymentMethod)}</p>${itemsTable(order, items, s.locale, true)}`;
    await send(
      s.notifyEmail,
      `Nuevo pedido ${order.number} · ${formatMoney(order.total, order.currency, s.locale)}`,
      layout(s.storeName, `Nuevo pedido ${order.number}`, adminBody, env.publicUrl ? { label: "Abrir en el panel", href: `${env.publicUrl}/admin/pedidos/${order.id}` } : undefined),
    );
  }
}

const STATUS_COPY: Partial<Record<OrderStatus, { title: string; text: string }>> = {
  pagado: { title: "Payment confirmed", text: "We’re getting your order ready." },
  preparando: { title: "We’re preparing your order", text: "We’ll let you know as soon as it ships." },
  enviado: { title: "Your order is on its way", text: "It just left our warehouse." },
  entregado: { title: "Your order was delivered", text: "Enjoy the vibe." },
  cancelado: { title: "Your order was cancelled", text: "If you think this is a mistake, just reply to this email." },
};

export async function sendOrderStatus(order: Order) {
  const copy = STATUS_COPY[order.status as OrderStatus];
  if (!copy) return;
  const s = await getSettings();
  const tracking =
    order.status === "enviado" && order.trackingNumber
      ? `<p style="font-size:15px;line-height:1.5;margin:12px 0 0">Tracking number: <strong>${esc(order.trackingNumber)}</strong>${
          order.trackingUrl ? ` · <a href="${esc(order.trackingUrl)}" style="color:#15233a">Track package</a>` : ""
        }</p>`
      : "";
  const body = `<p style="font-size:15px;line-height:1.5;color:#4b5568;margin:0">Order <strong style="color:#15233a">${esc(order.number)}</strong> — ${esc(ORDER_STATUS_LABEL_EN[order.status as OrderStatus])}. ${copy.text}</p>${tracking}`;
  await send(
    order.customerEmail,
    `${copy.title} · ${order.number}`,
    layout(s.storeName, copy.title, body, env.publicUrl ? { label: "View my order", href: trackUrl(order) } : undefined),
  );
}

export async function sendProofReceived(order: Order) {
  const s = await getSettings();
  if (!s.notifyEmail) return;
  await send(
    s.notifyEmail,
    `Comprobante recibido · ${order.number}`,
    layout(
      s.storeName,
      `Comprobante del pedido ${order.number}`,
      `<p style="font-size:15px;line-height:1.5;color:#4b5568;margin:0">${esc(order.customerName)} subió el comprobante de pago. Revísalo y confirma el pago en el panel.</p>`,
      env.publicUrl ? { label: "Abrir en el panel", href: `${env.publicUrl}/admin/pedidos/${order.id}` } : undefined,
    ),
  );
}

/** Aviso al equipo cuando llega un mensaje de contacto o de mayoristas. */
export async function sendInquiryNotice(kind: string, name: string, email: string, lines: [string, string][]) {
  const s = await getSettings();
  const to = s.notifyEmail || s.email;
  if (!to) return;
  const rows = lines
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#4b5568;font-size:14px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:14px;white-space:pre-line">${esc(v)}</td></tr>`,
    )
    .join("");
  await send(
    to,
    `${kind === "wholesale" ? "Solicitud mayorista" : "Nuevo mensaje"} · ${name}`,
    layout(
      s.storeName,
      kind === "wholesale" ? "Nueva solicitud mayorista" : "Nuevo mensaje de contacto",
      `<p style="font-size:15px;margin:0 0 12px">${esc(name)} · <a href="mailto:${esc(email)}" style="color:#15233a">${esc(email)}</a></p><table cellpadding="0" cellspacing="0">${rows}</table>`,
      env.publicUrl ? { label: "Abrir en el panel", href: `${env.publicUrl}/admin/mensajes` } : undefined,
    ),
  );
}
