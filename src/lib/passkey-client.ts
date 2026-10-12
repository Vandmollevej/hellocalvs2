"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

// Face ID / passkey i browseren/appen (WebAuthn). Serveren styrer
// udfordringerne under /api/auth/passkey/*.

class PasskeyRequestError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; code?: string };
  if (!res.ok) throw new PasskeyRequestError(data.message ?? "Noget gik galt", data.code);
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
    setPasskeyOnDevice(true);
  } catch (err) {
    // Serveren kender ikke nøglen (fx slettet): skjul Face ID igen, så brugeren
    // logger ind normalt og kan slå det til på ny.
    // Netværksfejl, afbrudt dialog og udløbet udfordring betyder ikke, at
    // nøglen er væk. Fjern kun markeringen, når serveren bekræfter det.
    if (err instanceof PasskeyRequestError && err.code === "PASSKEY_NOT_REGISTERED") setPasskeyOnDevice(false);
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
    // Verificér, at den eksisterende nøgle faktisk kan bruges til denne
    // konto, før vi viser Face ID som aktiveret. Ingen ny session oprettes.
    await reauthWithPasskey();
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

// Billede-dagbogens lås: bekræft med Face ID/Touch ID/telefonens kode. Har
// kontoen ingen passkey endnu, oprettes en — det kræver også bekræftelse på
// enheden, så låsen virker fra første gang.
export async function confirmOnDevice(): Promise<void> {
  const res = await fetch("/api/auth/me");
  const data = (await res.json().catch(() => ({}))) as { user?: { hasPasskey?: boolean } };
  if (data.user?.hasPasskey) await reauthWithPasskey();
  else await registerPasskey();
}
