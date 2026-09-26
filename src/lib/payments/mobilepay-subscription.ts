import { randomUUID } from "node:crypto";
import type { PaymentCharge, Subscription } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptAppSecret, encryptAppSecret } from "@/lib/api-keys/store";
import { getSubscriptionTier } from "@/lib/subscription";
import {
  appBaseUrl,
  cancelCharge,
  createAgreement,
  createCharge,
  deleteWebhook,
  getAgreement,
  getCharge,
  isMobilePayConfigured,
  listWebhooks,
  registerWebhook,
  stopAgreement,
  type ChargeStatus,
} from "@/lib/payments/mobilepay-client";

// Seriøs via MobilePay (docs/DECISIONS.md 2026-09-26):
//  1. Brugeren trykker "Betal med MobilePay" → vi opretter en aftale
//     (planens pris og interval) og sender brugeren til MobilePay-appen. Første måned
//     trækkes med det samme (initialCharge) — medmindre brugeren allerede har
//     en betalt/gratis periode kørende; så trækkes først, når den udløber.
//  2. Aftalen bliver aktiv i appen → Subscription.status ACTIVE og
//     MobilePay vises som betalingsmetode.
//  3. Scheduleren opretter næste træk 5 dage før periodens udløb (forfald på
//     udløbsdatoen). Når trækket er gennemført, forlænges perioden én måned.
//     Et gratis måned fra points (freeMonthsRemaining) bruges i stedet for et træk.
//  4. Opsigelse stopper aftalen; brugeren beholder Seriøs perioden ud.
// Status hentes altid fra MobilePay — webhooks er kun et signal om at hente.

const CHARGE_LEAD_DAYS = 5;
const CHARGE_RETRY_DAYS = 5;
const FINAL_CHARGE_STATUSES: ChargeStatus[] = ["CHARGED", "FAILED", "CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"];
const PAID_CHARGE_STATUSES: ChargeStatus[] = ["CHARGED", "PARTIALLY_CAPTURED", "PARTIALLY_REFUNDED"];

export class MobilePayUnavailableError extends Error {}

// Det, brugeren køber: beløb pr. interval og intervallets længde i måneder.
export type MobilePayPlan = { amountOre: number; intervalMonths: number; productName: string };

export function mobilePayReturnUrl() {
  return `${appBaseUrl()}/settings/payment/mobilepay`;
}

export function mobilePayWebhookUrl() {
  return `${appBaseUrl()}/api/payments/mobilepay/webhook`;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

// MobilePay forventer forfaldsdatoen som dansk kalenderdato.
function copenhagenDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen" }).format(date);
}

function orderId(kind: "init" | "renew") {
  return `hc-${kind}-${randomUUID()}`;
}

async function showMobilePayMethod(userId: string, agreementId: string) {
  await prisma.$transaction([
    prisma.paymentMethod.deleteMany({ where: { userId, provider: "MOBILEPAY_ONLINE" } }),
    prisma.paymentMethod.create({
      data: {
        userId,
        provider: "MOBILEPAY_ONLINE",
        brand: "MOBILEPAY",
        isDefault: true,
        providerPaymentMethodId: agreementId,
      },
    }),
  ]);
}

async function removeMobilePayMethod(userId: string) {
  await prisma.paymentMethod.deleteMany({ where: { userId, provider: "MOBILEPAY_ONLINE" } });
}

async function cancelOpenCharges(agreementId: string) {
  const open = await prisma.paymentCharge.findMany({
    where: { providerAgreementId: agreementId, status: { in: ["PENDING", "DUE"] }, appliedAt: null },
  });
  for (const charge of open) {
    await cancelCharge(agreementId, charge.providerChargeId).catch(() => {});
    await prisma.paymentCharge.update({ where: { id: charge.id }, data: { status: "CANCELLED" } });
  }
}

// ---- Start ---------------------------------------------------------------

export async function startMobilePayAgreement(userId: string, plan: MobilePayPlan, now: Date = new Date()) {
  if (!isMobilePayConfigured()) throw new MobilePayUnavailableError("MobilePay er ikke sat op");

  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription?.provider === "MOBILEPAY_ONLINE" && subscription.providerSubscriptionId) {
    throw new MobilePayUnavailableError("Du betaler allerede med MobilePay");
  }

  // Kører der allerede en Seriøs-periode (gavekode, points, opsagt men betalt
  // periode), trækkes først, når den udløber.
  const runningUntil =
    getSubscriptionTier(subscription, now) === "SERIOUS" && subscription?.currentPeriodEnd
      ? subscription.currentPeriodEnd
      : null;
  const initialOrderId = runningUntil ? null : orderId("init");

  const created = await createAgreement({
    amountOre: plan.amountOre,
    intervalMonths: plan.intervalMonths,
    productName: plan.productName,
    productDescription: `${plan.amountOre / 100} kr. ${
      plan.intervalMonths === 1 ? "pr. måned" : `hver ${plan.intervalMonths}. måned`
    } — opsig når som helst`,
    merchantRedirectUrl: mobilePayReturnUrl(),
    merchantAgreementUrl: `${appBaseUrl()}/settings/payment`,
    externalId: userId,
    idempotencyKey: randomUUID(),
    initialCharge: initialOrderId
      ? { amountOre: plan.amountOre, description: `${plan.productName} — første periode`, orderId: initialOrderId }
      : undefined,
  });

  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: "INACTIVE", pendingAgreementId: created.agreementId },
    update: { pendingAgreementId: created.agreementId },
  });

  if (created.chargeId) {
    await prisma.paymentCharge.create({
      data: {
        userId,
        provider: "MOBILEPAY_ONLINE",
        providerAgreementId: created.agreementId,
        providerChargeId: created.chargeId,
        amountOre: plan.amountOre,
        status: "PENDING",
        dueDate: now,
        periodStart: now,
        periodEnd: addMonths(now, plan.intervalMonths),
      },
    });
  }

  return { confirmationUrl: created.vippsConfirmationUrl };
}

// ---- Sync ----------------------------------------------------------------

export async function syncCharge(charge: PaymentCharge) {
  const remote = await getCharge(charge.providerAgreementId, charge.providerChargeId);
  const updated = await prisma.paymentCharge.update({ where: { id: charge.id }, data: { status: remote.status } });
  const subscription = await prisma.subscription.findUnique({ where: { userId: charge.userId } });
  if (!subscription) return;

  if (PAID_CHARGE_STATUSES.includes(remote.status) && !updated.appliedAt) {
    const current = subscription.currentPeriodEnd;
    const periodEnd = current && current > updated.periodEnd ? current : updated.periodEnd;
    const stillAgreement = subscription.providerSubscriptionId === charge.providerAgreementId;
    await prisma.$transaction([
      prisma.paymentCharge.update({ where: { id: charge.id }, data: { appliedAt: new Date() } }),
      prisma.subscription.update({
        where: { userId: charge.userId },
        data: { currentPeriodEnd: periodEnd, ...(stillAgreement ? { status: "ACTIVE" } : {}) },
      }),
    ]);
    return;
  }

  // Alle MobilePay's genforsøg er brugt: aftalen stoppes, og Seriøs udløber
  // med den betalte periode.
  if (remote.status === "FAILED" && subscription.providerSubscriptionId === charge.providerAgreementId) {
    await stopAgreement(charge.providerAgreementId).catch(() => {});
    await prisma.subscription.update({
      where: { userId: charge.userId },
      data: { status: "INACTIVE", providerSubscriptionId: null },
    });
    await removeMobilePayMethod(charge.userId);
  }
}

async function syncChargesFor(agreementId: string) {
  const open = await prisma.paymentCharge.findMany({
    where: {
      providerAgreementId: agreementId,
      OR: [{ status: { notIn: FINAL_CHARGE_STATUSES } }, { status: { in: PAID_CHARGE_STATUSES }, appliedAt: null }],
    },
  });
  for (const charge of open) await syncCharge(charge);
}

export async function syncSubscriptionAgreements(subscription: Subscription) {
  const { userId } = subscription;

  if (subscription.pendingAgreementId) {
    const agreementId = subscription.pendingAgreementId;
    const agreement = await getAgreement(agreementId);
    if (agreement.status === "ACTIVE") {
      await prisma.subscription.update({
        where: { userId },
        data: {
          provider: "MOBILEPAY_ONLINE",
          providerSubscriptionId: agreementId,
          pendingAgreementId: null,
          status: "ACTIVE",
        },
      });
      await showMobilePayMethod(userId, agreementId);
    } else if (agreement.status === "STOPPED" || agreement.status === "EXPIRED") {
      // Afvist eller aldrig godkendt i appen.
      await prisma.subscription.update({ where: { userId }, data: { pendingAgreementId: null } });
    }
    await syncChargesFor(agreementId);
  }

  const fresh = await prisma.subscription.findUnique({ where: { userId } });
  if (fresh?.provider === "MOBILEPAY_ONLINE" && fresh.providerSubscriptionId) {
    const agreementId = fresh.providerSubscriptionId;
    const agreement = await getAgreement(agreementId);
    if (agreement.status === "STOPPED" || agreement.status === "EXPIRED") {
      // Stoppet i MobilePay-appen: Seriøs løber perioden ud.
      await cancelOpenCharges(agreementId);
      await prisma.subscription.update({
        where: { userId },
        data: { status: "CANCELED", providerSubscriptionId: null },
      });
      await removeMobilePayMethod(userId);
    }
    await syncChargesFor(agreementId);
  }
}

export async function syncUserMobilePay(userId: string) {
  if (!isMobilePayConfigured()) return;
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (subscription) await syncSubscriptionAgreements(subscription);
}

// ---- Opsigelse -----------------------------------------------------------

export async function cancelMobilePay(userId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  const agreementId = subscription?.provider === "MOBILEPAY_ONLINE" ? subscription.providerSubscriptionId : null;
  if (!agreementId) throw new MobilePayUnavailableError("Ingen aktiv MobilePay-aftale");
  await stopAgreement(agreementId);
  await cancelOpenCharges(agreementId);
  await prisma.subscription.update({
    where: { userId },
    data: { status: "CANCELED", providerSubscriptionId: null },
  });
  await removeMobilePayMethod(userId);
}

// ---- Månedlige træk ------------------------------------------------------

async function scheduleUpcomingCharges(now: Date) {
  const horizon = new Date(now.getTime() + CHARGE_LEAD_DAYS * 24 * 60 * 60 * 1000);
  const due = await prisma.subscription.findMany({
    where: {
      provider: "MOBILEPAY_ONLINE",
      providerSubscriptionId: { not: null },
      currentPeriodEnd: { not: null, lte: horizon },
    },
  });

  for (const subscription of due) {
    const agreementId = subscription.providerSubscriptionId!;
    const periodStart = subscription.currentPeriodEnd!;
    const exists = await prisma.paymentCharge.findUnique({
      where: { providerAgreementId_periodStart: { providerAgreementId: agreementId, periodStart } },
    });
    if (exists) continue;

    // En gratis måned fra points bruges i stedet for et træk.
    if (subscription.freeMonthsRemaining > 0 && periodStart <= now) {
      await prisma.subscription.update({
        where: { userId: subscription.userId },
        data: { freeMonthsRemaining: { decrement: 1 }, currentPeriodEnd: addMonths(periodStart, 1) },
      });
      continue;
    }
    if (subscription.freeMonthsRemaining > 0) continue;

    try {
      // Beløb og interval står på selve aftalen hos MobilePay.
      const agreement = await getAgreement(agreementId);
      const amountOre = agreement.pricing?.amount;
      const intervalMonths = agreement.interval?.unit === "MONTH" ? agreement.interval.count ?? 1 : 1;
      if (agreement.status !== "ACTIVE" || !amountOre) continue;

      // MobilePay kræver forfald tidligst i morgen.
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const dueDate = periodStart > tomorrow ? periodStart : tomorrow;
      const created = await createCharge(agreementId, {
        amountOre,
        description: `${agreement.productName ?? "Hello Cal"} — fornyelse`,
        due: copenhagenDate(dueDate),
        orderId: orderId("renew"),
        retryDays: CHARGE_RETRY_DAYS,
      });
      await prisma.paymentCharge.create({
        data: {
          userId: subscription.userId,
          provider: "MOBILEPAY_ONLINE",
          providerAgreementId: agreementId,
          providerChargeId: created.chargeId,
          amountOre,
          status: "PENDING",
          dueDate,
          periodStart,
          periodEnd: addMonths(periodStart, intervalMonths),
        },
      });
    } catch (error) {
      console.error("[mobilepay] træk kunne ikke oprettes", subscription.userId, error);
    }
  }
}

// ---- Webhook -------------------------------------------------------------

export async function ensureMobilePayWebhook() {
  const url = mobilePayWebhookUrl();
  const existing = await prisma.paymentWebhook.findUnique({
    where: { provider_url: { provider: "MOBILEPAY_ONLINE", url } },
  });
  if (existing) return;
  // En webhook med samme adresse, som vi ikke kender hemmeligheden til, erstattes.
  const { webhooks } = await listWebhooks();
  for (const hook of webhooks.filter((item) => item.url === url)) await deleteWebhook(hook.id);
  const created = await registerWebhook(url);
  await prisma.paymentWebhook.create({
    data: {
      provider: "MOBILEPAY_ONLINE",
      providerWebhookId: created.id,
      url,
      secretCipher: encryptAppSecret(created.secret),
    },
  });
}

export async function mobilePayWebhookSecret(): Promise<string | null> {
  const row = await prisma.paymentWebhook.findUnique({
    where: { provider_url: { provider: "MOBILEPAY_ONLINE", url: mobilePayWebhookUrl() } },
  });
  return row ? decryptAppSecret(row.secretCipher) : null;
}

export async function handleMobilePayWebhook(payload: { agreementId?: string; chargeId?: string }) {
  const agreementId = payload.agreementId;
  if (!agreementId) return;
  const subscription = await prisma.subscription.findFirst({
    where: { OR: [{ pendingAgreementId: agreementId }, { providerSubscriptionId: agreementId }] },
  });
  if (subscription) await syncSubscriptionAgreements(subscription);
  else await syncChargesFor(agreementId);
}

// ---- Scheduler -----------------------------------------------------------

export async function runMobilePayTick(now: Date = new Date()) {
  if (!isMobilePayConfigured()) return;

  await ensureMobilePayWebhook().catch((error) => console.error("[mobilepay] webhook kunne ikke registreres", error));

  const tracked = await prisma.subscription.findMany({
    where: {
      OR: [
        { pendingAgreementId: { not: null } },
        { provider: "MOBILEPAY_ONLINE", providerSubscriptionId: { not: null } },
      ],
    },
  });
  for (const subscription of tracked) {
    await syncSubscriptionAgreements(subscription).catch((error) =>
      console.error("[mobilepay] sync fejlede", subscription.userId, error),
    );
  }

  await scheduleUpcomingCharges(now);
}
