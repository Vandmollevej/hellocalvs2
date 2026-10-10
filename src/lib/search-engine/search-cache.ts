// Cache af søgemotorens svar (docs/DECISIONS.md 2026-10-10): de samme søgninger
// gentages mange gange ("mælk", "banan"), og indtastning sender én søgning pr.
// bogstav. Kun listen af træffere caches — rangeringen efter popularitet og
// brugerens egen historik regnes altid frisk. Tømmes, når indekset ændres.

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 1_000;

type Entry<T> = { value: T; at: number };
const cache = new Map<string, Entry<unknown>>();

export function cachedSearch<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // Senest brugt sidst, så de ældste ryger først.
  cache.delete(key);
  cache.set(key, entry);
  return entry.value as T;
}

export function storeSearch<T>(key: string, value: T) {
  cache.set(key, { value, at: Date.now() });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

export function clearSearchCache() {
  cache.clear();
}
