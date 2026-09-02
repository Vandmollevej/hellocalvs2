import { prisma } from "@/lib/prisma";

// "Invitér en ven"-belønningslogik (docs/DECISIONS.md 2026-09-02).
//
// VIGTIGT GAP: der findes endnu intet rigtigt invitations-/henvisningskode-
// eller signup-attribution-mekanisme i appen (ingen konto-login-system
// generelt endnu, se docs/STATUS.md "Next work" #4) — så der er i dag ingen
// måde at vide, hvem der faktisk inviterede hvem. Denne fil er derfor kun den
// beregningslogik, der skal køre, DEN DAG en Referral-række faktisk kan
// oprettes af et rigtigt invite-link/attribution-flow. Ingen fake
// referral-kode er opfundet her.
//
// Regel: når en inviteret bruger har været registreret i mindst 3 måneder,
// og belønningen for den Referral-række ikke allerede er givet, krediteres
// afsenderen 1 gratis måned — op til et loft på 12 gratis måneder nogensinde.

const REWARD_AFTER_MONTHS = 3;
const MAX_FREE_MONTHS = 12;

function monthsSince(date: Date, now: Date): number {
  return (
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth()) -
    (now.getDate() < date.getDate() ? 1 : 0)
  );
}

/**
 * Kan kaldes periodisk (fx fra en fremtidig cron), eller manuelt for en
 * enkelt bruger. Ikke selv koblet til noget kørende cron endnu — se
 * docs/STATUS.md.
 */
export async function grantEligibleReferralRewards(now: Date = new Date()) {
  const pending = await prisma.referral.findMany({
    where: { rewardGrantedAt: null },
    include: { referrer: true },
  });

  let granted = 0;
  for (const referral of pending) {
    if (monthsSince(referral.referredRegisteredAt, now) < REWARD_AFTER_MONTHS) continue;
    if (referral.referrer.freeMonthsCredited >= MAX_FREE_MONTHS) continue;

    await prisma.$transaction([
      prisma.referral.update({
        where: { id: referral.id },
        data: { rewardGrantedAt: now },
      }),
      prisma.user.update({
        where: { id: referral.referrerId },
        data: { freeMonthsCredited: { increment: 1 } },
      }),
    ]);
    granted += 1;
  }

  return { checked: pending.length, granted };
}
