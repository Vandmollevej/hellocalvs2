import { prisma } from "@/lib/prisma";
import { callStructuredText } from "@/lib/product-ai";
import { MACRO_SOURCE_KEYS } from "@/lib/nutrients";
import { debugLog, errorText } from "@/lib/debug-log";

// Sidste udvej for en ny, scannet vare uden aflæst næringstabel, når Frida
// heller ikke kender varetypen (brugerens krav 2026-10-16: energien skal
// afledes af varetypen, også når energitabellen blev misset). Et typisk
// næringsindhold for varetypen skønnes ud fra navn, brand og variant. Tallene
// får kilden ESTIMATED (∼ i appen), indtil varen opdateres med et foto af
// næringstabellen eller en admin retter dem.

const SCHEMA = {
  type: "object",
  properties: {
    kcalPer100g: { type: "number" },
    proteinPer100g: { type: "number" },
    carbsPer100g: { type: "number" },
    fatPer100g: { type: "number" },
    confidence: { type: "number" },
  },
  required: ["kcalPer100g", "proteinPer100g", "carbsPer100g", "fatPer100g", "confidence"],
  additionalProperties: false,
};

const SYSTEM = [
  "Du skønner det typiske næringsindhold pr. 100 g (drikke: pr. 100 ml) for en dagligvare for Hello Cal, ud fra varetypen, brandet og varianten.",
  "Brug typiske værdier for netop den varetype og variant (fx letmælk 0,5 % fedt: ca. 35 kcal, 3,5 g protein, 4,7 g kulhydrat, 0,5 g fedt).",
  "confidence = 0-1, hvor sikker du er på, at skønnet passer til varen. Kender du ikke varetypen, så sæt confidence lavt.",
].join(" ");

const MIN_CONFIDENCE = 0.6;

const clean = (value: number, max: number) =>
  Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value * 10) / 10 : null;

export async function estimateNutritionFromType(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      productType: true,
      variant: true,
      kcalPer100g: true,
      nutritionMissing: true,
      nutrientSources: true,
      brand: { select: { name: true } },
    },
  });
  const type = product?.productType?.trim() || product?.name.trim();
  if (!product || !product.nutritionMissing || product.kcalPer100g > 0 || !type) return false;
  try {
    const { value } = await callStructuredText<{
      kcalPer100g: number;
      proteinPer100g: number;
      carbsPer100g: number;
      fatPer100g: number;
      confidence: number;
    }>({
      system: SYSTEM,
      text: [
        `Vare: ${type}`,
        product.brand?.name ? `Brand: ${product.brand.name}` : "",
        product.variant ? `Variant: ${product.variant}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      schemaName: "hello_cal_type_nutrition_estimate",
      schema: SCHEMA,
    });
    const kcal = clean(value.kcalPer100g, 900);
    const protein = clean(value.proteinPer100g, 100);
    const carbs = clean(value.carbsPer100g, 100);
    const fat = clean(value.fatPer100g, 100);
    if (value.confidence < MIN_CONFIDENCE || !kcal || protein === null || carbs === null || fat === null) {
      await debugLog({
        category: "scan",
        event: "type_nutrition_estimate",
        level: "warn",
        message: `Intet sikkert næringsskøn for "${type}" (sikkerhed ${value.confidence}) — energien står som ukendt`,
        productId,
        data: { type, value },
      });
      return false;
    }
    const sources = { ...((product.nutrientSources as Record<string, string> | null) ?? {}) };
    for (const key of MACRO_SOURCE_KEYS) sources[key] = "ESTIMATED";
    // Kun hvis varen stadig mangler næring (en aflæsning kan være nået frem imens).
    const updated = await prisma.product.updateMany({
      where: { id: productId, nutritionMissing: true, kcalPer100g: 0 },
      data: {
        kcalPer100g: kcal,
        proteinPer100g: protein,
        carbsPer100g: carbs,
        fatPer100g: fat,
        nutrientSources: sources,
        nutritionMissing: false,
      },
    });
    if (!updated.count) return false;
    await debugLog({
      category: "scan",
      event: "type_nutrition_estimate",
      message: `Ingen næringstabel læst: ${kcal} kcal/100 skønnet ud fra varetypen "${type}" (∼)`,
      productId,
      data: { type, kcal, protein, carbs, fat, confidence: value.confidence },
    });
    return true;
  } catch (error) {
    console.error("[type-nutrition-estimate] skøn fejlede", productId, errorText(error));
    return false;
  }
}
