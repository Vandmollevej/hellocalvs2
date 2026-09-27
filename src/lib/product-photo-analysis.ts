import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import {
  FRONT_PROMPT_VERSION,
  FRONT_SCHEMA,
  FRONT_SYSTEM,
  frontText,
  INGREDIENTS_PROMPT_VERSION,
  INGREDIENTS_SCHEMA,
  INGREDIENTS_SYSTEM,
  NUTRITION_PROMPT_VERSION,
  NUTRITION_SCHEMA,
  NUTRITION_SYSTEM,
  ingredientsText,
  nutritionText,
} from "@/lib/product-ai-tasks";
import { saveDataUrlImage } from "@/lib/qc-image-storage";
import { matchBrand, type BrandMatch } from "@/lib/brand-match";
import { createFrontCutoutJobs } from "@/lib/image-cutout-jobs";
import { deriveFiberPercent } from "@/lib/nutrition-normalize";
import { parseWholeGrain } from "@/lib/whole-grain";
import type {
  IngredientsAiResult,
  IngredientsAnalysis,
  NutritionAiResult,
  NutritionAnalysis,
  ProductFrontAnalysis,
} from "@/lib/product-analysis-types";

// De tre OpenAI-aflæsninger af det guidede produktflow (forside, næring,
// ingredienser). Bruges både af /api/ai/*-ruterne og af baggrunds-
// udfyldningen efter "opret straks" (src/lib/quick-product-enrichment.ts,
// docs/DECISIONS.md 2026-09-27). Hver aflæsning gemmer fotoet og en
// AiProductAnalysis-række (prediction) og kaster ved AI-fejl.

export type PhotoAnalysisInput = {
  photo: string;
  barcode: string;
  marketRegion: string;
  ocrText?: string;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// Modellen kan returnere bokse der stikker ud af billedet eller er tomme —
// klip til 0-1 og kassér bokse uden areal.
function cleanBox(box: ProductFrontAnalysis["logoBox"]) {
  if (!box) return null;
  const x = clamp01(box.x);
  const y = clamp01(box.y);
  const width = clamp01(Math.min(box.width, 1 - x));
  const height = clamp01(Math.min(box.height, 1 - y));
  return width > 0.01 && height > 0.01 ? { x, y, width, height } : null;
}

export async function analyzeFrontPhoto({ photo, barcode, marketRegion }: PhotoAnalysisInput): Promise<{
  analysisId: string;
  result: ProductFrontAnalysis;
  brandMatch: BrandMatch | null;
}> {
  const context = buildBarcodeContext(barcode, marketRegion);
  const knownBrands = await prisma.brand.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const { value: aiValue, model } = await callStructuredVision<ProductFrontAnalysis>({
    photo,
    schemaName: "hello_cal_product_front",
    schema: FRONT_SCHEMA,
    // Samme prompt som den natlige genkørsel (src/lib/product-ai-tasks.ts).
    system: FRONT_SYSTEM,
    text: frontText({ barcode, context, knownBrands: knownBrands.slice(0, 750).map((item) => item.name) }),
  });

  const value: ProductFrontAnalysis = {
    ...aiValue,
    logoBox: cleanBox(aiValue.logoBox),
    productBox: cleanBox(aiValue.productBox),
  };

  // Logonavnet holdes op mod Brand-tabellen; et match giver databasens
  // stavemåde, så produktet kobles til det eksisterende brand i stedet for
  // at oprette en næsten-dublet (docs/DECISIONS.md 2026-09-26).
  const brandMatch = matchBrand(value.logoText ?? value.brand, knownBrands);

  // Fotoet gemmes, så image-agenten kan fritskrabe logo og produkt.
  // Fejl her må aldrig stoppe selve forsideanalysen.
  const imageUrl = await saveDataUrlImage(photo).catch(() => null);

  const analysis = await prisma.aiProductAnalysis.create({
    data: {
      kind: "FRONT",
      barcode,
      marketRegion: context.marketRegion,
      gs1Regions: context.gs1Regions,
      languages: context.primaryOcrLanguages,
      model,
      promptVersion: FRONT_PROMPT_VERSION,
      prediction: { ...value, brandMatch } as unknown as Prisma.InputJsonValue,
      confidence: value.overallConfidence,
      imageUrl,
      regions: readRegions(value) as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  if (imageUrl) {
    await createFrontCutoutJobs({ analysisId: analysis.id, sourceUrl: imageUrl, front: value, brandMatch }).catch(
      (error) => console.error("Could not queue cutout jobs", error),
    );
  }

  return { analysisId: analysis.id, result: value, brandMatch };
}

export async function analyzeNutritionPhoto({ photo, barcode, marketRegion, ocrText = "" }: PhotoAnalysisInput): Promise<{
  analysisId: string;
  result: NutritionAnalysis;
}> {
  const context = buildBarcodeContext(barcode, marketRegion);
  const { value: aiValue, model } = await callStructuredVision<NutritionAiResult>({
    photo,
    schemaName: "hello_cal_nutrition",
    schema: NUTRITION_SCHEMA,
    system: NUTRITION_SYSTEM,
    text: nutritionText({ barcode, context, ocrText }),
  });
  // fiberPercent beregnes deterministisk, modellen bliver aldrig spurgt om
  // det (docs/DECISIONS.md 2026-09-23).
  const value: NutritionAnalysis = {
    ...aiValue,
    fiberPercent: deriveFiberPercent(aiValue.basis, aiValue.fiberPer100g),
  };

  // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): gemmer
  // selve fotoet, så den lokale billedanalyse-agent kan sammenligne det mod
  // produktets forsidefoto. Fejl her må aldrig stoppe selve næringsaflæsningen.
  const imageUrl = await saveDataUrlImage(photo).catch(() => null);

  const analysis = await prisma.aiProductAnalysis.create({
    data: {
      kind: "NUTRITION",
      barcode,
      marketRegion: context.marketRegion,
      gs1Regions: context.gs1Regions,
      languages: context.primaryOcrLanguages,
      model,
      promptVersion: NUTRITION_PROMPT_VERSION,
      prediction: value as unknown as Prisma.InputJsonValue,
      confidence: value.confidence,
      regions: readRegions(value) as unknown as Prisma.InputJsonValue,
      imageUrl,
    },
    select: { id: true },
  });

  return { analysisId: analysis.id, result: value };
}

export async function analyzeIngredientsPhoto({ photo, barcode, marketRegion, ocrText = "" }: PhotoAnalysisInput): Promise<{
  analysisId: string;
  result: IngredientsAnalysis;
}> {
  const context = buildBarcodeContext(barcode, marketRegion);
  const { value: aiValue, model } = await callStructuredVision<IngredientsAiResult>({
    photo,
    schemaName: "hello_cal_ingredients",
    schema: INGREDIENTS_SCHEMA,
    system: INGREDIENTS_SYSTEM,
    text: ingredientsText({ barcode, context, ocrText }),
  });
  // Fuldkorn udledes deterministisk af selve varedeklarationen, ikke af
  // modellen (src/lib/whole-grain.ts, docs/DECISIONS.md 2026-09-23).
  const wholeGrain = parseWholeGrain({ ingredientsText: aiValue.ingredientsText || aiValue.rawText });
  const value: IngredientsAnalysis = {
    ...aiValue,
    wholeGrainPercent: wholeGrain.wholeGrainPercent,
    isWholeGrain: wholeGrain.isWholeGrain,
    wholeGrainConfidence: wholeGrain.confidence,
    wholeGrainEvidence: wholeGrain.evidence,
  };

  // Kvalitetskontrol/billed-match (docs/DECISIONS.md 2026-09-19): gemmer
  // selve fotoet, så den lokale billedanalyse-agent kan sammenligne det mod
  // produktets forsidefoto. Fejl her må aldrig stoppe selve ingrediens-aflæsningen.
  const imageUrl = await saveDataUrlImage(photo).catch(() => null);

  const analysis = await prisma.aiProductAnalysis.create({
    data: {
      kind: "INGREDIENTS",
      barcode,
      marketRegion: context.marketRegion,
      gs1Regions: context.gs1Regions,
      languages: context.primaryOcrLanguages,
      model,
      promptVersion: INGREDIENTS_PROMPT_VERSION,
      prediction: value as unknown as Prisma.InputJsonValue,
      confidence: value.confidence,
      regions: readRegions(value) as unknown as Prisma.InputJsonValue,
      imageUrl,
    },
    select: { id: true },
  });

  return { analysisId: analysis.id, result: value };
}
