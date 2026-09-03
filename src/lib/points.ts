import { prisma } from "@/lib/prisma";
import type { PointsReason } from "@prisma/client";
import { FREE_MONTH_COST, MAX_FREE_MONTHS, MAX_FORWARD_POINTS_PER_MONTH } from "@/lib/points-constants";

// Pointsystem (docs/DECISIONS.md 2026-09-02): ledger frem for et cachet
// saldofelt. Saldoen er altid SUM(PointsTransaction.amount) for brugeren —
// se getPointsBalance. Negative beløb bruges kun til FREE_MONTH_REDEEMED
// (indløsning trækker 300 points fra saldoen).

export async function awardPoints(
  userId: string,
  reason: PointsReason,
  amount: number,
  refs?: { productId?: string; bugReportId?: string; forwardId?: string }
) {
  return prisma.pointsTransaction.create({
    data: {
      userId,
      reason,
      amount,
      productId: refs?.productId,
      bugReportId: refs?.bugReportId,
      forwardId: refs?.forwardId,
    },
  });
}

export async function getPointsBalance(userId: string): Promise<number> {
  const result = await prisma.pointsTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Videresend-loft: maks. 50 FRIEND_FORWARD_FULFILLED-points pr. kalendermåned
// pr. bruger (docs/DECISIONS.md 2026-09-02).
export async function forwardPointsEarnedThisMonth(userId: string, now: Date = new Date()): Promise<number> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await prisma.pointsTransaction.aggregate({
    where: { userId, reason: "FRIEND_FORWARD_FULFILLED", createdAt: { gte: monthStart } },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function awardForwardPointsIfUnderCap(userId: string, forwardId: string, now: Date = new Date()) {
  const earnedThisMonth = await forwardPointsEarnedThisMonth(userId, now);
  const remainingCap = MAX_FORWARD_POINTS_PER_MONTH - earnedThisMonth;
  if (remainingCap <= 0) return null;

  const amount = Math.min(5, remainingCap);
  return awardPoints(userId, "FRIEND_FORWARD_FULFILLED", amount, { forwardId });
}

export class RedeemFreeMonthError extends Error {}

// Indløser 300 points til 1 gratis abonnementsmåned. Kræver en gemt
// betalingsmetode, så abonnementet fortsætter automatisk til fuld pris
// bagefter (docs/DECISIONS.md 2026-09-02), og respekterer lifetime-loftet på
// 12 gratis måneder.
export async function redeemFreeMonth(userId: string) {
  const [balance, user, paymentMethod] = await Promise.all([
    getPointsBalance(userId),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.paymentMethod.findFirst({ where: { userId } }),
  ]);

  if (balance < FREE_MONTH_COST) {
    throw new RedeemFreeMonthError("Du har ikke nok points endnu (300 points kræves).");
  }
  if (!paymentMethod) {
    throw new RedeemFreeMonthError(
      "Tilføj en betalingsmetode under Betaling, så abonnementet kan fortsætte automatisk efter den gratis måned."
    );
  }
  if (user.freeMonthsCredited >= MAX_FREE_MONTHS) {
    throw new RedeemFreeMonthError("Du har allerede opnået det maksimale antal gratis måneder.");
  }

  await prisma.$transaction([
    prisma.pointsTransaction.create({
      data: { userId, reason: "FREE_MONTH_REDEEMED", amount: -FREE_MONTH_COST },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { freeMonthsCredited: { increment: 1 } },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: { userId, status: "FREE_MONTH", freeMonthsRemaining: 1 },
      update: { status: "FREE_MONTH", freeMonthsRemaining: { increment: 1 } },
    }),
  ]);
}
