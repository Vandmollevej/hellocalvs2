import { useSyncExternalStore } from "react";

// Single source of truth for which routes are footer roots (docs/DECISIONS.md
// 2026-09-22 "Global tilbage-navigation"). A page opened directly from the
// persistent bottom nav is a top-level destination and shows no back arrow;
// every other routed page — including nested routes under a footer root —
// gets the shared back arrow in ScreenHeader.

export const BOTTOM_NAV_STORAGE_KEY = "hellocal:bottomnav:v1";
export const BOTTOM_NAV_CHANGED_EVENT = "hellocal:bottomnav-changed";

// Stable nav-item key → route. BottomNav renders its items from this map.
export const BOTTOM_NAV_HREFS: Record<string, string> = {
  hjem: "/",
  madvarer: "/foods",
  kalender: "/calendar",
  statistik: "/statistics",
  kamera: "/camera",
  soeg: "/search",
  stemme: "/voice",
  profil: "/profile",
  favoritter: "/favorites",
  viden: "/viden-om",
  opskrifter: "/profile/recipes",
  status: "/profile/status",
  billeddagbog: "/profile/photo-diary",
  kropsmaal: "/profile/body-measurements",
  screeninger: "/profile/screenings",
};

// Hjem er obligatorisk og stationær: den står altid fast ved siden af slideren
// og indgår ikke i den redigerbare liste. Gamle layouts kaldte den "tilfoej".
export const HOME_NAV_KEY = "hjem";
export const LEGACY_HOME_NAV_KEY = "tilfoej";
export const DEFAULT_BOTTOM_NAV_ACTIVE = ["madvarer", "kalender", "statistik"];

function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

// Exact match only — "/foods" is a footer root, "/foods/new" is not.
export function isMainFooterRoute(pathname: string, footerHrefs: readonly string[]): boolean {
  return footerHrefs.includes(normalizePath(pathname));
}

function hrefsForKeys(keys: readonly string[]): string {
  return [HOME_NAV_KEY, ...keys]
    .map((k) => BOTTOM_NAV_HREFS[k])
    .filter(Boolean)
    .join("|");
}

const DEFAULT_SNAPSHOT = hrefsForKeys(DEFAULT_BOTTOM_NAV_ACTIVE);

function readSnapshot(): string {
  try {
    const raw = window.localStorage.getItem(BOTTOM_NAV_STORAGE_KEY);
    if (!raw) return DEFAULT_SNAPSHOT;
    const active = (JSON.parse(raw) as { active?: string[] }).active ?? [];
    const snapshot = hrefsForKeys(active);
    return snapshot || DEFAULT_SNAPSHOT;
  } catch {
    return DEFAULT_SNAPSHOT;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(BOTTOM_NAV_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BOTTOM_NAV_CHANGED_EVENT, onChange);
  };
}

// The user can rearrange which items sit in the footer, so the set of root
// routes follows the saved layout. useSyncExternalStore with the default
// layout as server snapshot avoids hydration mismatches (DECISIONS.md,
// localStorage-backed preferences on prerendered routes).
export function useFooterRootHrefs(): string[] {
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => DEFAULT_SNAPSHOT);
  return snapshot.split("|");
}
