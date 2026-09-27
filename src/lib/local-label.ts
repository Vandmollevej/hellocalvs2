import { deriveFiberPercent } from "@/lib/nutrition-normalize";
import { findIngredientsSection, parseNutritionDetailed, parseNutritionText } from "@/lib/product-ocr";
import { parseWholeGrain } from "@/lib/whole-grain";
import type { IngredientsAnalysis, NutritionAnalysis } from "@/lib/product-analysis-types";

// "Lokal først, ChatGPT kun ved tvivl" (brugerens valg 2026-09-27). Serveren
// afgør ud fra telefonens egen OCR-tekst, hvad der kan bruges uden AI —
// aldrig ud fra tal, klienten selv har regnet, så intet kan snydes ind.
//
// Næring bruges lokalt, når alle fire hovedtal findes og hænger sammen
// (parseNutritionText). Ingredienslisten bruges lokalt, når der er en
// tydelig "Ingredienser:"-sektion OG OCR-sikkerheden er høj: der findes intet
// tjek, der fanger en fejlstavet ingrediens, og den styrer fx fuldkorn.

export const LOCAL_OCR_MODEL = "local-tesseract";
export const LOCAL_OCR_PROMPT_VERSION = "local-ocr-v1-2026-09-27";
export const LOCAL_INGREDIENTS_MIN_OCR_CONFIDENCE = 85;

export function localNutrition(ocrText: string, ocrConfidence: number): NutritionAnalysis | null {
  if (!ocrText || !parseNutritionText(ocrText)) return null;
  const { values, basis, corrected } = parseNutritionDetailed(ocrText);
  const nutrition: NutritionAnalysis & { localOcr: { corrected: string[]; ocrConfidence: number } } = {
    basis,
    energyKj: values.energyKj ?? null,
    kcalPer100g: values.kcalPer100g ?? null,
    proteinPer100g: values.proteinPer100g ?? null,
    carbsPer100g: values.carbsPer100g ?? null,
    fatPer100g: values.fatPer100g ?? null,
    saturatedFatPer100g: values.saturatedFatPer100g ?? null,
    sugarsPer100g: values.sugarsPer100g ?? null,
    fiberPer100g: values.fiberPer100g ?? null,
    saltPer100g: values.saltPer100g ?? null,
    micronutrients: [],
    rawText: ocrText,
    language: null,
    alternativeServings: [],
    confidence: Math.min(1, Math.max(0, ocrConfidence / 100)),
    fiberPercent: deriveFiberPercent(basis, values.fiberPer100g ?? null),
    localOcr: { corrected, ocrConfidence },
  };
  return nutrition;
}

export function localIngredients(ocrText: string, ocrConfidence: number): IngredientsAnalysis | null {
  if (!ocrText || ocrConfidence < LOCAL_INGREDIENTS_MIN_OCR_CONFIDENCE) return null;
  const section = findIngredientsSection(ocrText);
  if (!section) return null;
  const wholeGrain = parseWholeGrain({ ingredientsText: section });
  return {
    rawText: section,
    ingredientsText: section,
    allergens: [],
    language: null,
    confidence: Math.min(1, Math.max(0, ocrConfidence / 100)),
    wholeGrainPercent: wholeGrain.wholeGrainPercent,
    isWholeGrain: wholeGrain.isWholeGrain,
    wholeGrainConfidence: wholeGrain.confidence,
    wholeGrainEvidence: wholeGrain.evidence,
  };
}
