import { useSyncExternalStore } from "react";

// Settings → Visning → Forside: which screen edge the joystick add-button
// sits on. The key-metric number wheel (StatsWheel) always takes the
// opposite edge — there are only ever these two elements on the hero, so one
// side choice fully determines both, per the user's own framing ("sidevisning
// for hvor tilføj-cirklen vs. statustallene skal stå"). A per-device
// preference, same localStorage-not-database pattern as the wheel's chosen
// actions (src/lib/add-actions.ts) and the statistics page's card layout.
export type FabSide = "left" | "right";

export const DEFAULT_FAB_SIDE: FabSide = "left";

const FAB_SIDE_STORAGE_KEY = "hellocal.frontpage.fabSide";

function isFabSide(value: unknown): value is FabSide {
  return value === "left" || value === "right";
}

export function oppositeSide(side: FabSide): FabSide {
  return side === "left" ? "right" : "left";
}

// Same useSyncExternalStore pattern as useWheelActionKeys() in add-actions.ts
// — required because AddButton/StatsWheel are part of the statically
// prerendered front page, so a lazy useState(() => localStorage) initializer
// would hydration-mismatch the moment a saved value differs from the default.
let cachedRaw: string | null | undefined;
let cachedSide: FabSide = DEFAULT_FAB_SIDE;

function getSnapshot(): FabSide {
  if (typeof window === "undefined") return DEFAULT_FAB_SIDE;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(FAB_SIDE_STORAGE_KEY);
  } catch {
    return DEFAULT_FAB_SIDE;
  }
  if (raw === cachedRaw) return cachedSide;
  cachedRaw = raw;
  cachedSide = isFabSide(raw) ? raw : DEFAULT_FAB_SIDE;
  return cachedSide;
}

function getServerSnapshot(): FabSide {
  return DEFAULT_FAB_SIDE;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FAB_SIDE_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persists the chosen side and notifies every mounted `useFabSide()`. */
export function saveFabSide(side: FabSide) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAB_SIDE_STORAGE_KEY, side);
  } catch {
    // localStorage unavailable — ignore, same as add-actions.ts.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** Which side the add-button/joystick sits on (settings → Visning → Forside), reactive and SSR-safe. */
export function useFabSide(): FabSide {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
