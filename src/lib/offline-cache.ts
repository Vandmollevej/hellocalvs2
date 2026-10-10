// Lokal læsecache, så favoritter, senest anvendte og seneste søgninger kan
// vises uden net (docs/OFFLINE-AUDIT.md). Databasen er stadig sandheden: cachen
// bruges kun, når hentningen fejler, og ryddes ved log ud, så den ikke kan
// ses af den næste bruger på samme enhed.
const PREFIX = "hc-offcache:";
const MAX_SEARCHES = 20;

type Entry<T> = { at: number; data: T };

export type CachedProduct = {
  id: string;
  title: string;
  image?: string | null;
  brand?: string | null;
  kcal?: number;
  macrosEstimated?: boolean;
  nutritionMissing?: boolean;
};

export function readCache<T>(key: string): Entry<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data } satisfies Entry<T>));
  } catch {
    // Fuld lagerplads eller privat tilstand: cachen er kun en bonus.
  }
}

export function clearOfflineCache(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // ignorer
  }
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

type SearchCache = Record<string, Entry<CachedProduct[]>>;

export function saveSearchResults(query: string, results: CachedProduct[]): void {
  const key = normalizeQuery(query);
  if (!key) return;
  const all = readCache<SearchCache>("searches")?.data ?? {};
  all[key] = { at: Date.now(), data: results };
  const keys = Object.keys(all).sort((a, b) => all[b].at - all[a].at);
  for (const stale of keys.slice(MAX_SEARCHES)) delete all[stale];
  writeCache("searches", all);
}

// Præcis match først; ellers den nyeste gemte søgning, hvis tekst indeholder
// søgeordet, filtreret på titlen — så "mælk" kan findes ud fra "letmælk".
export function findCachedSearch(query: string): CachedProduct[] | null {
  const key = normalizeQuery(query);
  if (!key) return null;
  const all = readCache<SearchCache>("searches")?.data;
  if (!all) return null;
  if (all[key]) return all[key].data;
  const hits = new Map<string, CachedProduct>();
  for (const entry of Object.values(all).sort((a, b) => b.at - a.at)) {
    for (const product of entry.data) {
      if (product.title.toLowerCase().includes(key)) hits.set(product.id, product);
    }
  }
  return hits.size > 0 ? [...hits.values()] : null;
}
