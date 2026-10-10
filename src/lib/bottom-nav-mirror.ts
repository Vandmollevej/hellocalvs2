import { useSyncExternalStore } from "react";

// Settings → Visning → Forside: whether the bottom navigation is mirrored the
// way the front page can be. Default: Hjem (fixed) on the left and the icon
// slider to its right; mirrored swaps the two. A per-device preference, same
// localStorage + useSyncExternalStore pattern as src/lib/frontpage-layout.ts
// (BottomNav is part of the prerendered shell, so the server snapshot must be
// the default to avoid a hydration mismatch).
const MIRROR_STORAGE_KEY = "hellocal.bottomnav.mirrored";

let cachedRaw: string | null | undefined;
let cachedMirrored = false;

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(MIRROR_STORAGE_KEY);
  } catch {
    return false;
  }
  if (raw === cachedRaw) return cachedMirrored;
  cachedRaw = raw;
  cachedMirrored = raw === "1";
  return cachedMirrored;
}

function getServerSnapshot(): boolean {
  return false;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MIRROR_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persists the choice and notifies every mounted `useBottomNavMirrored()`. */
export function saveBottomNavMirrored(mirrored: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MIRROR_STORAGE_KEY, mirrored ? "1" : "0");
  } catch {
    // localStorage unavailable — the choice just resets next visit.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** True when Hjem sits on the right and the slider on the left (reactive, SSR-safe). */
export function useBottomNavMirrored(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
