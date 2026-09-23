import { SignJWT, jwtVerify } from "jose";

// Session for almindelige brugere (passkey-login, docs/PRIVACY.md). Samme
// JWT/cookie-mønster som src/lib/admin-auth.ts, men et separat cookie-navn/
// secret, så en admin-session og en brugersession aldrig kan forveksles.

export const USER_SESSION_COOKIE = "hc_user_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dage
export const USER_SESSION_MAX_AGE = SESSION_TTL_SECONDS;

function getSecretKey() {
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  }
  return new TextEncoder().encode(secret);
}

export async function signUserSession(userId: string) {
  return new SignJWT({ sub: userId, purpose: "user-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyUserSession(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "user-session" || typeof payload.sub !== "string") return null;
    // "Log ind som bruger" er fjernet (docs/PRIVACY.md, docs/DECISIONS.md
    // 2026-09-23). Sessioner, en admin tidligere har udstedt, afvises.
    if (payload.impersonatedBy !== undefined) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}
