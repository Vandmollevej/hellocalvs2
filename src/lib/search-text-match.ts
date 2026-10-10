// Tekstmatch i søgningen, som tåler sammensatte ord og varetype-feltet
// (docs/DECISIONS.md 2026-10-10): "instantkaffe" finder "Instant Kaffe", og
// "nescafé instant kaffe" finder butiksvaren "Gold" fra Nescafé med varetypen
// "Instant kaffe". Rene regler uden imports, så `npm test` kan indlæse dem.

// Små bogstaver og uden accenter ("Nescafé" → "nescafe").
export function foldText(value: string): string {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase().trim();
}

// Uden mellemrum og tegn, så "instant kaffe", "instant-kaffe" og "instantkaffe" er ens.
export function compactText(value: string): string {
  return foldText(value).replace(/[\s\p{P}]+/gu, "");
}

export function searchWords(query: string): string[] {
  return foldText(query)
    .split(/[\s\p{P}]+/u)
    .filter((word) => word.length >= 2);
}

// Hvert ord i søgningen står i teksten — enten som det er, eller når teksten
// læses uden mellemrum (sammensatte ord skrevet i ét eller flere ord).
export function allWordsMatch(query: string, text: string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return false;
  const folded = foldText(text);
  const tight = compactText(text);
  return words.every((word) => folded.includes(word) || tight.includes(word));
}

// Varens øvrige beskrivende felter, som søgningen også læser.
export function productDetailsText(product: {
  productType?: string | null;
  subbrand?: string | null;
  variant?: string | null;
  flavor?: string | null;
}): string {
  return [product.subbrand, product.productType, product.variant, product.flavor].filter(Boolean).join(" ");
}
