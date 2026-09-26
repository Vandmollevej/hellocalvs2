// Billede-dagbogens billeder, gemt på enheden i IndexedDB.
//
// Indtil 2026-09-25 lå billederne som fulde data:-URL'er i localStorage. En
// iPhone har kun ~5 MB localStorage pr. side, så der var plads til ca. to
// billeder — de næste blev vist, men aldrig gemt (fejlen blev slugt), og
// forsvandt, så snart man forlod siden. Nu gemmes billedet som en Blob i
// IndexedDB (langt mere plads, ingen base64-oppustning), det skaleres ned
// før det gemmes, og et billede vises først, når det faktisk er gemt.
// Billederne ligger stadig kun på denne enhed — de sendes ikke til serveren.

const DB_NAME = "hellocal-photo-diary";
const DB_VERSION = 1;
const STORE_NAME = "photos";

// Den gamle localStorage-nøgle; flyttes over i IndexedDB og ryddes derefter.
const LEGACY_STORAGE_KEY = "hello-cal:billede-dagbog";

// Længste side efter nedskalering. Rigeligt til at sammenligne fuld figur/mave
// på en telefon, og giver typisk 200–500 KB pr. billede mod flere MB før.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

export type StoredDiaryPhoto = {
  id: string;
  takenAt: string;
  blob: Blob;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

// Resolver først, når transaktionen er fuldført (committet), så et billede
// aldrig vises som gemt, før det faktisk ligger på disken.
async function write(fn: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaktionen blev afbrudt"));
    fn(tx.objectStore(STORE_NAME));
  });
}

/** Alle gemte billeder, nyeste først. */
export async function listDiaryPhotos(): Promise<StoredDiaryPhoto[]> {
  const db = await openDb();
  const photos = await new Promise<StoredDiaryPhoto[]>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as StoredDiaryPhoto[]);
    request.onerror = () => reject(request.error);
  });
  return photos.sort((a, b) => b.takenAt.localeCompare(a.takenAt));
}

export async function addDiaryPhoto(photo: StoredDiaryPhoto): Promise<void> {
  await write((store) => store.put(photo));
  requestPersistentStorage();
}

export async function deleteDiaryPhoto(id: string): Promise<void> {
  await write((store) => store.delete(id));
}

// Beder browseren om ikke at rydde sidens data ved pladsmangel. Browseren
// afgør selv, om det gives; et afslag ændrer intet ved selve gemningen.
function requestPersistentStorage() {
  const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
  if (!storage?.persist || !storage.persisted) return;
  storage
    .persisted()
    .then((persisted) => (persisted ? undefined : storage.persist()))
    .catch(() => {});
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data = ""] = dataUrl.split(",", 2);
  const mime = /^data:([^;,]+)/.exec(header)?.[1] ?? "image/jpeg";
  if (!header.includes(";base64")) return new Blob([decodeURIComponent(data)], { type: mime });
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Flytter billeder fra den gamle localStorage-løsning over i IndexedDB og
 * rydder derefter nøglen (som også frigør localStorage til resten af appen).
 * Mislykkes flytningen, bliver de gamle billeder liggende til næste forsøg.
 */
export async function migrateLegacyDiaryPhotos(): Promise<void> {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  let legacy: { id?: string; dataUrl?: string; takenAt?: string }[];
  try {
    const parsed = JSON.parse(raw);
    legacy = Array.isArray(parsed) ? parsed : [];
  } catch {
    legacy = [];
  }

  const photos: StoredDiaryPhoto[] = legacy
    .filter((photo) => typeof photo.dataUrl === "string" && photo.dataUrl.startsWith("data:"))
    .map((photo) => ({
      id: photo.id || crypto.randomUUID(),
      takenAt: photo.takenAt || new Date().toISOString(),
      blob: dataUrlToBlob(photo.dataUrl as string),
    }));

  if (photos.length > 0) {
    await write((store) => {
      for (const photo of photos) store.put(photo);
    });
  }
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Kan ikke rydde — flytningen gentages blot næste gang (samme id'er, så
    // billederne overskrives i stedet for at blive dubleret).
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Billedet kunne ikke læses"));
    };
    image.src = url;
  });
}

/**
 * Skalerer et kamerabillede ned til højst MAX_DIMENSION på den længste side
 * som JPEG. Browseren retter selv EXIF-rotationen, når billedet tegnes. Kan
 * billedet ikke afkodes (fx HEIC i en browser uden HEIC-understøttelse),
 * gemmes originalfilen i stedet — hellere stort end tabt.
 */
export async function prepareDiaryPhoto(file: File): Promise<Blob> {
  try {
    const image = await loadImage(file);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return file;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    if (scale === 1 && file.type === "image/jpeg") return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    // Frigør canvas-hukommelsen med det samme (iOS har et lavt samlet loft).
    canvas.width = 0;
    canvas.height = 0;
    return blob && blob.size > 0 ? blob : file;
  } catch {
    return file;
  }
}
