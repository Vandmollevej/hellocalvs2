"use client";

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";

// Face ID i Oprettelses-appen (/api/scan/passkey/*). Login-siden viser kun
// Face ID-knappen, når den er slået til på denne telefon.
const ON_DEVICE_KEY = "hc_scan_passkey_on_device";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Noget gik galt");
  return data;
}

function setOnDevice(on: boolean) {
  try {
    if (on) localStorage.setItem(ON_DEVICE_KEY, "1");
    else localStorage.removeItem(ON_DEVICE_KEY);
  } catch {
    // Privat vindue: knappen vises bare ikke.
  }
}

export function isScanPasskeySupported() {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}

export function hasScanPasskeyOnDevice() {
  if (!isScanPasskeySupported()) return false;
  try {
    return localStorage.getItem(ON_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

export async function loginScanWithPasskey() {
  try {
    const options = await postJson<PublicKeyCredentialRequestOptionsJSON>("/api/scan/passkey/authenticate/options", {});
    const response = await startAuthentication({ optionsJSON: options });
    await postJson("/api/scan/passkey/authenticate/verify", { response });
  } catch (err) {
    // Nøglen er slettet på serveren: skjul knappen, så man logger ind normalt.
    if (!(err instanceof Error && err.name === "NotAllowedError")) setOnDevice(false);
    throw err;
  }
}

export async function registerScanPasskey(name: string) {
  const options = await postJson<PublicKeyCredentialCreationOptionsJSON>("/api/scan/passkey/register/options", {});
  try {
    const response = await startRegistration({ optionsJSON: options });
    await postJson("/api/scan/passkey/register/verify", { response, name });
  } catch (err) {
    // Telefonen har allerede en nøgle til kontoen.
    if (!(err instanceof Error && err.name === "InvalidStateError")) throw err;
  }
  setOnDevice(true);
}

export async function removeScanPasskey(id: string) {
  const res = await fetch(`/api/scan/passkey/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Kunne ikke fjerne Face ID");
  setOnDevice(false);
}
