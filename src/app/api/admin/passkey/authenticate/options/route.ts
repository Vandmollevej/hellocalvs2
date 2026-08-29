import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { ADMIN_WEBAUTHN_AUTH_CHALLENGE_COOKIE, ADMIN_WEBAUTHN_CHALLENGE_MAX_AGE, signWebauthnAuthChallenge } from "@/lib/admin-auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";

// No allowCredentials: this is a discoverable/usernameless flow — the
// browser/OS (e.g. Face ID + iCloud Keychain on iPhone) shows whichever
// passkeys it has for this site without the server naming one up front.
export async function POST(req: Request) {
  const { rpID } = getWebauthnRelyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "preferred" });

  const challengeToken = await signWebauthnAuthChallenge(options.challenge);
  const response = NextResponse.json(options);
  response.cookies.set(ADMIN_WEBAUTHN_AUTH_CHALLENGE_COOKIE, challengeToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_WEBAUTHN_CHALLENGE_MAX_AGE,
  });
  return response;
}
