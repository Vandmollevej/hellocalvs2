import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/email-link";
import { awardPoints } from "@/lib/points";

// "Invitér en ven" (docs/PRIVACY.md "Sociale funktioner"), erstatter den
// gamle Referral-kobling (docs/DECISIONS.md 2026-09-02).
//
// Afsenderen laver et engangslink og deler det selv. Når en ny bruger
// opretter sig via linket, SLETTES linket, og der oprettes to uafhængige
// ventende belønninger (én pr. bruger) uden fælles ID. Serveren ved derefter
// ikke, hvem der inviterede hvem.
//
// Belønningen er uændret: 300 points til begge efter 3 måneder. Kendt
// konsekvens: afsenderens belønning kan ikke længere afhænge af, at den nye
// konto stadig findes efter 3 måneder.

const LINK_VALID_DAYS = 30;
const REWARD_AFTER_MONTHS = 3;
const REFERRAL_POINTS = 300;
const MAX_OPEN_LINKS = 20;

export async function createInviteLink(inviterId: string): Promise<{ code: string; expiresAt: Date }> {
  const open = await prisma.inviteLink.count({ where: { inviterId, expiresAt: { gt: new Date() } } });
  if (open >= MAX_OPEN_LINKS) throw new Error("For mange åbne invitationslinks");
  const code = randomBytes(12).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_VALID_DAYS * 24 * 60 * 60 * 1000);
  await prisma.inviteLink.create({ data: { inviterId, codeHash: hashToken(code), expiresAt } });
  return { code, expiresAt };
}

function eligibleDate(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + REWARD_AFTER_MONTHS, now.getUTCDate()));
  return d;
}

export async function redeemInviteOnSignup(code: string, newUserId: string) {
  const link = await prisma.inviteLink.findUnique({ where: { codeHash: hashToken(code) } });
  if (!link || link.expiresAt < new Date() || link.inviterId === newUserId) return;
  const eligibleOn = eligibleDate(new Date());
  await prisma.$transaction([
    prisma.inviteLink.delete({ where: { id: link.id } }),
    prisma.inviteReward.create({ data: { userId: link.inviterId, eligibleOn } }),
    prisma.inviteReward.create({ data: { userId: newUserId, eligibleOn } }),
  ]);
}

// Kaldes af src/lib/scheduler.ts.
export async function grantDueInviteRewards(now: Date = new Date()) {
  const due = await prisma.inviteReward.findMany({
    where: { grantedAt: null, eligibleOn: { lte: now } },
    select: { id: true, userId: true },
    take: 500,
  });
  for (const reward of due) {
    const claimed = await prisma.inviteReward.updateMany({
      where: { id: reward.id, grantedAt: null },
      data: { grantedAt: now },
    });
    if (claimed.count === 1) await awardPoints(reward.userId, "FRIEND_REFERRAL", REFERRAL_POINTS);
  }
  return { granted: due.length };
}

export async function listInviteStatus(userId: string) {
  const [openLinks, rewards] = await Promise.all([
    prisma.inviteLink.count({ where: { inviterId: userId, expiresAt: { gt: new Date() } } }),
    prisma.inviteReward.findMany({
      where: { userId },
      select: { eligibleOn: true, grantedAt: true },
      orderBy: { eligibleOn: "desc" },
    }),
  ]);
  return { openLinks, rewards };
}
