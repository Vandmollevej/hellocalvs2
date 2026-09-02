import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "hc_admin_session";
export const ADMIN_MFA_COOKIE = "hc_admin_mfa";
export const ADMIN_SETUP_COOKIE = "hc_admin_setup";
export const ADMIN_WEBAUTHN_REG_CHALLENGE_COOKIE = "hc_admin_webauthn_reg";
export const ADMIN_WEBAUTHN_AUTH_CHALLENGE_COOKIE = "hc_admin_webauthn_auth";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const MFA_TTL_SECONDS = 5 * 60; // 5 minutes to enter the TOTP code
const SETUP_TTL_SECONDS = 10 * 60; // 10 minutes to scan the QR code and confirm
const WEBAUTHN_CHALLENGE_TTL_SECONDS = 2 * 60; // 2 minutes to complete the Face ID/passkey ceremony

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
export const ADMIN_WEBAUTHN_CHALLENGE_MAX_AGE = WEBAUTHN_CHALLENGE_TTL_SECONDS;

type RegChallengePending = { purpose: "webauthn-reg"; userId: string; challenge: string };
type AuthChallengePending = { purpose: "webauthn-auth"; challenge: string };

export async function signWebauthnRegChallenge(userId: string, challenge: string) {
  return new SignJWT({ purpose: "webauthn-reg", userId, challenge } satisfies RegChallengePending)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${WEBAUTHN_CHALLENGE_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyWebauthnRegChallenge(token: string): Promise<RegChallengePending | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "webauthn-reg" || typeof payload.userId !== "string" || typeof payload.challenge !== "string") {
      return null;
    }
    return { purpose: "webauthn-reg", userId: payload.userId, challenge: payload.challenge };
  } catch {
    return null;
  }
}

export async function signWebauthnAuthChallenge(challenge: string) {
  return new SignJWT({ purpose: "webauthn-auth", challenge } satisfies AuthChallengePending)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${WEBAUTHN_CHALLENGE_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyWebauthnAuthChallenge(token: string): Promise<AuthChallengePending | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "webauthn-auth" || typeof payload.challenge !== "string") return null;
    return { purpose: "webauthn-auth", challenge: payload.challenge };
  } catch {
    return null;
  }
}
