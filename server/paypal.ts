import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "./db";
import { env, paypalEnabled } from "./env";
import { changeOrderStatus, loadOrder } from "./orders";
import { sendOrderStatus } from "./email";
import { fail } from "./trpc";

const { orders } = schema;
const base = () =>
  process.env.PAYPAL_API_BASE || (env.paypal.live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");

let cached: { token: string; until: number } | null = null;

async function accessToken() {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.paypal.clientId}:${env.paypal.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) {
    console.error("PayPal rechazó las credenciales:", res.status, await res.text().catch(() => ""));
    throw fail("PayPal is not available right now. Please try again in a moment.", "INTERNAL_SERVER_ERROR");
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, until: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: T }> {
  const token = await accessToken();
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

const dollars = (cents: number) => (cents / 100).toFixed(2);

type PaypalOrder = {
  id: string;
  status: string;
  purchase_units?: {
    payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] };
  }[];
};

async function pendingPaypalOrder(token: string) {
  const [o] = await db.select().from(orders).where(eq(orders.token, token)).limit(1);
  if (!o) throw fail("We couldn’t find that order.", "NOT_FOUND");
  if (o.paymentProvider !== "paypal") throw fail("This order is not paid with PayPal.");
  return o;
}

/** Crea la orden en PayPal por el total del pedido. */
export async function createPaypalOrder(token: string) {
  if (!paypalEnabled) throw fail("PayPal is not configured yet. Please contact us to complete your order.");
  const o = await pendingPaypalOrder(token);
  if (o.status !== "pendiente") throw fail("This order is no longer awaiting payment.");

  const { ok, data, status } = await api<PaypalOrder & { message?: string }>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `create-${o.token.slice(0, 24)}-${o.total}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: o.number,
          invoice_id: o.number,
          custom_id: String(o.id),
          description: `Order ${o.number}`,
          amount: { currency_code: o.currency, value: dollars(o.total) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: { shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW", brand_name: "PotTed" },
        },
      },
    }),
  });
  if (!ok) {
    console.error("PayPal no creó la orden:", status, JSON.stringify(data));
    throw fail("PayPal couldn’t start the payment. Please try again.");
  }
  await db.update(orders).set({ paypalOrderId: data.id }).where(eq(orders.id, o.id));
  return { id: data.id };
}

/** Marca el pedido como pagado si PayPal confirma el cobro completo. */
async function settle(orderId: number, paypal: PaypalOrder) {
  const data = await loadOrder(eq(orders.id, orderId));
  if (!data) return { status: "missing" as const };
  const o = data.order;
  const capture = paypal.purchase_units?.[0]?.payments?.captures?.find((c) => c.status === "COMPLETED");
  if (!capture) return { status: "not_completed" as const };
  if (capture.amount.currency_code !== o.currency || capture.amount.value !== dollars(o.total)) {
    console.error(`PayPal cobró un monto distinto en ${o.number}: ${capture.amount.value} ${capture.amount.currency_code}`);
    await db
      .update(orders)
      .set({ paypalCaptureId: capture.id, adminNotes: `${o.adminNotes}\n⚠ PayPal cobró ${capture.amount.value} ${capture.amount.currency_code}; revisa el pedido.`.trim() })
      .where(eq(orders.id, o.id));
    return { status: "mismatch" as const };
  }
  await db.update(orders).set({ paypalCaptureId: capture.id }).where(eq(orders.id, o.id));
  if (o.status === "pendiente" || o.status === "cancelado") {
    const { changed } = await changeOrderStatus(o.id, "pagado", `PayPal ${capture.id}`);
    if (changed) {
      const fresh = await loadOrder(eq(orders.id, o.id));
      if (fresh) void sendOrderStatus(fresh.order);
    }
  }
  return { status: "paid" as const };
}

export async function capturePaypalOrder(token: string, paypalOrderId: string) {
  if (!paypalEnabled) throw fail("PayPal is not configured.");
  const o = await pendingPaypalOrder(token);
  if (o.paypalCaptureId) return { status: "paid" as const };
  if (o.paypalOrderId !== paypalOrderId) throw fail("That PayPal payment doesn’t belong to this order.");

  const res = await api<PaypalOrder & { details?: { issue: string }[] }>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": `capture-${paypalOrderId}` },
  });
  let paypal: PaypalOrder = res.data;
  if (!res.ok) {
    const issue = res.data.details?.[0]?.issue ?? "";
    if (issue === "ORDER_ALREADY_CAPTURED") {
      paypal = (await api<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`)).data;
    } else if (issue === "INSTRUMENT_DECLINED") {
      return { status: "declined" as const };
    } else {
      console.error("PayPal no capturó el pago:", res.status, JSON.stringify(res.data));
      throw fail("PayPal couldn’t complete the payment. Please try again or use another funding source.");
    }
  }
  const result = await settle(o.id, paypal);
  if (result.status === "not_completed") return { status: "pending" as const };
  return result;
}

/**
 * Cada 15 minutos revisa los pedidos con PayPal que llevan más de 2 horas
 * sin pagarse: si PayPal sí cobró los marca como pagados, si no los cancela
 * y devuelve las unidades al inventario.
 */
export function startPaypalReconciler() {
  const run = async () => {
    try {
      const stale = await db
        .select()
        .from(orders)
        .where(
          and(
            eq(orders.status, "pendiente"),
            eq(orders.paymentProvider, "paypal"),
            lt(orders.createdAt, new Date(Date.now() - 2 * 3_600_000)),
          ),
        )
        .limit(50);
      for (const o of stale) {
        if (o.paypalOrderId && paypalEnabled) {
          const { ok, data } = await api<PaypalOrder>(`/v2/checkout/orders/${encodeURIComponent(o.paypalOrderId)}`);
          if (ok && data.status === "COMPLETED") {
            await settle(o.id, data);
            continue;
          }
          if (ok && data.status === "APPROVED") {
            await capturePaypalOrder(o.token, o.paypalOrderId).catch(() => null);
            const [again] = await db.select().from(orders).where(eq(orders.id, o.id)).limit(1);
            if (again?.status !== "pendiente") continue;
          }
        }
        await changeOrderStatus(o.id, "cancelado", "Pago con PayPal no completado en 2 horas");
      }
    } catch (err) {
      console.warn("Revisión de pagos PayPal:", (err as Error).message);
    }
  };
  setInterval(run, 15 * 60_000).unref();
  setTimeout(run, 30_000).unref();
}
