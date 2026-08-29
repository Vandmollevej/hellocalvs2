import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  ADMIN_WEBAUTHN_AUTH_CHALLENGE_COOKIE,
  signAdminSession,
  verifyWebauthnAuthChallenge,
} from "@/lib/admin-auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

const GENERIC_FAILURE = { message: "Kunne ikke logge ind med passkey" };

// A verified passkey assertion already proves possession of the device plus
// biometric/PIN user verification (Face ID etc.) — equivalent to password +
// TOTP combined — so success here grants a full session directly.
export async function POST(req: Request) {
  let body: { response?: AuthenticationResponseJSON };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }
  const credentialId = body.response?.id;
  if (!credentialId) return NextResponse.json(GENERIC_FAILURE, { status: 401 });

  const rateLimitKey = `passkey:${credentialId}`;
  if (isLocked(rateLimitKey)) {
    return NextResponse.json({ message: "For mange forsøg. Prøv igen senere." }, { status: 429 });
  }

  const store = await cookies();
  const challengeToken = store.get(ADMIN_WEBAUTHN_AUTH_CHALLENGE_COOKIE)?.value;
  const pending = challengeToken ? await verifyWebauthnAuthChallenge(challengeToken) : null;
  if (!pending) {
    return NextResponse.json({ message: "Login-forsøget er udløbet, prøv igen" }, { status: 400 });
  }

  const passkey = await prisma.passkey.findUnique({ where: { credentialId }, include: { user: true } });
  if (!passkey || passkey.user.role !== "ADMIN" || !passkey.user.passwordHash) {
    recordFailure(rateLimitKey);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }

  const { rpID, origin } = getWebauthnRelyingParty(req);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response!,
      expectedChallenge: pending.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    recordFailure(rateLimitKey);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  if (!verification.verified) {
    recordFailure(rateLimitKey);
    return NextResponse.json(GENERIC_FAILURE, { status: 401 });
  }
  recordSuccess(rateLimitKey);

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });

  const sessionToken = await signAdminSession(passkey.userId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  response.cookies.delete(ADMIN_WEBAUTHN_AUTH_CHALLENGE_COOKIE);
  return response;
}
