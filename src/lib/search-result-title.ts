// Søgeresultatets tekstlinje (bruger 2026-10-10, docs/REGLER.md → Søgning):
// brand og subbrand er det vigtigste og står altid først — "Nescafé Gold
// Instant kaffe", ikke "Gold" med mærket gemt i undertitlen. Står brandet
// eller subbrandet allerede i varenavnet, flyttes det frem i stedet for at
// gentages. Sammenligningen er uden hensyn til store bogstaver og accenter.

type Token = { norm: string; start: number; end: number };

function fold(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("da");
}

function tokenize(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => ({
    norm: fold(match[0]),
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function startsWith(words: string[], prefix: string[]) {
  return prefix.length > 0 && prefix.length <= words.length && prefix.every((word, i) => words[i] === word);
}

// Fjerner hver forekomst af ordfølgen `phrase` (hele ord) fra teksten.
function removePhrase(text: string, phrase: string) {
  const needle = tokenize(phrase).map((token) => token.norm);
  if (needle.length === 0) return text;
  let result = text;
  for (;;) {
    const tokens = tokenize(result);
    const at = tokens.findIndex((_, i) => startsWith(tokens.slice(i).map((token) => token.norm), needle));
    if (at < 0) return result;
    result = `${result.slice(0, tokens[at].start)} ${result.slice(tokens[at + needle.length - 1].end)}`;
  }
}

// Mellemrum og skilletegn, der bliver hængende, når et ord flyttes frem.
function tidy(text: string) {
  return text
    .replace(/\s+([,.;:)])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.;:·\-–—]+|[\s,;:·\-–—]+$/g, "");
}

export function searchResultTitle(parts: { name: string; brand?: string | null; subbrand?: string | null }) {
  const brand = parts.brand?.trim() || "";
  const subbrand = parts.subbrand?.trim() || "";
  const brandWords = tokenize(brand).map((token) => token.norm);
  const subbrandWords = tokenize(subbrand).map((token) => token.norm);

  // "Arla" + "Arla Protein" → "Arla Protein"; ellers "Brand Subbrand".
  let prefix: string;
  const removals = [subbrand, brand];
  if (!subbrand) prefix = brand;
  else if (!brand) prefix = subbrand;
  else if (startsWith(subbrandWords, brandWords)) {
    prefix = subbrand;
    removals.push(subbrand.slice(tokenize(subbrand)[brandWords.length - 1].end));
  } else if (startsWith(brandWords, subbrandWords)) prefix = brand;
  else prefix = `${brand} ${subbrand}`;

  // Længste ordfølge først, så "Arla Protein" fjernes før "Arla".
  const rest = removals
    .filter((phrase) => phrase.trim())
    .sort((a, b) => tokenize(b).length - tokenize(a).length)
    .reduce((text, phrase) => removePhrase(text, phrase), parts.name);
  return [prefix, tidy(rest)].filter(Boolean).join(" ");
}
