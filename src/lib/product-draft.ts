import type { AlternativeServing, AnalysisIds } from "@/lib/product-analysis-types";

// Delt sessionStorage-cache mellem det guidede kamera-auto-flow
// (/camera/create) og opret-produkt-siden (/product/create) — alt brugeren har
// fotograferet og fået genkendt undervejs, så opret-siden kan prælægges uden
// et nyt kamera-kald.
export const PRODUCT_DRAFT_STORAGE_KEY = "hellocal-product-create-draft";

export type ProductCreateDraft = {
  brand?: string;
  subbrand?: string;
  name?: string;
  variant?: string;
  packageSizeText?: string;

  kcalPer100g?: string;
  proteinPer100g?: string;
  carbsPer100g?: string;
  fatPer100g?: string;
  servingSizeGrams?: string;
  ingredientsText?: string;

  // Alternative kalorievisninger fra selve emballagen (per glas/skive/stk.
  // osv.), udtrukket af /api/ai/extract-nutrition-v2 — se
  // docs/DECISIONS.md 2026-09-19.
  alternativeServings?: AlternativeServing[];

  barcodeValue?: string;
  barcodeImage?: string;
  nutritionImage?: string;
  ingredientsImage?: string;
  mainImage?: string;
  sideImages: [string?, string?, string?];

  // Sat ved barcode-scanning (jf. barcode-context.ts) og fastfrosset for
  // resten af flowet — senere fotos må ikke ændre markedsregion/GS1-signalet.
  marketRegion?: string;
  gs1Prefix3?: string;
  gs1Regions?: string[];
  primaryOcrLanguages?: string[];
  analysisIds?: AnalysisIds;
};
