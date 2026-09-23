"use client";

// Passkey-ceremonier på klienten med WebAuthn PRF (docs/PRIVACY.md).
//
// PRF-outputtet er en hemmelighed, som passkeyen udleder på enheden. Det
// bruges til at låse hovednøglen (MK) op og sendes ALDRIG til serveren —
// det fjernes fra svaret, før det sendes.

import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import { sha256, type Sealed } from "@/lib/vault/crypto";

const PRF_SALT_LABEL = "hellocal/prf/v1";

async function prfSalt(): Promise<Uint8Array<ArrayBuffer>> {
  return sha256(new TextEncoder().encode(PRF_SALT_LABEL));
}

type PrfResults = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer | Uint8Array } } };

function takePrfOutput(response: { clientExtensionResults: unknown }): Uint8Array | null {
  const ext = response.clientExtensionResults as PrfResults | undefined;
  const first = ext?.prf?.results?.first;
  // Fjern hemmeligheden, før svaret sendes til serveren.
  if (ext?.prf) delete ext.prf.results;
  if (!first) return null;
  const bytes = first instanceof Uint8Array ? first : new Uint8Array(first);
  return bytes.length >= 32 ? bytes.slice(0, 32) : null;
}

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

export type RegisterBody =
  | { mode: "signup"; emailToken: string; referralCode?: string }
  | { mode: "recovery"; claim: string }
  | { mode: "add" };

export type RegisterResult = { credentialId: string; userId: string; prf: Uint8Array | null };

export async function registerPasskey(body: RegisterBody): Promise<RegisterResult> {
  const options = await postJson<PublicKeyCredentialCreationOptionsJSON>("/api/auth/passkey/register/options", body);
  // Nogle browsere giver PRF-output allerede ved oprettelsen; så slipper
  // brugeren for en ekstra Face ID-bekræftelse.
  (options as unknown as { extensions: unknown }).extensions = {
    ...(options.extensions ?? {}),
    prf: { eval: { first: await prfSalt() } },
  };
  const response: RegistrationResponseJSON = await startRegistration({ optionsJSON: options });
  const prf = takePrfOutput(response);
  const result = await postJson<{ credentialId: string; userId: string }>("/api/auth/passkey/register/verify", {
    response,
  });
  return { ...result, prf };
}

export type AuthResult = {
  credentialId: string;
  userId: string;
  envelope: Sealed | null;
  prf: Uint8Array | null;
};

export async function authenticateWithPasskey(): Promise<AuthResult> {
  const options = await postJson<PublicKeyCredentialRequestOptionsJSON>("/api/auth/passkey/login/options", {});
  (options as unknown as { extensions: unknown }).extensions = {
    ...(options.extensions ?? {}),
    prf: { eval: { first: await prfSalt() } },
  };
  const response: AuthenticationResponseJSON = await startAuthentication({ optionsJSON: options });
  const prf = takePrfOutput(response);
  const result = await postJson<Omit<AuthResult, "prf">>("/api/auth/passkey/login/verify", { response });
  return { ...result, prf };
}

export async function uploadPasskeyEnvelope(credentialId: string, envelope: Sealed) {
  await postJson("/api/auth/keys", { credentialId, ...envelope });
}

export async function uploadRecovery(args: { serverShare: string; fileHash: string; envelope: Sealed }) {
  const res = await fetch("/api/auth/keys", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serverShare: args.serverShare, fileHash: args.fileHash, ...args.envelope }),
  });
  if (!res.ok) throw new Error("Gendannelsesnøglen kunne ikke gemmes");
}

export function isPasskeySupported(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function";
}
