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

export type AdminSessionLevel = "READ" | "FULL";

// "lvl" ligger i selve sessionen, så middleware kan blokere skrivninger for
// læseadgang uden databaseopslag. Sessioner uden "lvl" er udstedt til den
// første administrator, før Admin-brugere fandtes, og er FULL.
export async function signAdminSession(userId: string, level: AdminSessionLevel = "FULL") {
  return new SignJWT({ sub: userId, purpose: "admin-session", lvl: level })
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

export async function verifyAdminSessionInfo(token: string): Promise<{ userId: string; level: AdminSessionLevel; issuedAt: number } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "admin-session" || typeof payload.sub !== "string") return null;
    return { userId: payload.sub, level: payload.lvl === "READ" ? "READ" : "FULL", issuedAt: (payload.iat ?? 0) * 1000 };
  } catch {
    return null;
  }
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

// Admin-brugere (docs/DECISIONS.md 2026-09-29): invitation, godkendelse af ny enhed.
export const ADMIN_DEVICE_COOKIE = "hc_admin_device";
export const ADMIN_INVITE_COOKIE = "hc_admin_invite";
export const ADMIN_APPROVAL_COOKIE = "hc_admin_approval";
export const ADMIN_DEVICE_MAX_AGE = 365 * 24 * 60 * 60;
export const ADMIN_APPROVAL_MAX_AGE = 15 * 60;

type InvitePending = { inviteId: string; passwordHash: string; totpSecret: string };

export async function signAdminInvitePending(data: InvitePending) {
  return new SignJWT({ ...data, purpose: "admin-invite-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SETUP_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAdminInvitePending(token: string): Promise<InvitePending | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.purpose !== "admin-invite-pending" ||
      typeof payload.inviteId !== "string" ||
      typeof payload.passwordHash !== "string" ||
      typeof payload.totpSecret !== "string"
    ) {
      return null;
    }
    return { inviteId: payload.inviteId, passwordHash: payload.passwordHash, totpSecret: payload.totpSecret };
  } catch {
    return null;
  }
}

export async function signAdminApprovalPending(approvalId: string) {
  return new SignJWT({ sub: approvalId, purpose: "admin-approval-pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_APPROVAL_MAX_AGE}s`)
    .sign(getSecretKey());
}

export function verifyAdminApprovalPending(token: string) {
  return verify(token, "admin-approval-pending");
}
