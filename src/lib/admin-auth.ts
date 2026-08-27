import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "hc_admin_session";
export const ADMIN_MFA_COOKIE = "hc_admin_mfa";
export const ADMIN_SETUP_COOKIE = "hc_admin_setup";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 timer
const MFA_TTL_SECONDS = 5 * 60; // 5 minutter til at indtaste TOTP-koden
const SETUP_TTL_SECONDS = 10 * 60; // 10 minutter til at scanne QR-koden og bekræfte

function getSecretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET mangler eller er for kort");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminSession(userId: string) {
  return new SignJWT({ sub: userId, purpose: "admin-session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function signAdminMfaPending(userId: string) {
  return new SignJWT({ sub: userId, purpose: "admin-mfa-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

async function verify(token: string, purpose: string) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== purpose || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function verifyAdminSession(token: string) {
  return verify(token, "admin-session");
}

export function verifyAdminMfaPending(token: string) {
  return verify(token, "admin-mfa-pending");
}

type SetupPending = { email: string; passwordHash: string; totpSecret: string };

export async function signAdminSetupPending(data: SetupPending) {
  return new SignJWT({ ...data, purpose: "admin-setup-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SETUP_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAdminSetupPending(token: string): Promise<SetupPending | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.purpose !== "admin-setup-pending" ||
      typeof payload.email !== "string" ||
      typeof payload.passwordHash !== "string" ||
      typeof payload.totpSecret !== "string"
    ) {
      return null;
    }
    return { email: payload.email, passwordHash: payload.passwordHash, totpSecret: payload.totpSecret };
  } catch {
    return null;
  }
}

export const ADMIN_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
export const ADMIN_MFA_MAX_AGE = MFA_TTL_SECONDS;
export const ADMIN_SETUP_MAX_AGE = SETUP_TTL_SECONDS;
