export type AnalysisIds = {
  front?: string;
  ingredients?: string;
  nutrition?: string;
};

export type ProductFrontAnalysis = {
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

export type IngredientsAnalysis = {
  rawText: string;
  ingredientsText: string;
  allergens: string[];
  language: string | null;
  confidence: number;
};

export type AlternativeServing = {
  label: string;
  amount: number | null;
  unit: string | null;
  kcal: number | null;
  confidence: number;
};

export type NutritionAnalysis = {
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
  rawText: string;
  language: string | null;
  alternativeServings: AlternativeServing[];
  confidence: number;
};
