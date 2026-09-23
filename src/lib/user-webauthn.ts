import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// Passkey-login for almindelige brugere (docs/PRIVACY.md "Login og e-mail").
// Samme mønster som admin-passkeys (src/lib/admin-auth.ts), men egne
// cookie-navne og formål, så de to domæner aldrig kan forveksles.

export const USER_WEBAUTHN_COOKIE = "hc_user_webauthn";
const TTL_SECONDS = 5 * 60;

export const WEBAUTHN_USER_RP_NAME = "Hello Cal";

// Fast PRF-input. PRF-outputtet er alligevel unikt pr. passkey (det afhænger
// af passkeyens egen hemmelighed), så saltet behøver ikke være hemmeligt.
export const PRF_SALT_LABEL = "hellocal/prf/v1";

export type RegistrationMode = "signup" | "recovery" | "add";

export type PendingRegistration = {
  kind: "reg";
  challenge: string;
  userId: string;
  mode: RegistrationMode;
  // signup: id på EmailLinkToken; recovery: id på RecoveryRequest.
  refId?: string;
  referralCode?: string;
};

export type PendingAuthentication = { kind: "auth"; challenge: string };

type Pending = PendingRegistration | PendingAuthentication;

function secret() {
  const value = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  return new TextEncoder().encode(value);
}

export async function setPendingCeremony(response: NextResponse, pending: Pending) {
  const token = await new SignJWT({ purpose: "user-webauthn", ...pending })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());
  response.cookies.set(USER_WEBAUTHN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function readPendingCeremony<K extends Pending["kind"]>(
  kind: K
): Promise<Extract<Pending, { kind: K }> | null> {
  const store = await cookies();
  const token = store.get(USER_WEBAUTHN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== "user-webauthn" || payload.kind !== kind || typeof payload.challenge !== "string") {
      return null;
    }
    return payload as unknown as Extract<Pending, { kind: K }>;
  } catch {
    return null;
  }
}

export function clearPendingCeremony(response: NextResponse) {
  response.cookies.delete(USER_WEBAUTHN_COOKIE);
}

// Samme afledning som admin: RP-ID og origin følger den faktiske host.
export function getUserRelyingParty(req: Request) {
  const originHeader = req.headers.get("origin");
  const hostHeader = req.headers.get("host") ?? "localhost";
  const origin = originHeader ?? `http://${hostHeader}`;
  return { rpID: new URL(origin).hostname, origin };
}
