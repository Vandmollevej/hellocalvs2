import { useSyncExternalStore } from "react";

// Settings → Visning → Kalendervisning: which view the calendar (/calendar)
// opens in by default. A per-device preference, same localStorage-not-database
// pattern as the front page's FAB side (src/lib/frontpage-layout.ts).
export type CalendarDefaultView = "month" | "week" | "list";

export const DEFAULT_CALENDAR_VIEW: CalendarDefaultView = "month";

const CALENDAR_VIEW_STORAGE_KEY = "hellocal.kalender.defaultView";

function isCalendarDefaultView(value: unknown): value is CalendarDefaultView {
  return value === "month" || value === "week" || value === "list";
}

let cachedRaw: string | null | undefined;
let cachedView: CalendarDefaultView = DEFAULT_CALENDAR_VIEW;

function getSnapshot(): CalendarDefaultView {
  if (typeof window === "undefined") return DEFAULT_CALENDAR_VIEW;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  } catch {
    return DEFAULT_CALENDAR_VIEW;
  }
  if (raw === cachedRaw) return cachedView;
  cachedRaw = raw;
  cachedView = isCalendarDefaultView(raw) ? raw : DEFAULT_CALENDAR_VIEW;
  return cachedView;
}

function getServerSnapshot(): CalendarDefaultView {
  return DEFAULT_CALENDAR_VIEW;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CALENDAR_VIEW_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Persists the chosen default view and notifies every mounted `useDefaultCalendarView()`. */
export function saveDefaultCalendarView(view: CalendarDefaultView) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
  } catch {
    // localStorage unavailable — ignore, same as frontpage-layout.ts.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** Which view the calendar opens in by default (settings → Visning → Kalendervisning), reactive and SSR-safe. */
export function useDefaultCalendarView(): CalendarDefaultView {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
