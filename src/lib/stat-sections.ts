// Statistiksidens sektioner (Grafer og Kort) og deres rækkefølge. Brugeren
// bestemmer selv, om graferne eller kortene står øverst; rækkefølgen gemmes i
// localStorage ligesom grafer og kort (stat-charts.ts, StatCardsGrid).

export type StatSectionKey = "charts" | "cards";

export const DEFAULT_STAT_SECTION_ORDER: StatSectionKey[] = ["charts", "cards"];

export const STAT_SECTION_ORDER_STORAGE_KEY = "hellocal.statistik.sections";

function sanitize(keys: unknown): StatSectionKey[] {
  if (!Array.isArray(keys)) return [...DEFAULT_STAT_SECTION_ORDER];
  const valid = keys.filter(
    (key, index): key is StatSectionKey =>
      DEFAULT_STAT_SECTION_ORDER.includes(key as StatSectionKey) && keys.indexOf(key) === index,
  );
  // Sektioner, der mangler i en gammel gemt rækkefølge, sættes ind nederst.
  return [...valid, ...DEFAULT_STAT_SECTION_ORDER.filter((key) => !valid.includes(key))];
}

export function loadSectionOrder(): StatSectionKey[] {
  if (typeof window === "undefined") return [...DEFAULT_STAT_SECTION_ORDER];
  try {
    const raw = window.localStorage.getItem(STAT_SECTION_ORDER_STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : [...DEFAULT_STAT_SECTION_ORDER];
  } catch {
    return [...DEFAULT_STAT_SECTION_ORDER];
  }
}

export function saveSectionOrder(keys: StatSectionKey[]) {
  try {
    window.localStorage.setItem(STAT_SECTION_ORDER_STORAGE_KEY, JSON.stringify(sanitize(keys)));
  } catch {
    // localStorage unavailable — ignore.
  }
}

/** Flytter en sektion ét trin op (-1) eller ned (+1). */
export function moveSection(order: StatSectionKey[], key: StatSectionKey, delta: -1 | 1): StatSectionKey[] {
  const index = order.indexOf(key);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
