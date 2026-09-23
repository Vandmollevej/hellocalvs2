import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { USER_SESSION_COOKIE } from "@/lib/user-auth";

// POST /api/profile/delete-account — brugeren sletter selv sin konto
// (docs/PRIVACY.md). Boksen er allerede slettet af klienten (DELETE
// /api/vault), da kun klienten kender boksen. Her fjernes alle login- og
// nøglemidler, så kontoen ikke kan bruges eller gendannes. Rækken selv
// bevares som anonym stub, fordi ældre tabeller stadig refererer til den.
export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "USER") return NextResponse.json({ message: "Ikke logget ind" }, { status: 401 });

  const id = user.id;
  await prisma.$transaction([
    prisma.keyEnvelope.deleteMany({ where: { userId: id } }),
    prisma.recoveryShare.deleteMany({ where: { userId: id } }),
    prisma.recoveryRequest.deleteMany({ where: { userId: id } }),
    prisma.passkey.deleteMany({ where: { userId: id } }),
    prisma.inviteLink.deleteMany({ where: { inviterId: id } }),
    prisma.inviteReward.deleteMany({ where: { userId: id } }),
    prisma.deviceToken.deleteMany({ where: { userId: id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: id } }),
    prisma.userProductSearchHistory.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: {
        email: null,
        emailHash: null,
        displayName: "",
        passwordHash: null,
        totpSecret: null,
        weightKg: null,
        heightCm: null,
        birthDate: null,
        sex: null,
        targetWeightKg: null,
        wantsPushNotifications: false,
        wantsUpdateNewsEmails: false,
        wantsAdviceEmails: false,
        wantsPartnerOffersEmails: false,
        forgottenAt: new Date(),
      },
    }),
  ]);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(USER_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
