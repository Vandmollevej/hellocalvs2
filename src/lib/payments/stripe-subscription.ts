import { randomUUID } from "node:crypto";
import type { PaymentMethodBrand, Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptAppSecret, encryptAppSecret } from "@/lib/api-keys/store";
import { getSubscriptionTier } from "@/lib/subscription";
import type { SubscriptionPeriodMonths, SubscriptionPlan } from "@/lib/subscription-plans";
import { appBaseUrl } from "@/lib/payments/mobilepay-client";
import {
  createCheckoutSession,
  createWebhookEndpoint,
  getCheckoutSession,
  getStripeSubscription,
  getWebhookEndpoint,
  idOf,
  isStripeConfigured,
  setCancelAtPeriodEnd,
  StripeError,
  subscriptionPeriodEnd,
  type StripeEvent,
  type StripePaymentMethod,
  type StripeSubscription,
} from "@/lib/payments/stripe-client";
import { marketPrice, stripeMarketFor } from "@/lib/payments/stripe-markets";

// Seriøs via Stripe (docs/DECISIONS.md 2026-09-29):
//  1. Brugeren trykker "Abonnér" → vi opretter en Stripe Checkout-session i
//     abonnementstilstand (Danmark: MobilePay/DKK, Tyskland: kort inkl. EC/EUR).
//     Prisen slås op her på serveren ud fra plan + periode + brugerens land.
//  2. Stripe fører brugeren gennem betalingen og tilbage til /settings/payment/stripe.
//     Vender brugeren tilbage (eller webhooken rammer først), kobles Stripe-
//     abonnementet på Subscription (provider STRIPE) og status hentes fra Stripe.
//  3. Stripe fornyer selv. Webhooks (checkout.session.completed, customer.
//     subscription.*, invoice.*) er kun et signal om at hente status; scheduleren
//     synker også, så intet afhænger af en enkelt webhook.
//  4. Opsigelse = cancel_at_period_end. Seriøs løber den betalte periode ud.

const PLAN_NAMES = { serious: "Hello Cal Seriøs", family: "Hello Cal Seriøs Familie" } as const;
const DAY_MS = 24 * 60 * 60 * 1000;
// Stripe kræver, at en prøveperiode (her: den allerede betalte/gratis periode) er mindst 48 timer.
const MIN_TRIAL_MS = 2 * DAY_MS;

export class StripeUnavailableError extends Error {}

export function stripeReturnBase() {
  return `${appBaseUrl()}/settings/payment/stripe`;
}

export function stripeWebhookUrl() {
  return `${appBaseUrl()}/api/payments/stripe/webhook`;
}

// ---- Start ---------------------------------------------------------------

export async function startStripeCheckout(
  user: { id: string; email: string | null; region: string | null },
  plan: SubscriptionPlan,
  months: SubscriptionPeriodMonths,
  now: Date = new Date(),
) {
  if (!isStripeConfigured()) throw new StripeUnavailableError("Betaling er ikke sat op");
  const market = stripeMarketFor(user.region);
  if (!market) throw new StripeUnavailableError("Betaling er endnu ikke åben i dit land");

  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (existing?.providerSubscriptionId && existing.status === "ACTIVE") {
    throw new StripeUnavailableError("Du har allerede et betalende abonnement");
  }

  // Kører der allerede en Seriøs-periode (gavekode, points, opsagt men betalt
  // periode), trækkes først, når den udløber.
  const runningUntil =
    getSubscriptionTier(existing, now) === "SERIOUS" && existing?.currentPeriodEnd ? existing.currentPeriodEnd : null;
  const trialEnd = runningUntil && runningUntil.getTime() - now.getTime() >= MIN_TRIAL_MS ? runningUntil : null;

  const amount = Math.round(marketPrice(market, plan, months) * 100);
  const metadata = { userId: user.id, plan };
  const session = await createCheckoutSession(
    {
      mode: "subscription",
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      locale: market.locale,
      payment_method_types: market.paymentMethodTypes,
      success_url: `${stripeReturnBase()}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl()}/profile/subscription/${plan}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: market.currency,
            unit_amount: amount,
            recurring: { interval: "month", interval_count: months },
            product_data: { name: PLAN_NAMES[plan] },
          },
        },
      ],
      metadata,
      subscription_data: {
        metadata,
        trial_end: trialEnd ? Math.floor(trialEnd.getTime() / 1000) : undefined,
      },
    },
    randomUUID(),
  );
  if (!session.url) throw new StripeError("Checkout-session uden adresse", 502, JSON.stringify(session));
  return { url: session.url };
}

// ---- Sync ----------------------------------------------------------------

function brandFor(method: StripePaymentMethod): PaymentMethodBrand {
  if (method.type === "mobilepay") return "MOBILEPAY";
  const brand = method.card?.brand;
  if (brand === "visa") return "VISA";
  if (brand === "mastercard") return "MASTERCARD";
  if (brand === "girocard") return "GIROCARD";
  return "CARD";
}

async function replacePaymentMethod(userId: string, method: StripePaymentMethod | null) {
  await prisma.paymentMethod.deleteMany({ where: { userId, provider: "STRIPE" } });
  if (!method) return;
  await prisma.paymentMethod.create({
    data: {
      userId,
      provider: "STRIPE",
      brand: brandFor(method),
      last4: method.card?.last4 ?? null,
      expiryMonth: method.card?.exp_month ?? null,
      expiryYear: method.card?.exp_year ?? null,
      isDefault: true,
      providerPaymentMethodId: method.id,
    },
  });
}

// Kobler et gennemført Checkout til brugerens Subscription. Kun hvis sessionen
// hører til brugeren; derefter hentes alt andet fra Stripe.
async function linkCheckoutSession(sessionId: string, expectedUserId?: string) {
  const session = await getCheckoutSession(sessionId);
  const userId = session.client_reference_id;
  const subscriptionId = idOf(session.subscription);
  if (!userId || !subscriptionId || (expectedUserId && userId !== expectedUserId)) return null;
  if (session.status !== "complete") return null;
  const plan = session.metadata?.plan === "family" ? "FAMILY" : "INDIVIDUAL";
  const customerId = idOf(session.customer);
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: "INACTIVE", provider: "STRIPE", providerSubscriptionId: subscriptionId, providerCustomerId: customerId, plan },
    update: { provider: "STRIPE", providerSubscriptionId: subscriptionId, providerCustomerId: customerId, plan, pendingAgreementId: null },
  });
  return userId;
}

async function applyRemote(subscription: Subscription, remote: StripeSubscription) {
  const { userId } = subscription;
  const periodEnd = subscriptionPeriodEnd(remote);
  const keepLonger =
    subscription.currentPeriodEnd && (!periodEnd || subscription.currentPeriodEnd > periodEnd)
      ? subscription.currentPeriodEnd
      : periodEnd;

  if (["active", "trialing", "past_due"].includes(remote.status)) {
    const canceled = remote.cancel_at_period_end;
    await prisma.subscription.update({
      where: { userId },
      data: { status: canceled ? "CANCELED" : "ACTIVE", currentPeriodEnd: keepLonger },
    });
    const method = remote.default_payment_method;
    await replacePaymentMethod(userId, canceled || !method || typeof method === "string" ? null : method);
  } else if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(remote.status)) {
    // Afsluttet hos Stripe: Seriøs løber den betalte periode ud.
    const stillPaid = keepLonger && keepLonger > new Date();
    await prisma.subscription.update({
      where: { userId },
      data: { status: stillPaid ? "CANCELED" : "INACTIVE", providerSubscriptionId: null, currentPeriodEnd: keepLonger },
    });
    await replacePaymentMethod(userId, null);
  }
}

export async function syncStripeUser(userId: string) {
  if (!isStripeConfigured()) return;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription?.provider !== "STRIPE" || !subscription.providerSubscriptionId) return;
  await applyRemote(subscription, await getStripeSubscription(subscription.providerSubscriptionId));
}

// Kaldes fra retursiden: kobler sessionen (uden at vente på webhooken) og
// svarer, om brugeren nu har et aktivt abonnement.
export async function syncStripeReturn(userId: string, sessionId: string | null): Promise<"active" | "pending" | "none"> {
  if (!isStripeConfigured()) return "none";
  if (sessionId) await linkCheckoutSession(sessionId, userId);
  await syncStripeUser(userId);
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription?.provider === "STRIPE" && subscription.providerSubscriptionId) return "active";
  return sessionId ? "pending" : "none";
}

// ---- Opsigelse -----------------------------------------------------------

export async function cancelStripe(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription?.provider !== "STRIPE" || !subscription.providerSubscriptionId) {
    throw new StripeUnavailableError("Ingen aktiv Stripe-betaling");
  }
  const remote = await setCancelAtPeriodEnd(subscription.providerSubscriptionId, true);
  await applyRemote(subscription, await getStripeSubscription(remote.id));
}

// ---- Webhook -------------------------------------------------------------

export async function ensureStripeWebhook() {
  if (process.env.STRIPE_WEBHOOK_SECRET?.trim()) return; // manuelt sat op i Stripe
  const url = stripeWebhookUrl();
  if (!url.startsWith("https://")) return; // Stripe kan kun ramme en offentlig https-adresse
  const existing = await prisma.paymentWebhook.findUnique({ where: { provider_url: { provider: "STRIPE", url } } });
  if (existing) {
    // Skiftet nøgle (test ↔ live) eller slettet i Stripe → registrér på ny.
    const alive = await getWebhookEndpoint(existing.providerWebhookId).then(
      (hook) => hook.status === "enabled",
      () => false,
    );
    if (alive) return;
    await prisma.paymentWebhook.delete({ where: { id: existing.id } });
  }
  const created = await createWebhookEndpoint(url);
  await prisma.paymentWebhook.create({
    data: { provider: "STRIPE", providerWebhookId: created.id, url, secretCipher: encryptAppSecret(created.secret) },
  });
}

export async function stripeWebhookSecrets(): Promise<string[]> {
  const secrets: string[] = [];
  const manual = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (manual) secrets.push(manual);
  const row = await prisma.paymentWebhook.findUnique({
    where: { provider_url: { provider: "STRIPE", url: stripeWebhookUrl() } },
  });
  if (row) secrets.push(decryptAppSecret(row.secretCipher));
  return secrets;
}

function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const direct = idOf(invoice.subscription as string | { id: string } | null | undefined);
  if (direct) return direct;
  const parent = invoice.parent as { subscription_details?: { subscription?: string } } | undefined;
  return parent?.subscription_details?.subscription ?? null;
}

export async function handleStripeEvent(event: StripeEvent) {
  const object = event.data.object;
  let subscriptionId: string | null = null;

  if (event.type === "checkout.session.completed") {
    if (object.mode !== "subscription" || typeof object.id !== "string") return;
    const userId = await linkCheckoutSession(object.id);
    if (userId) await syncStripeUser(userId);
    return;
  } else if (event.type.startsWith("customer.subscription.")) {
    subscriptionId = typeof object.id === "string" ? object.id : null;
  } else if (event.type.startsWith("invoice.")) {
    subscriptionId = invoiceSubscriptionId(object);
  }
  if (!subscriptionId) return;

  const local = await prisma.subscription.findFirst({ where: { provider: "STRIPE", providerSubscriptionId: subscriptionId } });
  if (local) await applyRemote(local, await getStripeSubscription(subscriptionId));
}

// ---- Scheduler -----------------------------------------------------------

export async function runStripeTick(now: Date = new Date()) {
  if (!isStripeConfigured()) return;
  await ensureStripeWebhook().catch((error) =>
    console.error("[stripe] webhook kunne ikke registreres", error instanceof StripeError ? error.body : error),
  );
  // Webhooks er det primære signal; her fanges kun abonnementer nær fornyelse.
  const due = await prisma.subscription.findMany({
    where: {
      provider: "STRIPE",
      providerSubscriptionId: { not: null },
      currentPeriodEnd: { lte: new Date(now.getTime() + DAY_MS) },
    },
  });
  for (const subscription of due) {
    await syncStripeUser(subscription.userId).catch((error) =>
      console.error("[stripe] sync fejlede", subscription.userId, error instanceof StripeError ? error.body : error),
    );
  }
}
