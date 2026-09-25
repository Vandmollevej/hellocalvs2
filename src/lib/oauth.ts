import { randomBytes } from "node:crypto";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import type { OAuthProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Log ind med Google, Apple eller Facebook (docs/DECISIONS.md 2026-09-24
// "Normalt login"). Almindelig OAuth 2 / OpenID Connect uden ekstra pakker:
// /api/auth/oauth/[provider] sender brugeren til udbyderen, og
// /api/auth/oauth/[provider]/callback veksler koden, finder/opretter kontoen
// og logger ind. Nøgler sættes i .env.production (docs/DEPLOYMENT.md).

export type ProviderSlug = "google" | "apple" | "facebook";
export const PROVIDER_ENUM: Record<ProviderSlug, OAuthProvider> = {
  google: "GOOGLE",
  apple: "APPLE",
  facebook: "FACEBOOK",
};

export function isProviderSlug(value: string): value is ProviderSlug {
  return value === "google" || value === "apple" || value === "facebook";
}

const APP_BASE_URL = (process.env.APP_BASE_URL || "https://hellocal.packroff.dk").replace(/\/$/, "");
const FACEBOOK_API = "https://graph.facebook.com/v19.0";

export function redirectUri(provider: ProviderSlug) {
  return `${APP_BASE_URL}/api/auth/oauth/${provider}/callback`;
}

export function appUrl(path: string) {
  return `${APP_BASE_URL}${path}`;
}

export function isProviderConfigured(provider: ProviderSlug): boolean {
  const env = process.env;
  if (provider === "google") return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  if (provider === "facebook") return Boolean(env.FACEBOOK_APP_ID && env.FACEBOOK_APP_SECRET);
  return Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY);
}

// ---- state-cookie (CSRF + nonce + hvor brugeren skal hen bagefter) ----

export const OAUTH_STATE_COOKIE = "hc_oauth_state";
export const OAUTH_STATE_MAX_AGE = 10 * 60;

function stateSecret() {
  const secret = process.env.USER_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("USER_SESSION_SECRET mangler eller er for kort");
  return new TextEncoder().encode(secret);
}

type OAuthState = { provider: ProviderSlug; state: string; nonce: string; next: string };

export async function createState(provider: ProviderSlug, next: string) {
  const data: OAuthState = {
    provider,
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    next: next.startsWith("/") && !next.startsWith("//") ? next : "/",
  };
  const token = await new SignJWT({ ...data, purpose: "oauth-state" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_MAX_AGE}s`)
    .sign(stateSecret());
  return { data, token };
}

export async function readState(token: string | undefined): Promise<OAuthState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, stateSecret());
    if (payload.purpose !== "oauth-state") return null;
    const { provider, state, nonce, next } = payload as Record<string, unknown>;
    if (typeof provider !== "string" || !isProviderSlug(provider)) return null;
    if (typeof state !== "string" || typeof nonce !== "string" || typeof next !== "string") return null;
    return { provider, state, nonce, next };
  } catch {
    return null;
  }
}

// ---- trin 1: URL hos udbyderen ----

export function authorizationUrl(provider: ProviderSlug, state: OAuthState) {
  const env = process.env;
  if (provider === "google") {
    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri(provider),
      response_type: "code",
      scope: "openid email profile",
      state: state.state,
      nonce: state.nonce,
      prompt: "select_account",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  if (provider === "apple") {
    const params = new URLSearchParams({
      client_id: env.APPLE_CLIENT_ID!,
      redirect_uri: redirectUri(provider),
      response_type: "code",
      response_mode: "form_post",
      scope: "name email",
      state: state.state,
      nonce: state.nonce,
    });
    return `https://appleid.apple.com/auth/authorize?${params}`;
  }
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID!,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: "email,public_profile",
    state: state.state,
  });
  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
}

// ---- trin 2: veksl koden til en profil ----

export type ProviderProfile = {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

const googleJwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const appleJwks = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Token-veksling fejlede (${res.status}): ${String(data.error ?? "")}`);
  return data;
}

async function appleClientSecret() {
  const env = process.env;
  // .env kan ikke rumme linjeskift pænt: tillad "\n" i nøglen.
  const pem = env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID! })
    .setIssuer(env.APPLE_TEAM_ID!)
    .setSubject(env.APPLE_CLIENT_ID!)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

function truthy(value: unknown) {
  return value === true || value === "true";
}

export async function fetchProfile(
  provider: ProviderSlug,
  code: string,
  nonce: string,
  appleUser: string | null
): Promise<ProviderProfile> {
  const env = process.env;
  if (provider === "google") {
    const tokens = await postForm("https://oauth2.googleapis.com/token", {
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    });
    const { payload } = await jwtVerify(String(tokens.id_token), googleJwks, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: env.GOOGLE_CLIENT_ID!,
    });
    if (payload.nonce !== nonce) throw new Error("Google nonce passer ikke");
    return {
      providerAccountId: String(payload.sub),
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: truthy(payload.email_verified),
      name: typeof payload.name === "string" ? payload.name : null,
    };
  }

  if (provider === "apple") {
    const tokens = await postForm("https://appleid.apple.com/auth/token", {
      code,
      client_id: env.APPLE_CLIENT_ID!,
      client_secret: await appleClientSecret(),
      redirect_uri: redirectUri(provider),
      grant_type: "authorization_code",
    });
    const { payload } = await jwtVerify(String(tokens.id_token), appleJwks, {
      issuer: "https://appleid.apple.com",
      audience: env.APPLE_CLIENT_ID!,
    });
    if (payload.nonce !== nonce) throw new Error("Apple nonce passer ikke");
    // Apple sender kun navnet første gang, som et "user"-felt i form-posten.
    let name: string | null = null;
    try {
      const parsed = appleUser ? (JSON.parse(appleUser) as { name?: { firstName?: string; lastName?: string } }) : null;
      name = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(" ") || null;
    } catch {
      name = null;
    }
    return {
      providerAccountId: String(payload.sub),
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: truthy(payload.email_verified),
      name,
    };
  }

  const tokenParams = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID!,
    client_secret: env.FACEBOOK_APP_SECRET!,
    redirect_uri: redirectUri(provider),
    code,
  });
  const tokenRes = await fetch(`${FACEBOOK_API}/oauth/access_token?${tokenParams}`);
  const tokens = (await tokenRes.json().catch(() => ({}))) as { access_token?: string };
  if (!tokenRes.ok || !tokens.access_token) throw new Error("Facebook token-veksling fejlede");
  const meRes = await fetch(
    `${FACEBOOK_API}/me?${new URLSearchParams({ fields: "id,name,email", access_token: tokens.access_token })}`
  );
  const me = (await meRes.json().catch(() => ({}))) as { id?: string; name?: string; email?: string };
  if (!meRes.ok || !me.id) throw new Error("Facebook profil kunne ikke hentes");
  return {
    providerAccountId: me.id,
    email: me.email ? me.email.toLowerCase() : null,
    // Facebook udleverer kun bekræftede e-mails.
    emailVerified: Boolean(me.email),
    name: me.name ?? null,
  };
}

// ---- trin 3: find eller opret kontoen ----

export async function findOrCreateUser(provider: ProviderSlug, profile: ProviderProfile) {
  const providerEnum = PROVIDER_ENUM[provider];
  const now = new Date();

  const linked = await prisma.userOAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: providerEnum, providerAccountId: profile.providerAccountId } },
    include: { user: true },
  });
  if (linked) {
    await prisma.userOAuthAccount.update({ where: { id: linked.id }, data: { lastUsedAt: now } });
    return linked.user.forgottenAt ? null : { user: linked.user, created: false };
  }

  // Samme bekræftede e-mail som en eksisterende konto: kobl på den konto.
  const existing =
    profile.email && profile.emailVerified ? await prisma.user.findUnique({ where: { email: profile.email } }) : null;
  if (existing?.forgottenAt) return null;

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email: profile.email ?? `no-email+${provider}-${profile.providerAccountId}@invalid.hellocal`,
        displayName: profile.name?.trim() || profile.email?.split("@")[0] || "",
        emailVerifiedAt: profile.email && profile.emailVerified ? now : null,
      },
    }));

  await prisma.userOAuthAccount.create({
    data: {
      userId: user.id,
      provider: providerEnum,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      lastUsedAt: now,
    },
  });
  return { user, created: !existing };
}
