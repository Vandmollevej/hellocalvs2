"use client";

import { isPasskeySupported } from "@/lib/passkey-client";

// Små klient-hjælpere til login-siderne.

export type OAuthProviderSlug = "google" | "apple" | "facebook";

const FACE_ID_DECLINED_KEY = "hc_face_id_declined";

export function markFaceIdDeclined() {
  try {
    localStorage.setItem(FACE_ID_DECLINED_KEY, "1");
  } catch {
    // Privat vindue m.m.: så spørger vi bare igen næste gang.
  }
}

function faceIdDeclined() {
  try {
    return localStorage.getItem(FACE_ID_DECLINED_KEY) === "1";
  } catch {
    return false;
  }
}

// Efter login med adgangskode/Google/Apple/Facebook tilbydes Face ID én gang
// på enheder, der understøtter det (siden springer selv over, hvis kontoen
// allerede har Face ID).
export function afterLoginPath(next: string) {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (!isPasskeySupported() || faceIdDeclined()) return safeNext;
  return `/login/face-id?next=${encodeURIComponent(safeNext)}`;
}

export function startOAuth(provider: OAuthProviderSlug, next: string) {
  window.location.href = `/api/auth/oauth/${provider}?next=${encodeURIComponent(afterLoginPath(next))}`;
}

const PROVIDER_NAMES: Record<OAuthProviderSlug, string> = { google: "Google", apple: "Apple", facebook: "Facebook" };

// ?error=... fra OAuth-callbacken → oversættelsesnøgle.
export function oauthErrorKey(code: string | null): { key: string; vars?: Record<string, string> } | null {
  if (!code) return null;
  const notConfigured = code.match(/^(google|apple|facebook)-not-configured$/);
  if (notConfigured) {
    return { key: "login.errorNotConfigured", vars: { provider: PROVIDER_NAMES[notConfigured[1] as OAuthProviderSlug] } };
  }
  if (code === "oauth-cancelled") return { key: "login.errorOauthCancelled" };
  if (code === "oauth-expired") return { key: "login.errorOauthExpired" };
  return { key: "login.errorOauth" };
}
