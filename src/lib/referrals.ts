import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";
import { queueMessage } from "@/lib/messaging";

// "Invitér en ven"-belønningslogik (docs/DECISIONS.md 2026-09-02, ændret
// 2026-10-03).
//
// Attribution: en Referral-række oprettes ved tilmelding, når signup-body'en
// indeholder en gyldig User.referralCode (se
// src/app/api/auth/register/route.ts) — det er selve invite-link-mekanismen.
//
// Belønning (2026-10-03): kun afsenderen får points — 300 points
// (PointsReason.FRIEND_REFERRAL), når den inviterede har været registreret i
// mindst 3 måneder, og belønningen for Referral-rækken ikke allerede er
// givet. Vennen får ingen points, men i stedet 1 gratis måned med Seriøs med
// det samme ved oprettelsen (grantReferredFriendFreeMonth).

const REWARD_AFTER_MONTHS = 3;
const REFERRAL_POINTS = 300;

// 1 gratis måned med Seriøs til en ny bruger, der er oprettet via et
// invite-link. Lander i samme FREE_MONTH-status som gavekoder
// (src/lib/gift-codes.ts) og falder selv tilbage til Gratis efter
// currentPeriodEnd. Tæller ikke med i points-loftet på 12 gratis måneder.
export async function grantReferredFriendFreeMonth(userId: string, now: Date = new Date()) {
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: "FREE_MONTH", currentPeriodEnd },
    update: { status: "FREE_MONTH", currentPeriodEnd },
  });
}

function monthsSince(date: Date, now: Date): number {
  return (
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth()) -
    (now.getDate() < date.getDate() ? 1 : 0)
  );
}

/**
 * Kaldes periodisk af src/lib/scheduler.ts, eller manuelt for en enkelt
 * bruger.
 */
export async function grantEligibleReferralRewards(now: Date = new Date()) {
  const pending = await prisma.referral.findMany({
    where: { rewardGrantedAt: null },
    include: { referrer: true, referredUser: true },
  });

  let granted = 0;
  for (const referral of pending) {
    if (monthsSince(referral.referredRegisteredAt, now) < REWARD_AFTER_MONTHS) continue;

    await prisma.referral.update({
      where: { id: referral.id },
      data: { rewardGrantedAt: now },
    });
    await awardPoints(referral.referrerId, "FRIEND_REFERRAL", REFERRAL_POINTS);
    await queueMessage("FRIEND_REFERRAL", {
      userId: referral.referrerId,
      vars: { displayName: referral.referrer.displayName, friendName: referral.referredUser.displayName },
    });
    granted += 1;
  }

  return { checked: pending.length, granted };
}
