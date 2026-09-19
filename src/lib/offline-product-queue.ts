// Offline queue for product creation (e.g. photos taken via /camera/create
// or the manual /product/create form while the device has no network). The
// existing create flow already builds the whole POST /api/products body as
// plain JSON with image fields as data: URLs (see
// src/components/hf/CreateProductMediaGrid.tsx, src/lib/product-draft.ts) —
// there is no separate binary upload step, so the entire payload can be
// queued as-is and replayed later. IndexedDB is used instead of
// localStorage because a few captured photos as data: URLs can easily
// exceed localStorage's ~5-10MB per-origin cap.
const DB_NAME = "hellocal-offline";
const DB_VERSION = 1;
const STORE_NAME = "pendingProducts";

export type PendingProduct = {
  localId: string;
  createdAt: number;
  body: Record<string, unknown>;
  lastError?: string;
};

type Listener = (count: number) => void;
const listeners = new Set<Listener>();
let cachedCount = 0;

function notify(count: number) {
  cachedCount = count;
  for (const listener of listeners) listener(count);
}

export function subscribePendingCount(listener: Listener): () => void {
  listeners.add(listener);
  listener(cachedCount);
  return () => listeners.delete(listener);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = fn(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function listAll(): Promise<PendingProduct[]> {
  return withStore("readonly", (store) => store.getAll());
}

export async function queuePendingProduct(body: Record<string, unknown>): Promise<string> {
  const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await withStore("readwrite", (store) => store.put({ localId, createdAt: Date.now(), body }));
  notify((await listAll()).length);
  return localId;
}

export async function listPendingProducts(): Promise<PendingProduct[]> {
  const items = await listAll();
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

async function removePendingProduct(localId: string) {
  await withStore("readwrite", (store) => store.delete(localId));
  notify((await listAll()).length);
}

async function markError(localId: string, message: string) {
  const items = await listAll();
  const item = items.find((entry) => entry.localId === localId);
  if (!item) return;
  await withStore("readwrite", (store) => store.put({ ...item, lastError: message }));
}

let flushing = false;

// Attempts to POST every queued product. Stops on the first apparent
// network failure (still offline) rather than looping through the rest —
// but a request that reaches the server and comes back with an error (e.g.
// a barcode already taken) is removed from the queue with the error kept in
// case a future "afventer upload" screen wants to surface it, since
// retrying the exact same payload forever would not help.
export async function flushPendingProducts(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  flushing = true;
  try {
    const items = await listPendingProducts();
    for (const item of items) {
      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        if (res.ok) {
          await removePendingProduct(item.localId);
        } else {
          const data = await res.json().catch(() => ({}));
          await markError(item.localId, typeof data.message === "string" ? data.message : "Oprettelse mislykkedes");
          await removePendingProduct(item.localId);
        }
      } catch {
        // Network error — still offline, stop and try again later.
        return;
      }
    }
  } finally {
    flushing = false;
  }
}

export async function initPendingCount() {
  notify((await listAll()).length);
}
