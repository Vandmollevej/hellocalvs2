import { SignJWT, jwtVerify } from "jose";

// Rigtig session for almindelige brugere — mangler indtil nu (docs/STATUS.md
// "Next work" #4: "Implement account authentication before inviting other
// users"). Hele resten af appen har hidtil brugt én delt getDemoUser()
// (src/lib/demo-user.ts) i stedet for en rigtig session, hvilket ikke kan
// bære pointsystemet, "videresend til en ven", "invitér en ven" eller
// notifikationspræferencer — alle kræver at kunne kende to FORSKELLIGE
// brugere fra hinanden. Samme JWT/cookie-mønster som src/lib/admin-auth.ts,
// men et separat cookie-navn/secret, så en admin-session og en almindelig
// brugersession aldrig kan forveksles.
//
// Eksisterende ruter der stadig bruger getDemoUser() er bevidst IKKE migreret
// her — det er en større, separat migrering, se docs/STATUS.md. Denne fil
// bruges kun af de NYE ruter i pointsystem-batchen (2026-09-02/03).

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

// "Log ind som bruger" (admin-support, docs/DECISIONS.md 2026-09-02):
// samme session-form, men med et ekstra felt så vi ved den er admin-mintet,
// hvis det senere skal vises i UI'et eller udelukkes fra visse handlinger.
export async function signImpersonatedUserSession(userId: string, adminId: string) {
  return new SignJWT({ sub: userId, purpose: "user-session", impersonatedBy: adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyUserSession(token: string): Promise<{ userId: string; impersonatedBy?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.purpose !== "user-session" || typeof payload.sub !== "string") return null;
    return {
      userId: payload.sub,
      impersonatedBy: typeof payload.impersonatedBy === "string" ? payload.impersonatedBy : undefined,
    };
  } catch {
    return null;
  }
}

// Kort-levet håndsætning fra admin- til bruger-domænet (docs/DECISIONS.md
// 2026-09-02): adminHellocal.packroff.dk og hellocal.packroff.dk er
// forskellige hosts, så en cookie sat af den ene kan ikke læses af den
// anden. Admin-panelet beder om et 2-minutters engangs-link
// (GET <bruger-host>/api/auth/impersonate?token=...), som brugerdomænet
// selv veksler til den rigtige USER_SESSION_COOKIE — se
// src/app/api/admin/users/[id]/impersonate/route.ts og
// src/app/api/auth/impersonate/route.ts.
const HANDOFF_TTL_SECONDS = 2 * 60;

export async function signImpersonationHandoff(userId: string, adminId: string) {
  return new SignJWT({ sub: userId, purpose: "impersonation-handoff", adminId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${HANDOFF_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyImpersonationHandoff(token: string): Promise<{ userId: string; adminId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      payload.purpose !== "impersonation-handoff" ||
      typeof payload.sub !== "string" ||
      typeof payload.adminId !== "string"
    ) {
      return null;
    }
    return { userId: payload.sub, adminId: payload.adminId };
  } catch {
    return null;
  }
}
