import { useSyncExternalStore } from "react";

// Settings → Visning → "Vis tooltips" and "Vis start-up tips", plus which
// start-up tips have already been seen/closed. Per-device preferences, same
// localStorage-not-database pattern as src/lib/calendar-view-pref.ts.
const TOOLTIPS_KEY = "hellocal.help.showTooltips";
const STARTUP_TIPS_KEY = "hellocal.help.showStartupTips";
const SEEN_TIPS_KEY = "hellocal.help.seenStartupTips";

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable — ignore, same as calendar-view-pref.ts.
  }
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Both switches default to on: a missing value means "never turned off".
function useFlag(key: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => read(key) !== "0",
    () => true,
  );
}

export function useShowTooltips(): boolean {
  return useFlag(TOOLTIPS_KEY);
}

export function saveShowTooltips(value: boolean) {
  write(TOOLTIPS_KEY, value ? "1" : "0");
}

export function useShowStartupTips(): boolean {
  return useFlag(STARTUP_TIPS_KEY);
}

export function saveShowStartupTips(value: boolean) {
  write(STARTUP_TIPS_KEY, value ? "1" : "0");
}

/** Ids of start-up tips the user has closed or whose feature they have used. */
export function readSeenStartupTips(): string[] {
  const raw = read(SEEN_TIPS_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Marks a start-up tip as done. Call it when the tip is closed, and also from
 * a feature's own code the first time the user uses it, so its tip is never
 * shown for a feature they already know.
 */
export function markStartupTipSeen(id: string) {
  const seen = readSeenStartupTips();
  if (seen.includes(id)) return;
  write(SEEN_TIPS_KEY, JSON.stringify([...seen, id]));
}
