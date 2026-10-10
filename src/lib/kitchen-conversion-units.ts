// Omregning mellem rumfang (dl, spsk …) og gram ud fra omregningstabellen
// (src/data/kitchen-conversions.json, bygget af
// scripts/kitchen-conversions-build.py). Rene funktioner uden import, så
// testen kan give tabellen med; appen bruger src/lib/kitchen-conversions.ts.
// Native: screens/onboarding/KitchenConversions.kt (samme regler).

export type KitchenConversionGroup = { id: string; title: string };
export type KitchenConversion = {
  id: string;
  group: string;
  name: string;
  gramsPerDl: number;
  keywords: string[];
};

// Danske køkkenmål i ml. "knsp" har ingen fast størrelse og omregnes ikke.
export const VOLUME_UNIT_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  cl: 10,
  centiliter: 10,
  dl: 100,
  deciliter: 100,
  l: 1000,
  liter: 1000,
  spsk: 15,
  "spsk.": 15,
  tsk: 5,
  "tsk.": 5,
};

export function volumeUnitMl(unit: string | null | undefined): number | null {
  if (!unit) return null;
  return VOLUME_UNIT_ML[unit.trim().toLowerCase()] ?? null;
}

const LETTER = "a-zæøåäöüéèêáàíóúç";
// Bøjninger, der stadig er samme vare ("mælken", "æggehvider", "olien").
const SUFFIX = "(?:ene|en|et|er|rne|e|n|r|s)?";

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const keywordPatterns = new Map<string, RegExp>();
function keywordPattern(keyword: string): RegExp {
  let pattern = keywordPatterns.get(keyword);
  if (!pattern) {
    pattern = new RegExp(`(^|[^${LETTER}])${escapeRegex(keyword)}${SUFFIX}($|[^${LETTER}])`, "i");
    keywordPatterns.set(keyword, pattern);
  }
  return pattern;
}

// Den vare i tabellen, hvis nøgleord passer på navnet som helt ord. Det
// længste nøgleord vinder ("kokosmælk" før "mælk", "olivenolie" før "olie").
export function findConversionIn(
  items: readonly KitchenConversion[],
  name: string | null | undefined,
): KitchenConversion | null {
  const text = (name ?? "").toLowerCase();
  if (!text.trim()) return null;
  let best: KitchenConversion | null = null;
  let bestLength = 0;
  for (const item of items) {
    for (const keyword of item.keywords) {
      if (keyword.length > bestLength && keywordPattern(keyword).test(text)) {
        best = item;
        bestLength = keyword.length;
      }
    }
  }
  return best;
}

// Mængde i et rumfangsmål → gram. Null, når enheden ikke er et rumfang.
export function volumeToGrams(amount: number, unit: string | null | undefined, item: KitchenConversion): number | null {
  const ml = volumeUnitMl(unit);
  if (ml === null || !Number.isFinite(amount)) return null;
  return (amount * ml * item.gramsPerDl) / 100;
}

export type KitchenMeasure = { amount: number; unit: "dl" | "spsk" | "tsk" };

// Gram → det køkkenmål en opskrift ville skrive: dl fra ½ dl og op, ellers
// spsk, og under 1 spsk tsk. Afrundet til ½ (dl til 0,1 under 1 dl).
export function gramsToMeasure(grams: number, item: KitchenConversion): KitchenMeasure | null {
  if (!Number.isFinite(grams) || grams <= 0) return null;
  const ml = (grams * 100) / item.gramsPerDl;
  if (ml >= 50) {
    const dl = ml / 100;
    return { amount: dl < 1 ? Math.round(dl * 10) / 10 : Math.round(dl * 2) / 2, unit: "dl" };
  }
  if (ml >= 15) return { amount: Math.max(1, Math.round((ml / 15) * 2) / 2), unit: "spsk" };
  return { amount: Math.max(0.5, Math.round((ml / 5) * 2) / 2), unit: "tsk" };
}

export function formatKitchenNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}
