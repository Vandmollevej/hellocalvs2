import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import type { LoginMethod } from "@/lib/user-login";

// Overdragelse mellem system-browseren og den native app (docs/DECISIONS.md
// 2026-10-08 "Native login-overdragelse"). Appen gemmer session-cookien i sin
// egen cookie-krukke; Google/Apple/Facebook-login og integrationstilkobling
// kører i system-browseren og sendes tilbage med hellocal://-links.
//
// LOGIN:   appen åbner /api/auth/oauth/<udbyder>?native=1&challenge=<S256>.
//          Callbacken udsteder en engangskode → hellocal://auth/complete?code=…
//          Appen veksler koden + sin verifier via POST /api/auth/native/exchange.
// CONNECT: den indloggede app henter en kode (POST /api/auth/native/connect-code)
//          og åbner /api/integrations/<slug>/connect?native=<kode>. Callbacken
//          sender til hellocal://settings/integrations/<slug>?connected=1.
//
// Koder: 32 tilfældige bytes, kun sha256-hash gemmes, 2 minutter, én gang.

export const NATIVE_SCHEME = "hellocal:";
const CODE_TTL_MS = 2 * 60 * 1000;
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
// base64url(sha256(...)) er altid 43 tegn.
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export type NativeCodePurpose = "LOGIN" | "CONNECT";

const LOGIN_METHODS: LoginMethod[] = ["password", "passkey", "google", "apple", "facebook", "signup"];

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isValidChallenge(value: string | null | undefined): value is string {
  return typeof value === "string" && CHALLENGE_PATTERN.test(value);
}

export async function createNativeCode(
  userId: string,
  purpose: NativeCodePurpose,
  options: { method?: LoginMethod; codeChallenge?: string } = {}
): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  const now = Date.now();
  // Ryd op i gamle koder (de er kun gyldige i 2 minutter).
  await prisma.nativeAuthCode
    .deleteMany({ where: { expiresAt: { lt: new Date(now - 60 * 60 * 1000) } } })
    .catch(() => {});
  await prisma.nativeAuthCode.create({
    data: {
      userId,
      purpose,
      method: options.method ?? null,
      codeChallenge: options.codeChallenge ?? null,
      codeHash: sha256(code),
      expiresAt: new Date(now + CODE_TTL_MS),
    },
  });
  return code;
}

// Bruger koden (atomisk: kun én forespørgsel kan markere den som brugt).
// LOGIN-koder kræver appens verifier (PKCE S256), så en anden app, der
// opsnapper hellocal://-linket, ikke kan bruge koden.
export async function consumeNativeCode(
  code: unknown,
  purpose: NativeCodePurpose,
  verifier?: unknown
): Promise<{ userId: string; method: LoginMethod | null } | null> {
  if (typeof code !== "string" || !CODE_PATTERN.test(code)) return null;
  const codeHash = sha256(code);
  const row = await prisma.nativeAuthCode.findUnique({ where: { codeHash } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;

  if (row.codeChallenge) {
    if (typeof verifier !== "string" || !VERIFIER_PATTERN.test(verifier)) return null;
    const expected = Buffer.from(row.codeChallenge);
    const actual = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  }

  const claimed = await prisma.nativeAuthCode.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return null;
  const method = LOGIN_METHODS.find((m) => m === row.method) ?? null;
  return { userId: row.userId, method };
}

// Brugeren bag en kode skal stadig være aktiv (samme regler som getSessionUser).
export async function activeUserId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, forgottenAt: true, closedAt: true, blockedAt: true },
  });
  if (!user || user.forgottenAt || user.closedAt || user.blockedAt) return null;
  return user.id;
}

// ---- hellocal://-adresser ----

export function nativeLoginUrl(query: Record<string, string>) {
  return `${NATIVE_SCHEME}//auth/complete?${new URLSearchParams(query)}`;
}

export function nativeIntegrationUrl(slug: string, query: string) {
  return `${NATIVE_SCHEME}//settings/integrations/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`;
}

// Kun forespørgsler fra appen (den sætter altid denne header). En
// tilpasset header kan ikke sendes fra en fremmed hjemmeside uden CORS.
export function isNativeClient(req: Request) {
  return req.headers.get("x-hellocal-client") === "native";
}

// ---- integrationstilkobling: hvem browseren tilkobler for ----

// Signeret binding mellem OAuth-state og brugeren, gemt i state-cookien, så
// callbacken (uden session i system-browseren) ved, hvilken konto tokens
// hører til. Kan ikke ændres af brugeren.
function bindingSecret() {
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  return new TextEncoder().encode(secret);
}

export async function signConnectBinding(userId: string, slug: string, state: string) {
  return new SignJWT({ userId, slug, state, purpose: "native-connect" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(bindingSecret());
}

export async function readConnectBinding(token: string | undefined, slug: string, state: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, bindingSecret());
    if (payload.purpose !== "native-connect" || payload.slug !== slug || payload.state !== state) return null;
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}

// OAuth-state for native flows starter med "n." — kun et hint, så fejl kan
// sendes tilbage til appen, selv når state-cookien mangler.
export const NATIVE_STATE_PREFIX = "n.";
