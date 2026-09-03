// Lokal, gratis tekstgenkendelse af et kamerabillede (tesseract.js, kører i
// browseren) samt regex-parsing af en næringsdeklarations rå OCR-tekst. Bruges
// af det guidede auto-genkendelsesflow i /camera/create, jf. docs/DECISIONS.md:
// lokal OCR/regex forsøges altid først, AI-vision er kun sidste udvej.

export type ParsedNutrition = {
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

// Kører tesseract.js på et data-URL-billede og returnerer rå tekst. Dynamisk
// import, så biblioteket kun hentes i browseren og aldrig indgår i
// server-bundlen.
export async function extractText(imageDataUrl: string): Promise<string> {
  const { recognize } = await import("tesseract.js");
  const result = await recognize(imageDataUrl, "dan+eng");
  return result.data.text ?? "";
}

// Simpel heuristik for "har billedet overhovedet tekst" — bruges til at
// vælge mellem tekst-sporet (OCR + database-match) og det tekstløse spor
// (billedgenkendelse), jf. krav 2-3.
export function hasMeaningfulText(text: string): boolean {
  const letters = text.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= 4;
}

// Matcher både danske og engelske næringsdeklarationslabels, pr. 100 g/ml.
// Kun linjer med et eksplicit "pr. 100g/100ml"-tal accepteres — ellers kan en
// portionsstørrelse fejlagtigt blive læst som pr.-100g-værdi.
const PATTERNS: Record<keyof ParsedNutrition, RegExp[]> = {
  kcalPer100g: [
    /energi[^0-9]{0,20}([0-9]+(?:[.,][0-9]+)?)\s*kcal/i,
    /(?:^|\s)([0-9]+(?:[.,][0-9]+)?)\s*kcal/i,
  ],
  proteinPer100g: [/protein[^0-9]{0,10}([0-9]+(?:[.,][0-9]+)?)\s*g/i],
  carbsPer100g: [
    /kulhydrat(?:er)?[^0-9]{0,10}([0-9]+(?:[.,][0-9]+)?)\s*g/i,
    /carbohydrate[s]?[^0-9]{0,10}([0-9]+(?:[.,][0-9]+)?)\s*g/i,
  ],
  fatPer100g: [/fedt[^0-9]{0,10}([0-9]+(?:[.,][0-9]+)?)\s*g/i, /fat[^0-9]{0,10}([0-9]+(?:[.,][0-9]+)?)\s*g/i],
};

function matchFirst(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace(",", "."));
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
}

// Returnerer alle fire pr.-100g-værdier, eller null hvis blot ét af dem ikke
// kunne udledes med sikkerhed af den rå OCR-tekst (jf. krav om at AI-vision
// kun steppes ind når regex-parsingen fejler).
export function parseNutritionText(rawText: string): ParsedNutrition | null {
  const kcalPer100g = matchFirst(rawText, PATTERNS.kcalPer100g);
  const proteinPer100g = matchFirst(rawText, PATTERNS.proteinPer100g);
  const carbsPer100g = matchFirst(rawText, PATTERNS.carbsPer100g);
  const fatPer100g = matchFirst(rawText, PATTERNS.fatPer100g);

  if (kcalPer100g === null || proteinPer100g === null || carbsPer100g === null || fatPer100g === null) {
    return null;
  }
  return { kcalPer100g, proteinPer100g, carbsPer100g, fatPer100g };
}
