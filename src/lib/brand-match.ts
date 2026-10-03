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

// Brandet i databasen vinder (brugerens krav 2026-10-02: EDEKA-kartonen fik
// "Herzstücke"/hjertet som brand, selv om EDEKA lå i databasen med logo).
// Finder et kendt brand, der står ordret (normaliseret) i en af AI'ens
// tekster på forsiden — subbrand, logotekst, synlig tekst eller claims.
// Kun eksakt match (score 1), og kun navne på mindst 4 tegn, så et kort/
// generisk ord aldrig matcher ved et tilfælde. Længste navn vinder.
export function matchBrandInTexts(
  texts: (string | null | undefined)[],
  brands: BrandCandidate[],
): BrandMatch | null {
  const haystack = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    haystack.add(normalizeBrandName(text));
    // Også de enkelte ord og ordpar ("EDEKA Herzstücke" → EDEKA, Herzstücke,
    // EDEKAHerzstücke), så et mærke inde i en sætning også findes.
    const words = text.split(/\s+/).filter(Boolean);
    for (let index = 0; index < words.length; index++) {
      haystack.add(normalizeBrandName(words[index]));
      if (index + 1 < words.length) haystack.add(normalizeBrandName(`${words[index]} ${words[index + 1]}`));
    }
  }
  haystack.delete("");
  if (!haystack.size) return null;
  let best: BrandMatch | null = null;
  for (const brand of brands) {
    const normalized = normalizeBrandName(brand.name);
    if (normalized.length < 4 || !haystack.has(normalized)) continue;
    if (!best || normalized.length > normalizeBrandName(best.name).length) best = { id: brand.id, name: brand.name, score: 1 };
  }
  return best;
}
