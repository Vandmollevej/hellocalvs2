// Enhedslager for hovednøglen (docs/PRIVACY.md "Nøglehierarki").
//
// Efter login ligger MK krypteret i IndexedDB med en IKKE-eksporterbar
// AES-nøgle, som browseren selv holder. Så skal brugeren ikke bruge sin
// passkey ved hver sideindlæsning, og MK ligger aldrig i klartekst på disken
// eller i localStorage. Log ud sletter begge dele.

import { decryptBytes, encryptBytes, type Sealed } from "@/lib/vault/crypto";

const DB_NAME = "hellocal-keys";
const STORE = "keys";

type StoredSession = { sealed: Sealed; userId: string; savedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function getDeviceKey(create: boolean): Promise<CryptoKey | null> {
  const existing = await withStore<CryptoKey | undefined>("readonly", (s) => s.get("device"));
  if (existing) return existing;
  if (!create) return null;
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  await withStore("readwrite", (s) => s.put(key, "device"));
  return key;
}

export async function saveMasterKeyOnDevice(masterKey: Uint8Array, userId: string) {
  const deviceKey = await getDeviceKey(true);
  const sealed = await encryptBytes(deviceKey!, masterKey, "device-session");
  const value: StoredSession = { sealed, userId, savedAt: Date.now() };
  await withStore("readwrite", (s) => s.put(value, "session"));
}

export async function loadMasterKeyFromDevice(): Promise<{ masterKey: Uint8Array; userId: string } | null> {
  try {
    const session = await withStore<StoredSession | undefined>("readonly", (s) => s.get("session"));
    const deviceKey = session ? await getDeviceKey(false) : null;
    if (!session || !deviceKey) return null;
    const masterKey = await decryptBytes(deviceKey, session.sealed, "device-session");
    return { masterKey, userId: session.userId };
  } catch {
    return null;
  }
}

export async function clearDeviceKeys() {
  try {
    await withStore("readwrite", (s) => s.clear());
  } catch {
    // Intet lager at rydde.
  }
}
