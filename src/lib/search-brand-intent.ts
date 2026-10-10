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

// Brand/subbrand først (docs/DECISIONS.md 2026-10-10): et subbrand tæller,
// når det står som hele ord i søgningen — alene ("cheasy") eller med brandet
// foran ("arla cheasy"). Mindst 3 tegn, så et kort subbrand ikke rammer tilfældigt.
export function queryNamesSubbrand(
  query: string,
  subbrand: string | null | undefined,
  brandName?: string | null
): boolean {
  if (!subbrand || normalizeSearchText(subbrand).length < 3) return false;
  return queryNamesBrand(query, brandName ? [subbrand, `${brandName} ${subbrand}`] : [subbrand]);
}

// Søgningen uden de ord, der udgør brand/subbrand ("arla skyr" → "skyr"), så
// brandets varer indbyrdes sorteres efter resten af søgningen. Tom, når hele
// søgningen er brandet.
export function queryWithoutNames(query: string, names: Iterable<string | null | undefined>): string {
  let q = ` ${normalizeSearchText(query)} `;
  for (const name of names) {
    const n = name ? normalizeSearchText(name) : "";
    if (n.length >= 2) q = q.split(` ${n} `).join(" ");
  }
  return q.replace(/\s+/g, " ").trim();
}
