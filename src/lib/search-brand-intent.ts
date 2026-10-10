// "Generiske varer ved bred søgning" (Søgealgoritmer, docs/DECISIONS.md
// 2026-10-04): a brand-less (generic) item only gets its boost when the user
// did not ask for a brand. "letmælk" is a broad search → generic letmælk
// first; "arla" or "arla letmælk" names a brand → no generic boost.
// Pure and import-free so `npm test` can load it directly.

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// True when one of the brand names appears in the query as whole word(s),
// so "arla letmælk" names Arla, but "letmælk" does not name a brand called
// "Let". A half-typed brand ("arl") does not count — its own products still
// match on text, and the boost simply drops once the brand is fully typed.
export function queryNamesBrand(query: string, brandNames: Iterable<string>): boolean {
  const q = ` ${normalizeSearchText(query)} `;
  if (q.trim().length < 2) return false;
  for (const brandName of brandNames) {
    const brand = normalizeSearchText(brandName);
    if (brand.length >= 2 && q.includes(` ${brand} `)) return true;
  }
  return false;
}
