export type AnalysisIds = {
  front?: string;
  ingredients?: string;
  nutrition?: string;
  // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): id på den
  // AiProductAnalysis-række der gemte selve stregkode-fotoet (kind=BARCODE),
  // så den lokale billedanalyse-agent senere kan sammenligne det mod
  // produktets forsidefoto.
  barcode?: string;
};

// Område i billedet, 0-1 af bredde/højde fra øverste venstre hjørne.
export type ImageBox = { x: number; y: number; width: number; height: number };

export type ProductFrontAnalysis = {
  // Navnet på logoet, læst visuelt af AI'en (logoer er ofte for kreative til
  // almindelig OCR), og hvor logoet/produktet står i fotoet — bruges til
  // fritskrabning (docs/DECISIONS.md 2026-09-26).
  logoText: string | null;
  logoConfidence: number;
  logoBox: ImageBox | null;
  productBox: ImageBox | null;
  brand: string | null;
  subbrand: string | null;
  productName: string | null;
  variant: string | null;
  packageSizeText: string | null;
  claims: string[];
  visibleText: string[];
  language: string | null;
  overallConfidence: number;
  fieldConfidence: {
    brand: number;
    subbrand: number;
    productName: number;
    variant: number;
    packageSizeText: number;
  };
};

// The AI's raw answer (schema in /api/ai/extract-ingredients-photo).
export type IngredientsAiResult = {
  rawText: string;
  ingredientsText: string;
  allergens: string[];
  language: string | null;
  confidence: number;
};

// + whole grain, derived deterministically from ingredientsText AFTER the AI
// call (src/lib/whole-grain.ts) — never asked from the model, so it can be
// recomputed later without new OCR (docs/DECISIONS.md 2026-09-23).
// Percent is 0–100 of the WHOLE product; null = unknown, never guessed.
export type IngredientsAnalysis = IngredientsAiResult & {
  wholeGrainPercent: number | null;
  isWholeGrain: boolean | null;
  wholeGrainConfidence: number;
  wholeGrainEvidence: string[];
};

export type AlternativeServing = {
  label: string;
  amount: number | null;
  unit: string | null;
  kcal: number | null;
  confidence: number;
};

// The AI's raw answer (schema in /api/ai/extract-nutrition-v2).
export type NutritionAiResult = {
  basis: "100g" | "100ml" | "portion" | "unknown";
  energyKj: number | null;
  kcalPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  saturatedFatPer100g: number | null;
  sugarsPer100g: number | null;
  fiberPer100g: number | null;
  saltPer100g: number | null;
  // Øvrige næringsstoffer fra tabellen (nøgler/enheder fra src/lib/nutrients.ts)
  // + producentens egen ± (docs/DECISIONS.md 2026-09-25). Mangler på
  // analyser fra før prompt-versionen nutrition-v2-2026-09-25-micros.
  micronutrients?: { key: string; per100g: number; tolerance: number | null }[];
  rawText: string;
  language: string | null;
  alternativeServings: AlternativeServing[];
  confidence: number;
};

// + fiberPercent, derived deterministically after the AI call: equal to
// fiberPer100g on a 100 g basis, null otherwise (100 ml needs the density).
// sugarsPer100g are "sukkerarter" from the label — NOT added sugar.
export type NutritionAnalysis = NutritionAiResult & {
  fiberPercent: number | null;
};
