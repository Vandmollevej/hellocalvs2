// Holder logo-navnet, som OpenAI læste på forsiden, op mod Brand-tabellen
// (docs/DECISIONS.md 2026-09-26). Ren funktion, ingen DB-adgang: kalderen
// henter brandlisten. Normaliseringen fjerner store/små bogstaver,
// accenter (men ikke æ/ø/å), ®/™ og alt der ikke er bogstav/tal, så fx
// "Arla®", "ARLA" og "arla" alle er samme brand.

export type BrandCandidate = { id: string; name: string };
export type BrandMatch = { id: string; name: string; score: number };

// Under denne lighed regnes to navne ikke for samme brand.
export const BRAND_MATCH_MIN_SCORE = 0.85;

export function normalizeBrandName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/å/g, "å")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  return longest ? 1 - levenshtein(a, b) / longest : 0;
}

export function matchBrand(text: string | null | undefined, brands: BrandCandidate[]): BrandMatch | null {
  const wanted = normalizeBrandName(text ?? "");
  if (!wanted) return null;

  let best: BrandMatch | null = null;
  for (const brand of brands) {
    const normalized = normalizeBrandName(brand.name);
    if (!normalized) continue;
    const score = normalized === wanted ? 1 : similarity(normalized, wanted);
    if (!best || score > best.score) best = { id: brand.id, name: brand.name, score };
    if (score === 1) break;
  }
  return best && best.score >= BRAND_MATCH_MIN_SCORE ? best : null;
}
