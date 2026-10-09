// Tilføj-menuens ikon-felter: hvilke der er aktive og deres rækkefølge.
// Gemmes i localStorage ligesom statistikkens grafer (src/lib/stat-charts.ts).

export const ADD_MENU_LAYOUT_STORAGE_KEY = "hellocal.addMenuLayout";

export function loadAddMenuLayout(allKeys: readonly string[]): string[] {
  if (typeof window === "undefined") return [...allKeys];
  try {
    const raw = window.localStorage.getItem(ADD_MENU_LAYOUT_STORAGE_KEY);
    if (!raw) return [...allKeys];
    return sanitizeAddMenuLayout(JSON.parse(raw), allKeys);
  } catch {
    return [...allKeys];
  }
}

export function saveAddMenuLayout(keys: string[], allKeys: readonly string[]) {
  try {
    window.localStorage.setItem(
      ADD_MENU_LAYOUT_STORAGE_KEY,
      JSON.stringify(sanitizeAddMenuLayout(keys, allKeys)),
    );
  } catch {
    // localStorage unavailable — ignore.
  }
}

/** Ukendte og dobbelte nøgler fjernes; en tom liste er tilladt (alt er fjernet). */
export function sanitizeAddMenuLayout(value: unknown, allKeys: readonly string[]): string[] {
  if (!Array.isArray(value)) return [...allKeys];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const key of value) {
    if (typeof key === "string" && allKeys.includes(key) && !seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}
