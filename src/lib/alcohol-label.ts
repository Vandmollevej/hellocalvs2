// Alkoholprocenten på emballagen (fx "20 % vol" bag på en likørflaske) og
// skønnet energi for alkoholiske drikke uden næringsdeklaration
// (docs/DECISIONS.md 2026-10-15). I EU skal drikke over 1,2 % vol ikke have
// en næringstabel, så uden skøn stod sådan en vare med 0 kcal.

// Drikke over denne grænse må undlade næringsdeklarationen (EU 1169/2011).
export const ALCOHOL_LABEL_EXEMPT_PERCENT = 1.2;

const ETHANOL_DENSITY = 0.789;
const KCAL_PER_GRAM = { alcohol: 7, carbs: 4, protein: 4, fat: 9 };

function percentValue(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 && value <= 96 ? value : null;
}

// "20 % vol", "alc. 40% vol.", "Alkohol 4,6 %", "15% ABV". Lokalt, ingen AI.
export function parseAlcoholPercent(text: string | null | undefined): number | null {
  const source = text ?? "";
  const after = source.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%\s*(?:vol\b|vol\.|alc\b|alk\b|abv\b|v\/v)/i);
  if (after) return percentValue(after[1]);
  const before = source.match(/\b(?:alc|alk|alcohol|alkohol|alkoholgehalt|alcool)\.?\s*:?\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i);
  return before ? percentValue(before[1]) : null;
}

// Energi pr. 100 ml: alkoholen regnes præcist ud fra procenten (7 kcal/g);
// kulhydrat, protein og fedt er et skøn ud fra varetypen.
export function alcoholDrinkKcal(input: { alcoholPercent: number; carbs: number; protein: number; fat: number }) {
  const alcoholGrams = input.alcoholPercent * ETHANOL_DENSITY;
  return Math.round(
    alcoholGrams * KCAL_PER_GRAM.alcohol +
      input.carbs * KCAL_PER_GRAM.carbs +
      input.protein * KCAL_PER_GRAM.protein +
      input.fat * KCAL_PER_GRAM.fat,
  );
}
