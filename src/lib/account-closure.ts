import { prisma } from "@/lib/prisma";
import { anonymizeUser } from "@/lib/gdpr";
import { cancelStripe } from "@/lib/payments/stripe-subscription";
import { cancelMobilePay } from "@/lib/payments/mobilepay-subscription";

// "Luk konto" (docs/DECISIONS.md 2026-10-03): kontoen lukkes og brugeren
// logges ud overalt, men intet slettes. Logger brugeren ind igen inden for
// 3 måneder, genåbnes kontoen. Derefter anonymiseres den som "Ret til at
// blive glemt" (src/lib/gdpr.ts), som stadig sker med det samme.
export const CLOSE_GRACE_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export function closureDeadline(closedAt: Date): Date {
  return new Date(closedAt.getTime() + CLOSE_GRACE_DAYS * DAY_MS);
}

export function isClosureExpired(closedAt: Date, now: Date = new Date()): boolean {
  return closureDeadline(closedAt) <= now;
}

export async function closeAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role === "ADMIN") {
    throw new Error("Kan ikke lukke en administratorkonto");
  }
  if (user.forgottenAt || user.closedAt) return;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { closedAt: new Date() } }),
    prisma.adminAuditLog.create({ data: { adminId: userId, action: "USER_CLOSE_ACCOUNT", targetUserId: userId } }),
  ]);

  // En lukket konto må ikke blive ved med at trække penge: abonnementet
  // opsiges (Stripe til periodens udløb, MobilePay-aftalen stoppes). Ingen
  // betaling (gratis, familie) er ikke en fejl.
  await cancelStripe(userId).catch(() => undefined);
  await cancelMobilePay(userId).catch(() => undefined);
}

// Kaldes ved hvert login (src/lib/user-login.ts). Inden for fristen genåbnes
// kontoen; efter fristen afvises sessionen (src/lib/session.ts), til
// vedligeholdelsesjobbet har anonymiseret den.
export async function reopenClosedAccount(userId: string, now: Date = new Date()) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { closedAt: true } });
  if (!user?.closedAt || isClosureExpired(user.closedAt, now)) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { closedAt: null } }),
    prisma.adminAuditLog.create({ data: { adminId: userId, action: "USER_REOPEN_ACCOUNT", targetUserId: userId } }),
  ]);
}

// Vedligehold (src/lib/scheduler.ts): anonymiserer konti, der har været
// lukket i over 3 måneder.
export async function anonymizeExpiredClosedAccounts(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CLOSE_GRACE_DAYS * DAY_MS);
  const expired = await prisma.user.findMany({
    where: { closedAt: { lte: cutoff }, forgottenAt: null },
    select: { id: true },
    take: 50,
  });
  let count = 0;
  for (const { id } of expired) {
    try {
      await anonymizeUser(id, id);
      count += 1;
    } catch (error) {
      console.error("[account-closure] anonymisering fejlede", id, error);
    }
  }
  return count;
}
