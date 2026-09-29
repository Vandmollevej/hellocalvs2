import { createHmac, timingSafeEqual } from "node:crypto";

// Klient til Stripe's REST API (docs/DECISIONS.md 2026-09-29). Bevidst uden
// stripe-SDK (fetch + formkodning), så der ikke skal installeres noget. Nøglen
// (STRIPE_SECRET_KEY) rettes i admin → API-nøgler. Kortdata og MobilePay-login
// sker hos Stripe; Hello Cal gemmer kun kunde-/abonnements-id'er.

const TIMEOUT_MS = 20_000;
const env = (key: string) => process.env[key]?.trim() || "";

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

export function isStripeConfigured() {
  const key = env("STRIPE_SECRET_KEY");
  return key.startsWith("sk_") || key.startsWith("rk_");
}

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

// Stripe tager formkodede, indlejrede nøgler: a[b][0][c]=…
export type StripeParam =
  | string
  | number
  | boolean
  | null
  | undefined
  | StripeParam[]
  | { [key: string]: StripeParam };

function encode(value: StripeParam, prefix: string, out: URLSearchParams) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => encode(item, `${prefix}[${index}]`, out));
  } else if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) encode(item, prefix ? `${prefix}[${key}]` : key, out);
  } else {
    out.append(prefix, String(value));
  }
}

export async function stripeRequest<T>(
  method: "GET" | "POST",
  path: string,
  params?: { [key: string]: StripeParam },
  options: { idempotencyKey?: string } = {},
): Promise<T> {
  const query = new URLSearchParams();
  if (params) encode(params, "", query);
  const isGet = method === "GET";
  const url = `https://api.stripe.com${path}${isGet && query.size ? `?${query}` : ""}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      ...(isGet ? {} : { "Content-Type": "application/x-www-form-urlencoded" }),
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: isGet ? undefined : query.toString(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await response.text();
  if (!response.ok) throw new StripeError(`Stripe ${method} ${path} → ${response.status}`, response.status, text);
  return JSON.parse(text) as T;
}

// ---- Typer (kun det, vi bruger) ------------------------------------------

export type StripePaymentMethod = {
  id: string;
  type: string;
  card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
};

export type StripeSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  current_period_end?: number;
  items?: { data: { current_period_end?: number }[] };
  default_payment_method?: StripePaymentMethod | string | null;
  metadata?: Record<string, string>;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status: string;
  client_reference_id: string | null;
  customer: string | { id: string } | null;
  subscription: string | { id: string } | null;
  metadata?: Record<string, string>;
};

export type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

// Nyere API-versioner har flyttet perioden fra abonnementet til linjerne.
export function subscriptionPeriodEnd(subscription: StripeSubscription): Date | null {
  const seconds = subscription.current_period_end ?? subscription.items?.data[0]?.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}

export const idOf = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);

// ---- Kald ----------------------------------------------------------------

export function createCheckoutSession(params: { [key: string]: StripeParam }, idempotencyKey: string) {
  return stripeRequest<StripeCheckoutSession>("POST", "/v1/checkout/sessions", params, { idempotencyKey });
}

export function getCheckoutSession(id: string) {
  return stripeRequest<StripeCheckoutSession>("GET", `/v1/checkout/sessions/${encodeURIComponent(id)}`);
}

export function getStripeSubscription(id: string) {
  return stripeRequest<StripeSubscription>("GET", `/v1/subscriptions/${encodeURIComponent(id)}`, {
    expand: ["default_payment_method"],
  });
}

export function setCancelAtPeriodEnd(id: string, cancel: boolean) {
  return stripeRequest<StripeSubscription>("POST", `/v1/subscriptions/${encodeURIComponent(id)}`, {
    cancel_at_period_end: cancel,
  });
}

export function createWebhookEndpoint(url: string) {
  return stripeRequest<{ id: string; secret: string }>("POST", "/v1/webhook_endpoints", {
    url,
    enabled_events: STRIPE_WEBHOOK_EVENTS,
    description: "Hello Cal abonnementer",
  });
}

export function getWebhookEndpoint(id: string) {
  return stripeRequest<{ id: string; url: string; status: string }>(
    "GET",
    `/v1/webhook_endpoints/${encodeURIComponent(id)}`,
  );
}

export function retrieveAccount() {
  return stripeRequest<{ id: string; country?: string }>("GET", "/v1/account");
}

// ---- Webhook-signatur ----------------------------------------------------

// Stripe-Signature: t=<tid>,v1=<hmac-sha256 af "<tid>.<rå krop>">.
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSeconds = 300) {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=") as [string, string]);
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest();
  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}
