"use client";

// Global boks-tilstand og kontoflows (docs/PRIVACY.md).
//
// Én instans pr. fane. Sider bruger useVault()/useVaultCollection() og
// behøver ikke kende noget til nøgler eller kryptering.

import { useMemo, useSyncExternalStore } from "react";
import { VaultClient, type VaultEntry } from "@/lib/vault/client";
import { VAULT_COLLECTIONS } from "@/lib/vault/collections";
import {
  createRecoverySplit,
  encodeRecoveryFile,
  generateMasterKey,
  openRecoveryEnvelope,
  sha256Base64Url,
  toBase64Url,
  fromBase64Url,
  unwrapMasterKey,
  wrapMasterKey,
  type Sealed,
} from "@/lib/vault/crypto";
import { clearDeviceKeys, loadMasterKeyFromDevice, saveMasterKeyOnDevice } from "@/lib/vault/device-store";
import {
  authenticateWithPasskey,
  registerPasskey,
  uploadPasskeyEnvelope,
  uploadRecovery,
  type RegisterBody,
} from "@/lib/vault/webauthn-client";

export type VaultStatus =
  | "loading" // tjekker session og enhedslager
  | "signed-out" // ingen session
  | "locked" // session findes, men nøglen er ikke på denne enhed
  | "ready";

type State = { status: VaultStatus; client: VaultClient | null; userId: string | null; version: number };

let state: State = { status: "loading", client: null, userId: null, version: 0 };
const listeners = new Set<() => void>();
let initStarted = false;
let unsubscribeClient: (() => void) | null = null;

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initStarted && typeof window !== "undefined") {
    initStarted = true;
    void init();
  }
  return () => listeners.delete(listener);
}

async function currentSessionUserId(): Promise<string | null> {
  const res = await fetch("/api/auth/keys", { cache: "no-store" }).catch(() => null);
  if (!res || !res.ok) return null;
  const data = (await res.json()) as { userId?: string };
  return data.userId ?? null;
}

async function openClient(masterKey: Uint8Array, userId: string) {
  const client = await VaultClient.open(masterKey, VAULT_COLLECTIONS);
  unsubscribeClient?.();
  unsubscribeClient = client.subscribe(() => setState({ version: client.getVersion() }));
  setState({ status: "ready", client, userId, version: client.getVersion() });
  window.dispatchEvent(new Event("hellocal:vault-ready"));
}

async function init() {
  try {
    const userId = await currentSessionUserId();
    if (!userId) {
      setState({ status: "signed-out" });
      return;
    }
    const stored = await loadMasterKeyFromDevice();
    if (stored && stored.userId === userId) {
      await openClient(stored.masterKey, userId);
      return;
    }
    setState({ status: "locked", userId });
  } catch {
    setState({ status: "signed-out" });
  }
}

// ---------- hjælpere ----------

async function wrapForPasskey(masterKey: Uint8Array, credentialId: string, prf: Uint8Array | null) {
  if (!prf) return false;
  await uploadPasskeyEnvelope(credentialId, await wrapMasterKey(masterKey, prf, "passkey"));
  return true;
}

// Ny gendannelsesnøgle: returnerer filens indhold, som brugeren SKAL gemme.
async function createRecovery(masterKey: Uint8Array): Promise<string> {
  const split = await createRecoverySplit(masterKey);
  await uploadRecovery({
    serverShare: toBase64Url(split.serverShare),
    fileHash: await sha256Base64Url(split.fileSecret),
    envelope: split.envelope,
  });
  return encodeRecoveryFile(split.fileSecret);
}

// Registrerer en passkey og skaffer PRF-output (evt. via et ekstra login,
// hvis browseren ikke giver PRF ved oprettelse).
async function registerWithPrf(body: RegisterBody) {
  const reg = await registerPasskey(body);
  if (reg.prf) return reg;
  try {
    const auth = await authenticateWithPasskey();
    if (auth.credentialId === reg.credentialId && auth.prf) return { ...reg, prf: auth.prf };
  } catch {
    // Brugeren afbrød eller PRF er ikke understøttet; nøglen bliver kun på enheden.
  }
  return reg;
}

// ---------- flows ----------

export type AccountSetupResult = { recoveryFile: string; passkeyUnlocksKey: boolean };

export async function signUp(emailToken: string, referralCode?: string): Promise<AccountSetupResult> {
  const reg = await registerWithPrf({ mode: "signup", emailToken, referralCode });
  const masterKey = generateMasterKey();
  const passkeyUnlocksKey = await wrapForPasskey(masterKey, reg.credentialId, reg.prf);
  const recoveryFile = await createRecovery(masterKey);
  await saveMasterKeyOnDevice(masterKey, reg.userId);
  await openClient(masterKey, reg.userId);
  return { recoveryFile, passkeyUnlocksKey };
}

export type LoginResult = "ready" | "locked";

export async function logIn(): Promise<LoginResult> {
  const auth = await authenticateWithPasskey();
  let masterKey: Uint8Array | null = null;
  if (auth.envelope && auth.prf) {
    try {
      masterKey = await unwrapMasterKey(auth.envelope, auth.prf, "passkey");
    } catch {
      masterKey = null;
    }
  }
  if (!masterKey) {
    const stored = await loadMasterKeyFromDevice();
    if (stored && stored.userId === auth.userId) {
      masterKey = stored.masterKey;
      // Passkeyen havde ingen kuvert endnu (fx ny synkroniseret enhed): læg én.
      await wrapForPasskey(masterKey, auth.credentialId, auth.prf).catch(() => false);
    }
  }
  if (!masterKey) {
    setState({ status: "locked", userId: auth.userId, client: null });
    return "locked";
  }
  await saveMasterKeyOnDevice(masterKey, auth.userId);
  await openClient(masterKey, auth.userId);
  return "ready";
}

// Lås boksen op med gendannelsesfilen på en enhed, hvor brugeren er logget
// ind men mangler nøglen. Kræver godkendt sag (claim) — se completeRecovery.
export async function completeRecovery(claim: string, fileSecret: Uint8Array | null): Promise<AccountSetupResult> {
  const res = await fetch("/api/auth/recovery", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "claim", claim }),
  });
  const data = (await res.json()) as { serverShare?: string | null; envelope?: Sealed | null; message?: string };
  if (!res.ok) throw new Error(data.message ?? "Gendannelsen er ikke godkendt");

  let masterKey: Uint8Array;
  if (data.serverShare && data.envelope) {
    if (!fileSecret) throw new Error("Gendannelsesfilen mangler");
    masterKey = await openRecoveryEnvelope(data.envelope, fileSecret, fromBase64Url(data.serverShare));
  } else {
    // Start forfra: de gamle data kan ikke åbnes. Ny, tom boks.
    masterKey = generateMasterKey();
  }

  const reg = await registerWithPrf({ mode: "recovery", claim });
  const passkeyUnlocksKey = await wrapForPasskey(masterKey, reg.credentialId, reg.prf);
  // Serverens halvdel er nu udleveret; lav en ny gendannelsesnøgle.
  const recoveryFile = await createRecovery(masterKey);
  await saveMasterKeyOnDevice(masterKey, reg.userId);
  await openClient(masterKey, reg.userId);
  return { recoveryFile, passkeyUnlocksKey };
}

// Tilføj en ekstra passkey (fx en anden telefon uden synkroniserede passkeys).
export async function addPasskey() {
  const client = state.client;
  const stored = await loadMasterKeyFromDevice();
  if (!client || !stored) throw new Error("Boksen er ikke åben");
  const reg = await registerWithPrf({ mode: "add" });
  return wrapForPasskey(stored.masterKey, reg.credentialId, reg.prf);
}

export async function regenerateRecoveryFile(): Promise<string> {
  const stored = await loadMasterKeyFromDevice();
  if (!stored) throw new Error("Boksen er ikke åben");
  return createRecovery(stored.masterKey);
}

export async function logOut() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
  await clearDeviceKeys();
  unsubscribeClient?.();
  unsubscribeClient = null;
  setState({ status: "signed-out", client: null, userId: null });
}

// Sletter brugerens boks og konto. Data kan ikke gendannes bagefter.
export async function deleteAccount() {
  if (state.client) await state.client.destroy();
  await fetch("/api/profile/delete-account", { method: "POST" }).catch(() => null);
  await logOut();
}

export function downloadRecoveryFile(contents: string) {
  const blob = new Blob([contents], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hello-cal-gendannelsesfil.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- hooks ----------

const serverSnapshot: State = { status: "loading", client: null, userId: null, version: 0 };

export function useVault() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverSnapshot
  );
}

export function getVaultClient(): VaultClient | null {
  return state.client;
}

// Alle poster i en samling; opdateres automatisk ved ændringer.
export function useVaultCollection<T>(collection: string): { entries: VaultEntry<T>[]; ready: boolean } {
  const { client, version, status } = useVault();
  const entries = useMemo(
    () => (client ? client.list<T>(collection) : []),
    // version ændres ved hver ændring i boksen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, collection, version]
  );
  return { entries, ready: status === "ready" };
}
