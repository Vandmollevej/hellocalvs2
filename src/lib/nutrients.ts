// Fælles katalog over næringsstoffer ud over de fire kernemakroer
// (docs/DECISIONS.md 2026-09-24 "Usikkerheds-~"). Nøglerne er de samme som
// Statistik-kortenes nøgler (src/lib/stat-cards.ts) og "Vis mere"-tabellens
// oversættelsesnøgler (addProduct.nutrient.<key>), så én værdi kan følge
// med hele vejen fra Frida/varedeklaration → produkt → registrering →
// statistik uden omdøbning.
//
// Værdier gemmes altid pr. 100 g i katalogets egen enhed (`unit`).
// fridaParameterIds er DTU Frida's ParameterID (arket "Parameter" i
// Frida_FCDB_*.xlsx); flere id'er lægges sammen (fx umættet = enkelt- +
// flerumættede fedtsyrer). Holdes i sync med scripts/frida-import/agent.py.

export type NutrientKey =
  | "sugar"
  | "fiber"
  | "salt"
  | "saturatedFat"
  | "unsaturatedFat"
  | "transFat"
  | "cholesterol"
  | "sodium"
  | "potassium"
  | "calcium"
  | "magnesium"
  | "iron"
  | "zinc"
  | "copper"
  | "manganese"
  | "selenium"
  | "phosphorus"
  | "iodine"
  | "vitaminA"
  | "vitaminC"
  | "vitaminD"
  | "vitaminE"
  | "vitaminK"
  | "vitaminB1"
  | "vitaminB2"
  | "vitaminB3"
  | "vitaminB5"
  | "vitaminB6"
  | "vitaminB7"
  | "vitaminB9"
  | "vitaminB12";

export type NutrientDef = {
  key: NutrientKey;
  unit: "g" | "mg" | "µg";
  digits: number;
  fridaParameterIds: number[];
  group: "macro" | "mineral" | "vitamin";
};

export const NUTRIENTS: NutrientDef[] = [
  { key: "saturatedFat", unit: "g", digits: 1, fridaParameterIds: [248], group: "macro" },
  { key: "unsaturatedFat", unit: "g", digits: 1, fridaParameterIds: [247, 251], group: "macro" },
  { key: "transFat", unit: "g", digits: 2, fridaParameterIds: [261], group: "macro" },
  { key: "cholesterol", unit: "mg", digits: 0, fridaParameterIds: [115], group: "macro" },
  { key: "sugar", unit: "g", digits: 1, fridaParameterIds: [245], group: "macro" },
  { key: "fiber", unit: "g", digits: 1, fridaParameterIds: [168], group: "macro" },
  { key: "salt", unit: "g", digits: 1, fridaParameterIds: [327], group: "macro" },
  { key: "sodium", unit: "mg", digits: 0, fridaParameterIds: [201], group: "mineral" },
  { key: "potassium", unit: "mg", digits: 0, fridaParameterIds: [165], group: "mineral" },
  { key: "calcium", unit: "mg", digits: 0, fridaParameterIds: [108], group: "mineral" },
  { key: "magnesium", unit: "mg", digits: 0, fridaParameterIds: [184], group: "mineral" },
  { key: "iron", unit: "mg", digits: 1, fridaParameterIds: [162], group: "mineral" },
  { key: "zinc", unit: "mg", digits: 1, fridaParameterIds: [274], group: "mineral" },
  { key: "copper", unit: "mg", digits: 2, fridaParameterIds: [166], group: "mineral" },
  { key: "manganese", unit: "mg", digits: 2, fridaParameterIds: [187], group: "mineral" },
  { key: "selenium", unit: "µg", digits: 0, fridaParameterIds: [230], group: "mineral" },
  { key: "phosphorus", unit: "mg", digits: 0, fridaParameterIds: [214], group: "mineral" },
  { key: "iodine", unit: "µg", digits: 0, fridaParameterIds: [163], group: "mineral" },
  { key: "vitaminA", unit: "µg", digits: 0, fridaParameterIds: [12], group: "vitamin" },
  { key: "vitaminC", unit: "mg", digits: 0, fridaParameterIds: [47], group: "vitamin" },
  { key: "vitaminD", unit: "µg", digits: 1, fridaParameterIds: [126], group: "vitamin" },
  { key: "vitaminE", unit: "mg", digits: 1, fridaParameterIds: [135], group: "vitamin" },
  { key: "vitaminK", unit: "µg", digits: 0, fridaParameterIds: [442], group: "vitamin" },
  { key: "vitaminB1", unit: "mg", digits: 2, fridaParameterIds: [37], group: "vitamin" },
  { key: "vitaminB2", unit: "mg", digits: 2, fridaParameterIds: [39], group: "vitamin" },
  { key: "vitaminB3", unit: "mg", digits: 1, fridaParameterIds: [294], group: "vitamin" },
  { key: "vitaminB5", unit: "mg", digits: 1, fridaParameterIds: [210], group: "vitamin" },
  { key: "vitaminB6", unit: "mg", digits: 2, fridaParameterIds: [40], group: "vitamin" },
  { key: "vitaminB7", unit: "µg", digits: 1, fridaParameterIds: [42], group: "vitamin" },
  { key: "vitaminB9", unit: "µg", digits: 0, fridaParameterIds: [143], group: "vitamin" },
  { key: "vitaminB12", unit: "µg", digits: 1, fridaParameterIds: [38], group: "vitamin" },
];

export const NUTRIENT_KEYS = NUTRIENTS.map((n) => n.key);
export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<
  NutrientKey,
  NutrientDef
>;

export function isNutrientKey(value: string): value is NutrientKey {
  return value in NUTRIENT_BY_KEY;
}

// Hvor en værdi kommer fra (Product.nutrientSources). LABEL = producentens
// egen varedeklaration/producentdata, REFERENCE = officiel database (Frida)
// på selve den generiske vare — begge er "sikre". ESTIMATED = lånt fra en
// generisk/lignende vare fordi producenten ikke oplyser feltet, AI = AI-
// udfyldt uden deklaration — begge får ~ (DECISIONS 2026-09-24).
export type NutrientSource = "LABEL" | "REFERENCE" | "ESTIMATED" | "AI";

export function isEstimatedSource(source: string | null | undefined): boolean {
  return source === "ESTIMATED" || source === "AI";
}

// Én opløst værdi pr. 100 g, som /api/products/[id] sender til klienten.
// `tolerancePer100g` er producentens egen ± (kun når producenten selv
// oplyser den — vises 1:1, aldrig beregnet af os).
export type ResolvedNutrient = {
  key: NutrientKey;
  per100g: number;
  estimated: boolean;
  tolerancePer100g: number | null;
};

// Makroerne, der udløser ~ ved kalorietallet i søgeresultater, når én af
// dem er estimeret.
export const MACRO_SOURCE_KEYS = ["kcal", "protein", "carbs", "fat"] as const;

export function hasEstimatedMacros(nutrientSources: unknown): boolean {
  if (!nutrientSources || typeof nutrientSources !== "object") return false;
  const sources = nutrientSources as Record<string, unknown>;
  return MACRO_SOURCE_KEYS.some((key) => isEstimatedSource(sources[key] as string | undefined));
}

export function asNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}
