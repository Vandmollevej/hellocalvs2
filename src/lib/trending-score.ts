// "Trender netop nu" (docs/DECISIONS.md 2026-10-10 og 2026-10-17).
//
// Rækkefølge: retter med nye klik først (flest klik øverst), derefter resten
// efter et trender-tal. Trender-tallet nedarves fra kilden (HelloFreshs og
// Valdemarsros egne bedømmelser/favoritter, delte retters popularitet); har
// kilden intet tal, bruges et fiktivt tal, der er det samme hele dagen, så der
// altid vises noget.

export type SourcePopularity = {
  rating?: number | null;
  ratingCount?: number | null;
  favoriteCount?: number | null;
};

// Deterministisk "tilfældigt" tal (FNV-1a), så rækkefølgen ikke skifter ved
// hver genindlæsning, men først næste dag.
export function dailyOrder(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function readSourcePopularity(details: unknown): SourcePopularity | null {
  if (!details || typeof details !== "object") return null;
  const raw = (details as Record<string, unknown>).sourcePopularity;
  if (!raw || typeof raw !== "object") return null;
  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null);
  const r = raw as Record<string, unknown>;
  const result = { rating: num(r.rating), ratingCount: num(r.ratingCount), favoriteCount: num(r.favoriteCount) };
  return result.rating === null && result.ratingCount === null && result.favoriteCount === null ? null : result;
}

// Kildens tal omregnet til 0-50: flere bedømmelser/favoritter giver mere
// (logaritmisk, så 10.000 ikke knuser alt), en høj bedømmelse vægter op.
export function sourceScore(popularity: SourcePopularity | null): number | null {
  if (!popularity) return null;
  const count = (popularity.ratingCount ?? 0) + (popularity.favoriteCount ?? 0);
  const rating = popularity.rating != null && popularity.rating > 0 ? Math.min(popularity.rating, 5) / 5 : null;
  if (count <= 0 && rating === null) return null;
  const volume = count > 0 ? Math.min(10 * Math.log10(1 + count), 40) : 5;
  return Math.round(volume * (rating ?? 0.8) + (rating ?? 0) * 10);
}

// Fiktivt trender-tal (0-19), når kilden intet tal har.
export function fictiveScore(key: string, day: string) {
  return dailyOrder(`${day}:${key}`) % 20;
}

export type TrendingCandidate = {
  key: string;
  clicks: number;
  // Kun bestået et næringsfilter pga. ukendt næring o.l. (opfyldning).
  relaxed: boolean;
  hasEnergy: boolean;
  trendScore: number;
};

export function compareTrending(a: TrendingCandidate, b: TrendingCandidate) {
  if (a.clicks !== b.clicks) return b.clicks - a.clicks;
  if (a.relaxed !== b.relaxed) return Number(a.relaxed) - Number(b.relaxed);
  if (a.hasEnergy !== b.hasEnergy) return Number(b.hasEnergy) - Number(a.hasEnergy);
  if (a.trendScore !== b.trendScore) return b.trendScore - a.trendScore;
  return a.key.localeCompare(b.key);
}
