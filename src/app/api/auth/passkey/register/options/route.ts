import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { USER_WEBAUTHN_CHALLENGE_MAX_AGE, USER_WEBAUTHN_REG_COOKIE, signUserWebauthnChallenge } from "@/lib/user-auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";

// Trin 1: slå Face ID / passkey til for den indloggede bruger.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const existing = await prisma.passkey.findMany({ where: { userId: user.id } });
  const { rpID } = getWebauthnRelyingParty(req);

  const options = await generateRegistrationOptions({
    rpName: "Hello Cal",
    rpID,
    userName: user.email,
    userDisplayName: user.displayName || user.email,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    // Discoverable: login kræver ikke e-mail først; telefonen viser Face ID.
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  const response = NextResponse.json(options);
  response.cookies.set(USER_WEBAUTHN_REG_COOKIE, await signUserWebauthnChallenge("reg", options.challenge, user.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: USER_WEBAUTHN_CHALLENGE_MAX_AGE,
  });
  return response;
}
