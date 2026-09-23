import { prisma } from "@/lib/prisma";

// "Ret til at blive glemt" (docs/DECISIONS.md 2026-09-02). Brugeren
// hård-slettes IKKE: mange tabeller (Registration, Dish, Referral m.fl.)
// kræver userId (RESTRICT) for at bevare snapshot-princippet og historik.
// I stedet anonymiseres PII på selve User-rækken, login-midler fjernes, og
// aktive abonnementer/push-abonnementer ryddes.
export async function anonymizeUser(targetUserId: string, adminId: string) {
  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });
  if (target.role === "ADMIN") {
    throw new Error("Kan ikke anonymisere en administratorkonto");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetUserId },
      data: {
        email: `slettet-${targetUserId}@hellocal.invalid`,
        displayName: "Slettet bruger",
        passwordHash: null,
        totpSecret: null,
        weightKg: null,
        heightCm: null,
        birthDate: null,
        sex: null,
        cycleTrackingEnabled: false,
        wantsPushNotifications: false,
        wantsUpdateNewsEmails: false,
        wantsAdviceEmails: false,
        wantsPartnerOffersEmails: false,
        photoDiaryRequiresPasscode: false,
        forgottenAt: new Date(),
      },
    }),
    prisma.passkey.deleteMany({ where: { userId: targetUserId } }),
    prisma.deviceToken.deleteMany({ where: { userId: targetUserId } }),
    prisma.pushSubscription.deleteMany({ where: { userId: targetUserId } }),
    // Personlig søge-/klikhistorik til søgerangering (2026-09-19, se
    // docs/DECISIONS.md) — slettes fuldt ud, ikke kun anonymiseret, da den
    // ikke har samme historik-/snapshot-krav som Registration m.fl.
    prisma.userProductSearchHistory.deleteMany({ where: { userId: targetUserId } }),
    // Support (docs/DECISIONS.md 2026-09-23): henvendelsernes fritekst slettes,
    // og en evt. aktiv tilladelse tilbagekaldes.
    prisma.supportRequest.deleteMany({ where: { userId: targetUserId } }),
    prisma.supportAccessGrant.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.adminAuditLog.create({
      data: { adminId, action: "GDPR_FORGET_USER", targetUserId },
    }),
  ]);
}
