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

// Face ID er et hurtig-login til en konto, man allerede er logget ind med på
// denne enhed — ikke en måde at logge ind første gang. Login-siden viser derfor
// kun Face ID, når enheden har fået det slået til.
const PASSKEY_ON_DEVICE_KEY = "hc_passkey_on_device";

function setPasskeyOnDevice(on: boolean) {
  try {
    if (on) localStorage.setItem(PASSKEY_ON_DEVICE_KEY, "1");
    else localStorage.removeItem(PASSKEY_ON_DEVICE_KEY);
  } catch {
    // Privat vindue m.m.: så vises Face ID bare ikke på login-siden.
  }
}

export function hasPasskeyOnDevice(): boolean {
  if (!isPasskeySupported()) return false;
  try {
    return localStorage.getItem(PASSKEY_ON_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

export async function loginWithPasskey(): Promise<void> {
  try {
    const options = await postJson<PublicKeyCredentialRequestOptionsJSON>("/api/auth/passkey/login/options", {});
    const response = await startAuthentication({ optionsJSON: options });
    await postJson("/api/auth/passkey/login/verify", { response });
  } catch (err) {
    // Serveren kender ikke nøglen (fx slettet): skjul Face ID igen, så brugeren
    // logger ind normalt og kan slå det til på ny.
    if (!(err instanceof Error && err.name === "NotAllowedError")) setPasskeyOnDevice(false);
    throw err;
  }
}

export async function registerPasskey(): Promise<void> {
  const options = await postJson<PublicKeyCredentialCreationOptionsJSON>("/api/auth/passkey/register/options", {});
  try {
    const response = await startRegistration({ optionsJSON: options });
    await postJson("/api/auth/passkey/register/verify", { response });
  } catch (err) {
    // Enheden har allerede en nøgle til kontoen (fx synkroniseret via iCloud).
    if (!(err instanceof Error && err.name === "InvalidStateError")) throw err;
  }
  setPasskeyOnDevice(true);
}

// Bekræfter den indloggede bruger med Face ID/Touch ID/skærmlås uden at
// starte en ny session — fx billede-dagbogens lås. Kaster ved afvisning.
export async function reauthWithPasskey(): Promise<void> {
  const options = await postJson<PublicKeyCredentialRequestOptionsJSON>("/api/auth/passkey/reauth/options", {});
  const response = await startAuthentication({ optionsJSON: options });
  await postJson("/api/auth/passkey/reauth/verify", { response });
}
