import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUserRelyingParty, setPendingCeremony } from "@/lib/user-webauthn";

// POST /api/auth/passkey/login/options — brugernavnsløst login: telefonen
// viser selv de passkeys, den har til Hello Cal. PRF-udvidelsen tilføjes af
// klienten (src/lib/vault/webauthn-client.ts), så PRF-outputtet aldrig
// forlader enheden.
export async function POST(req: Request) {
  const { rpID } = getUserRelyingParty(req);
  const options = await generateAuthenticationOptions({ rpID, userVerification: "required" });
  const response = NextResponse.json(options);
  await setPendingCeremony(response, { kind: "auth", challenge: options.challenge });
  return response;
}
