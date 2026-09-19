import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getPointsBalance } from "@/lib/points";
import { FREE_MONTH_COST } from "@/lib/points-constants";
import { getSubscriptionTier, FREE_TIER_RETENTION_DAYS, SERIOUS_MONTHLY_PRICE_DKK } from "@/lib/subscription";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ message: "Log ind for at se dit abonnement" }, { status: 401 });

  const [subscription, paymentMethods, pointsBalance] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId: user.id } }),
    prisma.paymentMethod.findMany({ where: { userId: user.id } }),
    getPointsBalance(user.id),
  ]);

  const tier = getSubscriptionTier(subscription);

  return NextResponse.json({
    // Nyere felter, brugt af /profile/subscription (docs/DECISIONS.md 2026-09-19).
    tier,
    status: subscription?.status ?? "INACTIVE",
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    pointsBalance,
    freeMonthCost: FREE_MONTH_COST,
    priceDkk: SERIOUS_MONTHLY_PRICE_DKK,
    retentionDays: FREE_TIER_RETENTION_DAYS,
    // Ældre felter, allerede forventet af /settings/payment
    // (docs/DECISIONS.md 2026-09-02/03) — denne route fandtes ikke før nu, så
    // den side har hidtil kørt mod et 404-svar. Bevaret her for ikke at
    // knække den eksisterende side.
    subscription,
    paymentMethods,
  });
}
