// Rettelse af søgeord ("Mente du …?", docs/DECISIONS.md 2026-10-10). Rene regler
// uden imports, så `npm test` kan indlæse dem direkte. Opslaget mod ordlisten
// ligger i search-correction.ts.

// Højst så mange tegns forskel (levenshtein på ord uden accenter) før et ord i
// ordlisten regnes for en rettelse. En ombytning ("mealk" → "mælk") tæller 2.
export function maxEditDistance(wordLength: number): number {
  if (wordLength < 3) return 0;
  return wordLength <= 4 ? 1 : 2;
}

// Ord, der kan rettes: mindst 3 tegn og uden tal ("500g", "2%").
export function correctableWord(token: string): boolean {
  return token.length >= 3 && !/\d/.test(token);
}

export function splitQueryTokens(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

// Sætter rettelserne ind i søgningen og beholder uændrede ord som skrevet.
// Returnerer null, hvis intet ord blev rettet.
export function applyCorrections(query: string, corrections: Map<string, string>): string | null {
  const tokens = splitQueryTokens(query);
  let changed = false;
  const out = tokens.map((token) => {
    const fixed = corrections.get(token);
    if (fixed && fixed !== token.toLowerCase()) {
      changed = true;
      return fixed;
    }
    return token;
  });
  return changed ? out.join(" ") : null;
}

// Escape af LIKE-tegnene, så "100%" og "a_b" matches bogstaveligt.
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
