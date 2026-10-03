import { SignJWT, jwtVerify } from "jose";

// Session til partnerportalen (/partner) for B2B-brugere (docs/DECISIONS.md
// 2026-10-02). Egen cookie og egen JWT-"purpose", så en partnersession aldrig
// kan forveksles med en admin-, medarbejder- eller brugersession. Samme
// hemmelighed som admin-sessionen, medmindre PARTNER_SESSION_SECRET er sat.

export const PARTNER_SESSION_COOKIE = "hc_partner_session";
export const PARTNER_MFA_COOKIE = "hc_partner_mfa";
export const PARTNER_SETUP_COOKIE = "hc_partner_setup";

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MFA_TTL_SECONDS = 5 * 60; // tid til at taste 2-faktor-koden efter adgangskoden
const SETUP_TTL_SECONDS = 15 * 60; // tid til at scanne QR-koden og bekræfte ved tilmelding
export const PARTNER_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
export const PARTNER_MFA_MAX_AGE = MFA_TTL_SECONDS;
export const PARTNER_SETUP_MAX_AGE = SETUP_TTL_SECONDS;

export const PARTNER_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

function getSecretKey() {
  const secret = process.env.PARTNER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("PARTNER_SESSION_SECRET (eller ADMIN_SESSION_SECRET) mangler eller er for kort");
  }
  return new TextEncoder().encode(secret);
}

export function signPartnerSession(partnerUserId: string) {
  return new SignJWT({ sub: partnerUserId, purpose: "partner-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyPartnerSession(token: string): Promise<{ partnerUserId: string; issuedAt: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "partner-session" || typeof payload.sub !== "string") return null;
    return { partnerUserId: payload.sub, issuedAt: (payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
}

async function verifySubject(token: string, purpose: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== purpose || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

// Mellemtrin efter korrekt adgangskode: kun en kortlivet cookie, ingen session endnu.
export function signPartnerMfaPending(partnerUserId: string) {
  return new SignJWT({ sub: partnerUserId, purpose: "partner-mfa-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export function verifyPartnerMfaPending(token: string) {
  return verifySubject(token, "partner-mfa-pending");
}

// Tilmelding: den valgte adgangskode og TOTP-hemmeligheden holdes i en
// kortlivet signeret cookie, til første 2-faktor-kode er bekræftet — først
// derefter skrives de på brugeren.
type InvitePending = { partnerUserId: string; passwordHash: string; totpSecret: string };

export function signPartnerInvitePending(data: InvitePending) {
  return new SignJWT({ ...data, purpose: "partner-invite-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SETUP_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyPartnerInvitePending(token: string): Promise<InvitePending | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.purpose !== "partner-invite-pending" ||
      typeof payload.partnerUserId !== "string" ||
      typeof payload.passwordHash !== "string" ||
      typeof payload.totpSecret !== "string"
    ) {
      return null;
    }
    return { partnerUserId: payload.partnerUserId, passwordHash: payload.passwordHash, totpSecret: payload.totpSecret };
  } catch {
    return null;
  }
}
