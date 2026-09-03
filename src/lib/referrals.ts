import { prisma } from "@/lib/prisma";
import { awardPoints } from "@/lib/points";
import { queueMessage } from "@/lib/messaging";

// "Invitér en ven"-belønningslogik (docs/DECISIONS.md 2026-09-02).
//
// Attribution: en Referral-række oprettes ved tilmelding, når signup-body'en
// indeholder en gyldig User.referralCode (se
// src/app/api/auth/register/route.ts) — det er selve invite-link-mekanismen.
//
// Belønning: når en inviteret bruger har været registreret i mindst 3
// måneder, og belønningen for Referral-rækken ikke allerede er givet,
// krediteres BÅDE afsender og den nye bruger 300 points hver
// (PointsReason.FRIEND_REFERRAL) — IKKE en direkte gratis måned. 300 points
// kan efterfølgende indløses til 1 gratis måned via redeemFreeMonth()
// (src/lib/points.ts), som selv håndhæver 12-måneders-loftet.

const REWARD_AFTER_MONTHS = 3;
const REFERRAL_POINTS = 300;

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
    await awardPoints(referral.referredUserId, "FRIEND_REFERRAL", REFERRAL_POINTS);
    await queueMessage("FRIEND_REFERRAL", {
      userId: referral.referrerId,
      vars: { displayName: referral.referrer.displayName, friendName: referral.referredUser.displayName },
    });
    granted += 1;
  }

  return { checked: pending.length, granted };
}
