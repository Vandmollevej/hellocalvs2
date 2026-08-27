// Pragmatisk OCR-udtræk af næringsværdier fra et foto af en varedeklaration.
// Bruger tesseract.js (klient-side, ingen server/nøgle-afhængighed) til at
// læse teksten, og finder derefter kcal/protein/kulhydrat/fedt pr. 100 g med
// regex-heuristik omkring de danske nøgleord. Dette er bevidst ikke en
// perfekt løsning — brugeren ser og kan altid rette værdierne bagefter.

export type NutritionFields = {
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
};

export type NutritionOcrResult = {
  fields: NutritionFields;
  rawText: string;
  /** True hvis mindst ét felt blev genkendt. */
  ok: boolean;
};

/** Finder det første decimaltal (dansk komma eller punktum) efter en position i teksten. */
function firstNumberAfter(text: string, index: number, window = 40): number | null {
  const slice = text.slice(index, index + window);
  const match = slice.match(/(\d{1,4}(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function findValue(text: string, keywords: RegExp): number | null {
  const match = keywords.exec(text);
  if (!match) return null;
  return firstNumberAfter(text, match.index + match[0].length);
}

/**
 * Udtrækker kcal/protein/kulhydrat/fedt pr. 100 g fra rå OCR-tekst.
 * Energi-linjer viser typisk "kJ / kcal" (fx "1046 kJ/250 kcal") — vi
 * matcher specifikt tallet foran "kcal" for at undgå at gribe kJ-tallet.
 */
export function parseNutritionText(rawText: string): NutritionFields {
  const text = rawText.replace(/\s+/g, " ");

  const kcalMatch = /(\d{1,4}(?:[.,]\d+)?)\s*kcal/i.exec(text);
  const kcalPer100g = kcalMatch ? parseFloat(kcalMatch[1].replace(",", ".")) : null;

  const proteinPer100g = findValue(text, /protein/i);
  const carbsPer100g = findValue(text, /kulhydrat(?:er)?/i);
  const fatPer100g = findValue(text, /fedt/i);

  return {
    kcalPer100g: Number.isFinite(kcalPer100g as number) ? kcalPer100g : null,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
  };
}

/**
 * Kører OCR på et billede (data-URL eller Blob) med tesseract.js og forsøger
 * derefter at udtrække næringsværdierne. Kastes aldrig — fejl resulterer i
 * `ok: false` så den kaldende UI kan vise en manuel fallback.
 */
export async function recognizeNutritionLabel(image: string | Blob): Promise<NutritionOcrResult> {
  try {
    const { recognize } = await import("tesseract.js");
    const { data } = await recognize(image, "dan+eng");
    const rawText = data.text ?? "";
    const fields = parseNutritionText(rawText);
    const ok = Object.values(fields).some((value) => value !== null);
    return { fields, rawText, ok };
  } catch (error) {
    console.error("Nutrition label OCR failed", error);
    return {
      fields: { kcalPer100g: null, proteinPer100g: null, carbsPer100g: null, fatPer100g: null },
      rawText: "",
      ok: false,
    };
  }
}
