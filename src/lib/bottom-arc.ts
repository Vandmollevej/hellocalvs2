import { useSyncExternalStore } from "react";
import { DEFAULT_WHEEL_ACTION_KEYS, type AddActionKey, ADD_ACTIONS } from "@/lib/add-actions";

// Prøve: halvcirklen over footeren (src/components/BottomArcButton.tsx) — samme
// funktion som den grønne cirkel i siden, men som fast element midt over
// bundmenuen. Den har sit eget valg af knapper (højst 4 + "Se alle" i midten =
// 5 i alt), så prøven ikke rører den eksisterende cirkels indstillinger.

// Fuld radius når halvcirklen er åben: 70 % af den eksisterende cirkel (83 px).
export const ARC_RADIUS = 58;
// Højde på den lille bue i hvile (cirklens top stikker kun så meget op).
export const ARC_REST_HEIGHT = 20;
export const ARC_ICON = 46;
export const ARC_MAX_CHOSEN = 4;

// Afstand mellem to nabo-ikoner (samme som i den eksisterende vifte, ca. 78 px)
// og afstanden fra halvcirklens midte til ikonerne.
const ICON_SPACING = 78;
const ICON_DISTANCE = 125;
const EDGE_MARGIN = ARC_ICON / 2 + 8;
// Halvcirklen kan ikke trækkes helt ud til kanten.
const CENTER_MARGIN = ARC_RADIUS + 16;

export const DEFAULT_BOTTOM_ARC_KEYS: AddActionKey[] = DEFAULT_WHEEL_ACTION_KEYS.slice(0, ARC_MAX_CHOSEN);

export type ArcSlot = { key: string; x: number; up: number };

/** Vandret midte (px fra venstre) for en given gemt forskydning, begrænset så den aldrig når helt ud. */
export function clampArcCenter(width: number, offsetX: number) {
  const min = Math.min(CENTER_MARGIN, width / 2);
  const max = Math.max(min, width - CENTER_MARGIN);
  return Math.min(max, Math.max(min, width / 2 + offsetX));
}

/** Rækkefølgen i viften: de valgte knapper med "Se alle" ("list") altid i midten. */
export function arcOrder<T>(chosen: T[], list: T): T[] {
  const index = Math.floor((chosen.length + 1) / 2);
  return [...chosen.slice(0, index), list, ...chosen.slice(index)];
}

/**
 * Placerer ikonerne i en bue om halvcirklens midte med fast afstand mellem
 * naboerne. Når et ikon ville havne uden for skærmen (halvcirklen er trukket
 * langt ud til siden), holdes det inden for kanten og rykkes i stedet længere
 * op, væk fra halvcirklen — stadig med samme afstand til sin nabo.
 * `up` er højden over bundmenuens overkant.
 */
export function layoutArc(keys: string[], width: number, centerX: number): ArcSlot[] {
  const count = keys.length;
  if (count === 0) return [];
  const mid = Math.floor(count / 2);
  const step = ICON_SPACING / ICON_DISTANCE;
  const slots: ArcSlot[] = new Array(count);
  slots[mid] = { key: keys[mid], x: centerX, up: ICON_DISTANCE };

  for (const dir of [-1, 1]) {
    for (let i = mid + dir; i >= 0 && i < count; i += dir) {
      const prev = slots[i - dir];
      const angle = (i - mid) * step;
      const idealX = centerX + ICON_DISTANCE * Math.sin(angle);
      const idealUp = ICON_DISTANCE * Math.cos(angle);
      const x = Math.min(width - EDGE_MARGIN, Math.max(EDGE_MARGIN, idealX));
      let up = idealUp;
      if (x !== idealX) {
        const dx = x - prev.x;
        up = Math.max(idealUp, prev.up + Math.sqrt(Math.max(0, ICON_SPACING ** 2 - dx ** 2)));
      }
      slots[i] = { key: keys[i], x, up };
    }
  }
  return slots;
}

export const ARC_BULGE_MAX = 14;
const BULGE_SPREAD_DEG = 46;
const BULGE_POLE_TAPER_DEG = 12;
const BULGE_SAMPLE_COUNT = 48;

/**
 * Halvcirkelens form med "bule" mod det valgte ikon — samme model som den
 * eksisterende cirkels `backdropPath` (AddButton.tsx), tegnet med den flade
 * kant mod venstre (x = 0). Tegnes i SVG roteret -90°, så den flade kant ender
 * nederst og buen peger opad. Vinklen er målt fra lodret, positiv mod højre.
 */
export function arcBackdropPath(bulgeAngleDeg: number | null, bulgeAmount: number) {
  const r = ARC_RADIUS;
  const points: [number, number][] = [];
  for (let i = 0; i <= BULGE_SAMPLE_COUNT; i += 1) {
    const angleDeg = -90 + (180 * i) / BULGE_SAMPLE_COUNT;
    const theta = (angleDeg * Math.PI) / 180;
    const y = r * (1 + Math.sin(theta));
    let x = r * Math.cos(theta);
    if (bulgeAngleDeg !== null && bulgeAmount > 0) {
      const diff = Math.abs(angleDeg - bulgeAngleDeg);
      const falloff = Math.max(0, Math.cos((diff / BULGE_SPREAD_DEG) * (Math.PI / 2)));
      const pinFactor = Math.min(1, (90 - Math.abs(angleDeg)) / BULGE_POLE_TAPER_DEG);
      x += bulgeAmount * falloff ** 2 * pinFactor;
    }
    points.push([x, y]);
  }
  const commands = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${commands.join(" ")} L0,${r * 2} L0,0 Z`;
}

// --- Gemte valg (pr. enhed, samme localStorage-mønster som add-actions.ts) ---

const KEYS_STORAGE_KEY = "hellocal.frontpage.bottomArcActions";
const OFFSET_STORAGE_KEY = "hellocal.frontpage.bottomArcOffsetX";

function isActionKey(value: unknown): value is AddActionKey {
  return typeof value === "string" && ADD_ACTIONS.some((action) => action.key === value);
}

function parseKeys(raw: string | null): AddActionKey[] {
  if (!raw) return DEFAULT_BOTTOM_ARC_KEYS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_BOTTOM_ARC_KEYS;
    return [...new Set(parsed.filter(isActionKey))].slice(0, ARC_MAX_CHOSEN);
  } catch {
    return DEFAULT_BOTTOM_ARC_KEYS;
  }
}

let cachedRaw: string | null | undefined;
let cachedKeys: AddActionKey[] = DEFAULT_BOTTOM_ARC_KEYS;

function getSnapshot(): AddActionKey[] {
  if (typeof window === "undefined") return DEFAULT_BOTTOM_ARC_KEYS;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEYS_STORAGE_KEY);
  } catch {
    return DEFAULT_BOTTOM_ARC_KEYS;
  }
  if (raw === cachedRaw) return cachedKeys;
  cachedRaw = raw;
  cachedKeys = parseKeys(raw);
  return cachedKeys;
}

function getServerSnapshot(): AddActionKey[] {
  return DEFAULT_BOTTOM_ARC_KEYS;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === KEYS_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function saveBottomArcKeys(keys: AddActionKey[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys.slice(0, ARC_MAX_CHOSEN)));
  } catch {
    // localStorage utilgængeligt — valget gælder kun til siden lukkes.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** De valgte knapper i halvcirklen (uden "Se alle"), reaktivt og SSR-sikkert. */
export function useBottomArcKeys(): AddActionKey[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function loadBottomArcOffsetX(): number {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(OFFSET_STORAGE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBottomArcOffsetX(offsetX: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(OFFSET_STORAGE_KEY, String(Math.round(offsetX)));
  } catch {
    // Placeringen nulstilles næste gang.
  }
}
