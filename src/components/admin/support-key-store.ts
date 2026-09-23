"use client";

// Supports private nøgle i admins browser (docs/PRIVACY.md "Support").
// Den forlader aldrig browseren — undtagen som backupfil, som admin selv
// downloader og opbevarer sikkert.

const DB = "hellocal-support-keys";
const STORE = "keys";

export type StoredSupportKey = { keyId: string; publicKey: string; privateKeyPkcs8: string };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveSupportKey(key: StoredSupportKey) {
  await tx("readwrite", (s) => s.put(key, key.keyId));
}

export async function loadSupportKey(keyId: string): Promise<StoredSupportKey | null> {
  try {
    return (await tx<StoredSupportKey | undefined>("readonly", (s) => s.get(keyId))) ?? null;
  } catch {
    return null;
  }
}

const BACKUP_PREFIX = "HELLOCAL-SUPPORT-KEY-V1:";

export function encodeBackup(key: StoredSupportKey) {
  return `${BACKUP_PREFIX}${btoa(JSON.stringify(key))}\n`;
}

export function decodeBackup(text: string): StoredSupportKey {
  const line = text.trim();
  if (!line.startsWith(BACKUP_PREFIX)) throw new Error("Ukendt nøglefil");
  const parsed = JSON.parse(atob(line.slice(BACKUP_PREFIX.length))) as StoredSupportKey;
  if (!parsed.keyId || !parsed.publicKey || !parsed.privateKeyPkcs8) throw new Error("Ugyldig nøglefil");
  return parsed;
}
