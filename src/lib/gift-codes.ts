import { prisma } from "@/lib/prisma";
import { getSubscriptionTier } from "@/lib/subscription";

// Gavekoder (docs/DECISIONS.md 2026-09-19): admin-oprettede engangskoder der
// giver et fast antal dage Seriøs uden krav om nogen betalingsmetode —
// separat spor fra points→gratis måned (src/lib/points.ts), men lander i den
// samme Subscription-status (FREE_MONTH), da begge betyder "Seriøs uden en
// reelt betalende PSP-aftale lige nu".

export class RedeemGiftCodeError extends Error {}

export async function redeemGiftCode(userId: string, rawCode: string, now: Date = new Date()) {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    throw new RedeemGiftCodeError("Indtast en gavekode");
  }

  const giftCode = await prisma.giftCode.findUnique({ where: { code } });
  if (!giftCode) {
    throw new RedeemGiftCodeError("Gavekoden findes ikke");
  }
  if (giftCode.redeemedAt) {
    throw new RedeemGiftCodeError("Gavekoden er allerede brugt");
  }

  const existing = await prisma.subscription.findUnique({ where: { userId } });
  const currentTier = getSubscriptionTier(existing, now);
  // Stack onto an already-running Seriøs period rather than shortening it,
  // matching how the points→free-month redemption increments
  // freeMonthsRemaining instead of resetting the period.
  const base = currentTier === "SERIOUS" && existing?.currentPeriodEnd ? existing.currentPeriodEnd : now;
  const currentPeriodEnd = new Date(base);
  currentPeriodEnd.setDate(currentPeriodEnd.getDate() + giftCode.durationDays);

  await prisma.$transaction([
    prisma.giftCode.update({
      where: { id: giftCode.id },
      data: { redeemedAt: now, redeemedById: userId },
    }),
    prisma.subscription.upsert({
      where: { userId },
      create: { userId, status: "FREE_MONTH", currentPeriodEnd },
      update: { status: "FREE_MONTH", currentPeriodEnd },
    }),
  ]);

  return { currentPeriodEnd, durationDays: giftCode.durationDays };
}
