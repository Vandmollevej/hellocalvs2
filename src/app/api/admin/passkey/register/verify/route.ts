import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import { ADMIN_WEBAUTHN_REG_CHALLENGE_COOKIE, verifyWebauthnRegChallenge } from "@/lib/admin-auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";

export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let body: { response?: RegistrationResponseJSON; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  if (!body.response) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  const store = await cookies();
  const challengeToken = store.get(ADMIN_WEBAUTHN_REG_CHALLENGE_COOKIE)?.value;
  const pending = challengeToken ? await verifyWebauthnRegChallenge(challengeToken) : null;
  if (!pending || pending.userId !== admin.id) {
    return NextResponse.json({ message: "Registreringen er udløbet, prøv igen" }, { status: 400 });
  }

  const { rpID, origin } = getWebauthnRelyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ message: "Kunne ikke verificere passkey" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ message: "Kunne ikke verificere passkey" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await prisma.passkey.create({
    data: {
      userId: admin.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: body.name?.trim() || "Passkey",
    },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_WEBAUTHN_REG_CHALLENGE_COOKIE);
  return response;
}
