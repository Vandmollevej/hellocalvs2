import { prisma } from "@/lib/prisma";
import { MACRO_SOURCE_KEYS, labelNutrientsFromPrediction } from "@/lib/nutrients";

// Usikkerheds-~ (docs/DECISIONS.md 2026-09-25): hvor et nyt produkts
// næringstal kommer fra. Fejl må aldrig stoppe selve produktoprettelsen.
export async function recordNutrientSources(productId: string, nutritionAnalysisId: string | null) {
  try {
    const analysis = nutritionAnalysisId
      ? await prisma.aiProductAnalysis.findUnique({
          where: { id: nutritionAnalysisId },
          select: { kind: true, prediction: true },
        })
      : null;
    const macroSource = analysis?.kind === "NUTRITION" ? "LABEL" : "ESTIMATED";
    const sources: Record<string, string> = Object.fromEntries(MACRO_SOURCE_KEYS.map((key) => [key, macroSource]));
    const { micronutrientsPer100g, nutrientTolerances } =
      analysis?.kind === "NUTRITION" ? labelNutrientsFromPrediction(analysis.prediction) : { micronutrientsPer100g: {}, nutrientTolerances: {} };
    for (const key of Object.keys(micronutrientsPer100g)) sources[key] = "LABEL";
    await prisma.product.update({
      where: { id: productId },
      data: {
        nutrientSources: sources,
        ...(Object.keys(micronutrientsPer100g).length ? { micronutrientsPer100g } : {}),
        ...(Object.keys(nutrientTolerances).length ? { nutrientTolerances } : {}),
      },
    });
  } catch (error) {
    console.error("Recording nutrient sources failed", error);
  }
}
