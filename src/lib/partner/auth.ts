import { SignJWT, jwtVerify } from "jose";

// Session til partnerportalen (/partner) for B2B-brugere (docs/DECISIONS.md
// 2026-10-02). Egen cookie og egen JWT-"purpose", så en partnersession aldrig
// kan forveksles med en admin-, medarbejder- eller brugersession. Samme
// hemmelighed som admin-sessionen, medmindre PARTNER_SESSION_SECRET er sat.

export const PARTNER_SESSION_COOKIE = "hc_partner_session";

const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const PARTNER_SESSION_MAX_AGE = SESSION_TTL_SECONDS;

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
