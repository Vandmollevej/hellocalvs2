// 2-års kvalitetstjek (docs/DECISIONS.md 2026-10-15) — de rene regler bag
// src/lib/product-recheck.ts, uden database, så de kan testes direkte.
//
// En vare, der har ligget i databasen i over to år (eller blev tjekket for
// over to år siden), fremstår som ny, når en kunde scanner den: kameraet tager
// forside, energi og indhold som ved en ny vare. Grafikken og
// ingredienslisten kan have ændret sig siden, og måske kan der tages et
// bedre billede.

export const RECHECK_AFTER_YEARS = 2;

export type RecheckCandidate = {
  createdAt: Date;
  qualityCheckedAt: Date | null;
  privateOwnerId: string | null;
  discontinued: boolean;
  deletedAt: Date | null;
  status: string;
  // Varen læses stadig (opret straks): den er ikke gammel.
  pendingFields: string[];
};

// Tidspunktet, hvor varen igen skal tjekkes: to år efter oprettelsen eller
// det seneste tjek.
export function recheckDueAt(product: Pick<RecheckCandidate, "createdAt" | "qualityCheckedAt">): Date {
  const anchor =
    product.qualityCheckedAt && product.qualityCheckedAt > product.createdAt ? product.qualityCheckedAt : product.createdAt;
  const due = new Date(anchor.getTime());
  due.setUTCFullYear(due.getUTCFullYear() + RECHECK_AFTER_YEARS);
  return due;
}

// Private ingredienser, udgåede, slettede og afviste varer tjekkes ikke.
export function isRecheckDue(product: RecheckCandidate, now: Date = new Date()): boolean {
  if (product.privateOwnerId || product.discontinued || product.deletedAt) return false;
  if (product.status === "REJECTED" || product.pendingFields.length) return false;
  return recheckDueAt(product).getTime() <= now.getTime();
}

export type RecheckValues = {
  name?: string | null;
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  ingredientsText: string | null;
};

export const RECHECK_NUTRITION_FIELDS = ["kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g"] as const;
export type RecheckNutritionField = (typeof RECHECK_NUTRITION_FIELDS)[number];
export type RecheckField = RecheckNutritionField | "ingredientsText";

// Afrundingen på deklarationen må ikke tælle som en ændring: kcal skal
// afvige mindst 3 kcal og 3 %, makroer mindst 0,3 g og 5 %.
function nutritionChanged(field: RecheckNutritionField, before: number | null, after: number | null): boolean {
  if (after == null || !Number.isFinite(after)) return false;
  if (before == null || !Number.isFinite(before)) return true;
  const diff = Math.abs(after - before);
  const scale = Math.max(Math.abs(before), Math.abs(after));
  return field === "kcalPer100g" ? diff >= 3 && diff >= scale * 0.03 : diff >= 0.3 && diff >= scale * 0.05;
}

function ingredientWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/^\s*ingredienser\s*:?/, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);
}

// Ordlighed (Dice) mellem to ingredienslister, 0–1. Rækkefølge og tegnsætning
// tæller ikke — kun hvilke ord der står.
export function ingredientsSimilarity(a: string, b: string): number {
  const left = new Set(ingredientWords(a));
  const right = new Set(ingredientWords(b));
  if (!left.size && !right.size) return 1;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return (2 * shared) / (left.size + right.size);
}

// Under 90 % ens ord er en ændret liste (en ny ingrediens i en kort liste,
// eller flere i en lang). Mindre forskelle er typisk aflæsning.
export const INGREDIENTS_CHANGED_BELOW = 0.9;

// Felterne, hvor de aflæste værdier afviger fra originalen. Et felt, der ikke
// kunne læses, er aldrig en ændring.
export function changedRecheckFields(original: RecheckValues, read: RecheckValues): RecheckField[] {
  const changed: RecheckField[] = [];
  for (const field of RECHECK_NUTRITION_FIELDS) {
    if (nutritionChanged(field, original[field], read[field])) changed.push(field);
  }
  const after = read.ingredientsText?.trim();
  if (after) {
    const before = original.ingredientsText?.trim() ?? "";
    if (!before || ingredientsSimilarity(before, after) < INGREDIENTS_CHANGED_BELOW) changed.push("ingredientsText");
  }
  return changed;
}

export const RECHECK_FIELD_LABELS: Record<RecheckField, string> = {
  kcalPer100g: "Energi (kcal/100)",
  proteinPer100g: "Protein (g/100)",
  carbsPer100g: "Kulhydrat (g/100)",
  fatPer100g: "Fedt (g/100)",
  ingredientsText: "Ingredienser",
};

// Registreringens snapshot for en mængde (samme felter som ved oprettelsen).
export function registrationMacros(values: Record<RecheckNutritionField, number>, amountGrams: number) {
  const factor = amountGrams / 100;
  return {
    kcalSnapshot: values.kcalPer100g * factor,
    proteinSnapshot: values.proteinPer100g * factor,
    carbsSnapshot: values.carbsPer100g * factor,
    fatSnapshot: values.fatPer100g * factor,
  };
}
