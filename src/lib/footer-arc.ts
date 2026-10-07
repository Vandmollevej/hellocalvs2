// Geometri og lager for forsidens lille halvcirkel over bundmenuen
// (FooterArc.tsx). Brugerens ønske 2026-10-07: en fast, lille halvcirkel
// (ca. 20 px høj) midt over footeren med et lille plus; skubbes den op,
// vokser den til 70 % af den nuværende venstre-cirkel (AddButton.tsx,
// HALF_CIRCLE_RADIUS = 83) og viser 5 knapper, hvor "alle" altid står i midten.

import { useSyncExternalStore } from "react";

export const SOURCE_HALF_CIRCLE_RADIUS = 83;
/** Radius når cirklen er trukket op: 70 % af den nuværende venstre-cirkel. */
export const ARC_RADIUS = Math.round(SOURCE_HALF_CIRCLE_RADIUS * 0.7);
/** Synlig højde i hvile (cirklens øverste stykke). */
export const ARC_REST_HEIGHT = 20;
/** Hvor langt fingeren skal op (px) for at cirklen er helt åben. */
export const ARC_PULL_DISTANCE = 70;
export const ARC_ICON_CIRCLE = 46;
/** Afstand fra cirklens midte (ved footerkanten) til knappernes midte. */
export const ARC_ICON_RADIUS = ARC_RADIUS + 38 + ARC_ICON_CIRCLE / 2;
export const ARC_ANGLE_STEP_DEG = 32;
/** Højst så mange egne knapper i viften ("alle" kommer i midten ovenpå). */
export const ARC_MAX_USER_ACTIONS = 4;
/** Vandret plads viften skal have til hver side for ikke at ryge ud over skærmen. */
export const ARC_FAN_HALF_WIDTH =
  ARC_ICON_RADIUS * Math.sin((ARC_ANGLE_STEP_DEG * 2 * Math.PI) / 180) + ARC_ICON_CIRCLE / 2 + 8;

/** Antal knapper i viften, når der er `userCount` egne + "alle". */
export function fanAngles(userCount: number): number[] {
  const total = userCount + 1;
  return Array.from({ length: total }, (_, i) => (i - (total - 1) / 2) * ARC_ANGLE_STEP_DEG);
}

/** Pladsen i viften, hvor "alle" altid står (midten). */
export function listSlotIndex(userCount: number) {
  return Math.floor((userCount + 1) / 2);
}

/** SVG-sti for cirkelstykket med synlig højde `h` (0..ARC_RADIUS), fladt i bunden. */
export function segmentPath(height: number) {
  const r = ARC_RADIUS;
  const h = Math.min(r, Math.max(0.5, height));
  const half = Math.sqrt(r * r - (r - h) * (r - h));
  return `M${(r - half).toFixed(2)},${r} A${r},${r} 0 0 1 ${(r + half).toFixed(2)},${r} Z`;
}

// Vandret placering (px fra skærmens midte) gemmes pr. enhed ligesom
// frontpage-layout.ts; kun et ønske — komponenten klemmer den mod skærmbredden.
const ARC_OFFSET_X_STORAGE_KEY = "hellocal.frontpage.arcOffsetX";

let cachedRaw: string | null | undefined;
let cachedValue = 0;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (typeof window === "undefined") return 0;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ARC_OFFSET_X_STORAGE_KEY);
  } catch {
    return 0;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  const value = Number(raw);
  cachedValue = raw !== null && Number.isFinite(value) ? value : 0;
  return cachedValue;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveArcOffsetX(offsetX: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARC_OFFSET_X_STORAGE_KEY, String(Math.round(offsetX)));
  } catch {
    // localStorage utilgængeligt — placeringen nulstilles næste gang.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** Gemt vandret forskydning fra midten (0 = midt imellem de to midterste footer-knapper). */
export function useArcOffsetX() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
