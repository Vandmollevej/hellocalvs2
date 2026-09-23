import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { consumeEmailLinkToken } from "@/lib/email-link";
import { setUserSessionCookie } from "@/lib/user-session-cookie";
import { redeemInviteOnSignup } from "@/lib/invite-links";
import { clearPendingCeremony, getUserRelyingParty, readPendingCeremony } from "@/lib/user-webauthn";

// POST /api/auth/passkey/register/verify — { response }
// Afslutter en ceremoni startet i ../options. Opretter kontoen ved signup,
// afslutter gendannelsessagen ved recovery, og logger brugeren ind.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { response?: RegistrationResponseJSON } | null;
  if (!body?.response) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  const pending = await readPendingCeremony("reg");
  if (!pending) return NextResponse.json({ message: "Registreringen er udløbet, prøv igen" }, { status: 400 });

  const { rpID, origin } = getUserRelyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return NextResponse.json({ message: "Kunne ikke verificere passkey" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ message: "Kunne ikke verificere passkey" }, { status: 400 });
  }
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const passkeyData = {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    name: "Passkey",
  };

  if (pending.mode === "signup") {
    const token = pending.refId ? await prisma.emailLinkToken.findUnique({ where: { id: pending.refId } }) : null;
    if (!token || token.usedAt || token.expiresAt < new Date() || !(await consumeEmailLinkToken(token.id))) {
      return NextResponse.json({ message: "Linket er udløbet. Start forfra." }, { status: 400 });
    }
    const taken = await prisma.user.findUnique({ where: { emailHash: token.emailHash }, select: { id: true } });
    if (taken) return NextResponse.json({ message: "Der findes allerede en konto" }, { status: 409 });

    await prisma.user.create({
      data: {
        id: pending.userId,
        emailHash: token.emailHash,
        emailVerifiedAt: new Date(),
        passkeys: { create: passkeyData },
      },
    });
    if (pending.referralCode) await redeemInviteOnSignup(pending.referralCode, pending.userId);
  } else if (pending.mode === "recovery") {
    const request = pending.refId ? await prisma.recoveryRequest.findUnique({ where: { id: pending.refId } }) : null;
    if (!request || request.status !== "APPROVED" || request.expiresAt < new Date()) {
      return NextResponse.json({ message: "Gendannelsen er udløbet" }, { status: 403 });
    }
    // Kuverterne for gamle passkeys beholdes: enheder, brugeren stadig har,
    // virker fortsat. Klienten lægger en ny kuvert for den nye passkey.
    await prisma.$transaction([
      prisma.passkey.create({ data: { userId: pending.userId, ...passkeyData } }),
      prisma.recoveryRequest.update({
        where: { id: request.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      }),
    ]);
  } else {
    await prisma.passkey.create({ data: { userId: pending.userId, ...passkeyData } });
  }

  const response = NextResponse.json({ ok: true, credentialId: credential.id, userId: pending.userId });
  clearPendingCeremony(response);
  await setUserSessionCookie(response, pending.userId);
  return response;
}
