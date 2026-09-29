import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { SCAN_COOKIE_OPTIONS, SCAN_WEBAUTHN_AUTH_COOKIE, SCAN_WEBAUTHN_MAX_AGE, signScanWebauthnChallenge } from "@/lib/scan/auth";
import { getWebauthnRelyingParty } from "@/lib/admin-webauthn";

// Brugernavnsløst login: telefonen viser selv de passkeys, den har til siden.
export async function POST(req: Request) {
  const { rpID } = getWebauthnRelyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });

  const response = NextResponse.json(options);
  response.cookies.set(SCAN_WEBAUTHN_AUTH_COOKIE, await signScanWebauthnChallenge(options.challenge), {
    ...SCAN_COOKIE_OPTIONS,
    maxAge: SCAN_WEBAUTHN_MAX_AGE,
  });
  return response;
}
