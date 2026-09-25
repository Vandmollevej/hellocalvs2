"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

// Face ID / passkey i browseren/appen (WebAuthn). Serveren styrer
// udfordringerne under /api/auth/passkey/*.

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Noget gik galt");
  return data;
}

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

export async function loginWithPasskey(): Promise<void> {
  const options = await postJson<PublicKeyCredentialRequestOptionsJSON>("/api/auth/passkey/login/options", {});
  const response = await startAuthentication({ optionsJSON: options });
  await postJson("/api/auth/passkey/login/verify", { response });
}

export async function registerPasskey(): Promise<void> {
  const options = await postJson<PublicKeyCredentialCreationOptionsJSON>("/api/auth/passkey/register/options", {});
  const response = await startRegistration({ optionsJSON: options });
  await postJson("/api/auth/passkey/register/verify", { response });
}

// Bekræfter den indloggede bruger med Face ID/Touch ID/skærmlås uden at
// starte en ny session — fx billede-dagbogens lås. Kaster ved afvisning.
export async function reauthWithPasskey(): Promise<void> {
  const options = await postJson<PublicKeyCredentialRequestOptionsJSON>("/api/auth/passkey/reauth/options", {});
  const response = await startAuthentication({ optionsJSON: options });
  await postJson("/api/auth/passkey/reauth/verify", { response });
}

// Billede-dagbogens lås: bekræft med Face ID/Touch ID/telefonens kode. Har
// kontoen ingen passkey endnu, oprettes en — det kræver også bekræftelse på
// enheden, så låsen virker fra første gang.
export async function confirmOnDevice(): Promise<void> {
  const res = await fetch("/api/auth/me");
  const data = (await res.json().catch(() => ({}))) as { user?: { hasPasskey?: boolean } };
  if (data.user?.hasPasskey) await reauthWithPasskey();
  else await registerPasskey();
}
