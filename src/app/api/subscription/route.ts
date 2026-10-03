import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getPointsBalance } from "@/lib/points";
import { FREE_MONTH_COST } from "@/lib/points-constants";
import {
  getSubscriptionTier,
  isCoveredByFamilyPlan,
  FREE_TIER_RETENTION_DAYS,
  SERIOUS_MONTHLY_PRICE_DKK,
  SUBSCRIPTION_PRICES_DKK,
} from "@/lib/subscription";
import { MAX_FAMILY_PROFILES } from "@/lib/family";
import { isMobilePayConfigured } from "@/lib/payments/mobilepay-client";
import { isStripeConfigured } from "@/lib/payments/stripe-client";
import { stripeMarketFor } from "@/lib/payments/stripe-markets";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dit abonnement" }, { status: 401 });

  const [subscription, paymentMethods, pointsBalance] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.paymentMethod.findMany({ where: { userId: user.id } }),
    getPointsBalance(user.id),
  ]);

  // Administratorer er altid Seriøs (docs/DECISIONS.md 2026-09-28).
  const ownTier = user.role === "ADMIN" ? "SERIOUS" : getSubscriptionTier(subscription);
  const coveredByFamily = ownTier === "FREE" && (await isCoveredByFamilyPlan(user.id));
  const tier = coveredByFamily ? "SERIOUS" : ownTier;

  return NextResponse.json({
    // Nyere felter, brugt af /profile/subscription (docs/DECISIONS.md 2026-09-19).
    tier,
    status: subscription?.status ?? "INACTIVE",
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    pointsBalance,
    freeMonthCost: FREE_MONTH_COST,
    priceDkk: SERIOUS_MONTHLY_PRICE_DKK,
    // Familieabonnement (docs/FAMILY.md).
    plan: user.role === "ADMIN" ? "FAMILY" : (subscription?.plan ?? "INDIVIDUAL"),
    coveredByFamily,
    familyPriceDkk: SUBSCRIPTION_PRICES_DKK.family[1],
    familyMaxProfiles: MAX_FAMILY_PROFILES,
    retentionDays: FREE_TIER_RETENTION_DAYS,
    // MobilePay-nøgler er sat op (admin → API-nøgler), så køb kan gennemføres.
    // Stripe (DK: MobilePay, DE: kort/EC) vælges ud fra brugerens land; ellers
    // bruges MobilePay Recurring direkte, hvis den er sat op.
    stripeAvailable: isStripeConfigured() && Boolean(stripeMarketFor(user.region)),
    paymentMarket: stripeMarketFor(user.region),
    mobilePayAvailable: isMobilePayConfigured(),
    mobilePayPending: Boolean(subscription?.pendingAgreementId),
    // Ældre felter, allerede forventet af /settings/payment
    // (docs/DECISIONS.md 2026-09-02/03) — denne route fandtes ikke før nu, så
    // den side har hidtil kørt mod et 404-svar. Bevaret her for ikke at
    // knække den eksisterende side.
    subscription,
    paymentMethods,
  });
}
