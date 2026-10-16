// Venstre menu: i admin er alle grupper lukket, i webversionen foldet ud,
// hver gang siden åbnes på ny — efter login, og når fanen/vinduet har været
// lukket. Brugerens egne fold/sammenklap huskes kun, så længe fanen er åben
// (sessionStorage), så en genindlæsning ikke nulstiller dem. Valget må aldrig
// ligge i localStorage: så ville en gammel sammenfoldet menu følge med ind i
// næste besøg.
export const ADMIN_OPEN_GROUPS_KEY = "hc-admin-open-groups";
export const ADMIN_COLLAPSED_KEY = "hc-admin-sidebar-collapsed";
export const WEB_COLLAPSED_KEY = "hc-web-sidebar-collapsed";

const ALL_KEYS = [ADMIN_OPEN_GROUPS_KEY, ADMIN_COLLAPSED_KEY, WEB_COLLAPSED_KEY];

export function readSidebarState(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSidebarState(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Privat vindue o.l. — valget huskes bare ikke.
  }
}

// Kaldes ved login og logout, så næste visning starter forfra (admin lukket, web foldet ud).
// Fjerner også en gammel localStorage-værdi fra den tidligere version.
export function clearSidebarState() {
  for (const key of ALL_KEYS) {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // ignorer
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignorer
    }
  }
}
