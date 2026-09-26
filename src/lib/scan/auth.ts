import { SignJWT, jwtVerify } from "jose";

// Login til Oprettelses-appen (docs/OPRETTELSES-APP.md): brugernavn +
// adgangskode + TOTP, samme mønster som admin-login (src/lib/admin-auth.ts),
// men egne cookies og egne JWT-"purpose"-værdier, så en medarbejder-session
// aldrig kan forveksles med en admin- eller brugersession.

export const SCAN_SESSION_COOKIE = "hc_scan_session";
export const SCAN_MFA_COOKIE = "hc_scan_mfa";
export const SCAN_SETUP_COOKIE = "hc_scan_setup";

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MFA_TTL_SECONDS = 5 * 60;
const SETUP_TTL_SECONDS = 15 * 60;

export const SCAN_SESSION_MAX_AGE = SESSION_TTL_SECONDS;
export const SCAN_MFA_MAX_AGE = MFA_TTL_SECONDS;
export const SCAN_SETUP_MAX_AGE = SETUP_TTL_SECONDS;

function getSecretKey() {
  const secret = process.env.SCAN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SCAN_SESSION_SECRET (eller ADMIN_SESSION_SECRET) mangler eller er for kort");
  }
  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>, ttlSeconds: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getSecretKey());
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

export function signScanSession(workerId: string) {
  return sign({ sub: workerId, purpose: "scan-session" }, SESSION_TTL_SECONDS);
}

export function verifyScanSession(token: string) {
  return verifySubject(token, "scan-session");
}

export function signScanMfaPending(workerId: string) {
  return sign({ sub: workerId, purpose: "scan-mfa-pending" }, MFA_TTL_SECONDS);
}

export function verifyScanMfaPending(token: string) {
  return verifySubject(token, "scan-mfa-pending");
}

// Opsætning fra invitationslinket: den valgte adgangskode og TOTP-hemmelighed
// holdes i en kortlivet signeret cookie, indtil medarbejderen har bekræftet
// en første TOTP-kode — først derefter skrives de på ScanWorker.
type SetupPending = { workerId: string; username: string; passwordHash: string; totpSecret: string };

export function signScanSetupPending(data: SetupPending) {
  return sign({ ...data, purpose: "scan-setup-pending" }, SETUP_TTL_SECONDS);
}

export async function verifyScanSetupPending(token: string): Promise<SetupPending | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.purpose !== "scan-setup-pending" ||
      typeof payload.workerId !== "string" ||
      typeof payload.username !== "string" ||
      typeof payload.passwordHash !== "string" ||
      typeof payload.totpSecret !== "string"
    ) {
      return null;
    }
    return {
      workerId: payload.workerId,
      username: payload.username,
      passwordHash: payload.passwordHash,
      totpSecret: payload.totpSecret,
    };
  } catch {
    return null;
  }
}

export const SCAN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
