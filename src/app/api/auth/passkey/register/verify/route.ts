import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { USER_WEBAUTHN_REG_COOKIE, verifyUserWebauthnChallenge } from "@/lib/user-auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";
import { describeDevice } from "@/lib/user-login";

// Trin 2: gem den nye passkey på brugerens konto.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = (await req.json().catch(() => null)) as { response?: RegistrationResponseJSON } | null;
  if (!body?.response) return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });

  const store = await cookies();
  const pending = await verifyUserWebauthnChallenge("reg", store.get(USER_WEBAUTHN_REG_COOKIE)?.value);
  if (!pending || pending.userId !== user.id) {
    return NextResponse.json({ message: "Forsøget er udløbet, prøv igen" }, { status: 400 });
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
    return NextResponse.json({ message: "Kunne ikke slå Face ID til" }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ message: "Kunne ikke slå Face ID til" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await prisma.passkey.create({
    data: {
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: describeDevice(req.headers.get("user-agent")),
    },
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(USER_WEBAUTHN_REG_COOKIE);
  return response;
}
