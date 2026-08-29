import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/require-admin";
import {
  ADMIN_WEBAUTHN_CHALLENGE_MAX_AGE,
  ADMIN_WEBAUTHN_REG_CHALLENGE_COOKIE,
  signWebauthnRegChallenge,
} from "@/lib/admin-auth";
import { getWebauthnRelyingParty, WEBAUTHN_RP_NAME } from "@/lib/admin-webauthn";

// Step 1 of adding a passkey (e.g. Face ID on iPhone via iCloud Keychain) to
// the logged-in admin account. Requires an existing session — registering a
// new credential is not something an unauthenticated visitor may initiate.
export async function POST(req: Request) {
  const admin = await requireAdminUser();
  if (!admin) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const existing = await prisma.passkey.findMany({ where: { userId: admin.id } });
  const { rpID } = getWebauthnRelyingParty(req);

  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_RP_NAME,
    rpID,
    userName: admin.email,
    userDisplayName: admin.displayName || admin.email,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    // residentKey "required" makes this a discoverable credential, so login
    // later doesn't need to know the email first — the browser/OS shows an
    // account/Face ID picker directly.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });

  const challengeToken = await signWebauthnRegChallenge(admin.id, options.challenge);
  const response = NextResponse.json(options);
  response.cookies.set(ADMIN_WEBAUTHN_REG_CHALLENGE_COOKIE, challengeToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_WEBAUTHN_CHALLENGE_MAX_AGE,
  });
  return response;
}
