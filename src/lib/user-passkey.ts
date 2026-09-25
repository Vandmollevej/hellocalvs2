import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import {
  USER_WEBAUTHN_AUTH_COOKIE,
  USER_WEBAUTHN_CHALLENGE_MAX_AGE,
  signUserWebauthnChallenge,
  verifyUserWebauthnChallenge,
} from "@/lib/user-auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";
import { isLocked, recordFailure, recordSuccess } from "@/lib/rate-limit";

// Fælles Face ID / passkey-bekræftelse for login og "bekræft at det er dig"
// (fx billede-dagbogen). allowUserId begrænser til én brugers passkeys.

export async function passkeyChallengeResponse(req: Request, allowUserId?: string) {
  const { rpID } = getWebauthnRelyingParty(req);
  const allow = allowUserId ? await prisma.passkey.findMany({ where: { userId: allowUserId } }) : [];
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
    ...(allowUserId
      ? {
          allowCredentials: allow.map((p) => ({
            id: p.credentialId,
            transports: p.transports as AuthenticatorTransportFuture[],
          })),
        }
      : {}),
  });
  const response = NextResponse.json(options);
  response.cookies.set(USER_WEBAUTHN_AUTH_COOKIE, await signUserWebauthnChallenge("auth", options.challenge), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_WEBAUTHN_CHALLENGE_MAX_AGE,
  });
  return response;
}

// Returnerer brugerens ID ved en gyldig Face ID-bekræftelse, ellers en fejl.
export async function verifyPasskeyAssertion(
  req: Request,
  assertion: AuthenticationResponseJSON | undefined
): Promise<{ userId: string } | { error: string; status: number }> {
  const credentialId = assertion?.id;
  if (!assertion || !credentialId) return { error: "Kunne ikke bekræfte med Face ID", status: 401 };

  const rateLimitKey = `user-passkey:${credentialId}`;
  if (isLocked(rateLimitKey)) return { error: "For mange forsøg. Prøv igen senere.", status: 429 };

  const store = await cookies();
  const pending = await verifyUserWebauthnChallenge("auth", store.get(USER_WEBAUTHN_AUTH_COOKIE)?.value);
  if (!pending) return { error: "Forsøget er udløbet, prøv igen", status: 400 };

  const passkey = await prisma.passkey.findUnique({ where: { credentialId }, include: { user: true } });
  if (!passkey || passkey.user.forgottenAt) {
    recordFailure(rateLimitKey);
    return { error: "Face ID er ikke slået til for denne konto", status: 401 };
  }

  const { rpID, origin } = getWebauthnRelyingParty(req);
  try {
    const verification = await verifyAuthenticationResponse({
      response: assertion,
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
    if (!verification.verified) throw new Error("not verified");
    await prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });
  } catch {
    recordFailure(rateLimitKey);
    return { error: "Kunne ikke bekræfte med Face ID", status: 401 };
  }
  recordSuccess(rateLimitKey);
  return { userId: passkey.userId };
}
