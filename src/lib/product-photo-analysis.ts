import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import {
  BARCODE_LOGO_PROMPT_VERSION,
  BARCODE_LOGO_SCHEMA,
  BARCODE_LOGO_SYSTEM,
  barcodeLogoText,
  FRONT_PROMPT_VERSION,
  FRONT_SCHEMA,
  FRONT_SYSTEM,
  frontText,
  INGREDIENTS_PROMPT_VERSION,
  INGREDIENTS_SCHEMA,
  INGREDIENTS_SYSTEM,
  LABEL_PROMPT_VERSION,
  LABEL_SCHEMA,
  LABEL_SYSTEM,
  labelText,
  NUTRITION_PROMPT_VERSION,
  NUTRITION_SCHEMA,
  NUTRITION_SYSTEM,
  ingredientsText,
  nutritionText,
} from "@/lib/product-ai-tasks";
import { LOCAL_OCR_MODEL, LOCAL_OCR_PROMPT_VERSION } from "@/lib/local-label";
import { readStoredImageAsDataUrl, saveDataUrlImage } from "@/lib/qc-image-storage";
import { matchBrand, matchBrandInTexts, type BrandMatch } from "@/lib/brand-match";
import { createFrontCutoutJobs } from "@/lib/image-cutout-jobs";
import { deriveFiberPercent } from "@/lib/nutrition-normalize";
import { parseWholeGrain } from "@/lib/whole-grain";
import type {
  BarcodeLogoAnalysis,
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
  // Telefonens land/sprog og appens sprog (src/lib/language-signals.ts),
  // valideres i buildBarcodeContext.
  signals?: unknown;
  // Fotoet er allerede gemt (fx ved "opret straks", så en afbrudt aflæsning
  // kan genoptages) — genbruges i stedet for at gemme en kopi.
  storedImageUrl?: string | null;
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

export async function analyzeFrontPhoto({ photo, barcode, marketRegion, signals, storedImageUrl }: PhotoAnalysisInput): Promise<{
  analysisId: string;
  result: ProductFrontAnalysis;
  brandMatch: BrandMatch | null;
  // Et kendt brand, der står ordret i forsidens øvrige tekst (subbrand,
  // synlig tekst, claims) — bruges, når AI'ens brand ikke findes i databasen.
  textBrandMatch: BrandMatch | null;
}> {
  const context = buildBarcodeContext(barcode, marketRegion, signals);
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
  const textBrandMatch = brandMatch
    ? null
    : matchBrandInTexts([value.brand, value.subbrand, value.logoText, ...value.visibleText, ...value.claims], knownBrands);

  // Fotoet gemmes, så image-agenten kan fritskrabe logo og produkt.
  // Fejl her må aldrig stoppe selve forsideanalysen.
  const imageUrl = storedImageUrl ?? (await saveDataUrlImage(photo).catch(() => null));

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

  return { analysisId: analysis.id, result: value, brandMatch, textBrandMatch };
}

// Stregkode-fotoet (gemt af POST /api/ai/save-barcode-photo) læses for logo
// og variant, fordi logoet ikke altid står på forsiden (docs/DECISIONS.md
// 2026-09-28). Resultatet lægges i BARCODE-rækkens prediction ved siden af
// stregkoden. Returnerer null, hvis rækken eller fotoet mangler.
export async function analyzeBarcodePhotoLogo({
  analysisId,
  barcode,
  marketRegion,
  signals,
}: {
  analysisId: string;
  barcode: string;
  marketRegion: string;
  signals?: unknown;
}): Promise<{ imageUrl: string; result: BarcodeLogoAnalysis; brandMatch: BrandMatch | null } | null> {
  const row = await prisma.aiProductAnalysis.findFirst({
    where: { id: analysisId, kind: "BARCODE" },
    select: { imageUrl: true, prediction: true },
  });
  const photo = row?.imageUrl ? await readStoredImageAsDataUrl(row.imageUrl) : null;
  if (!row?.imageUrl || !photo) return null;

  const context = buildBarcodeContext(barcode, marketRegion, signals);
  const knownBrands = await prisma.brand.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const { value, model } = await callStructuredVision<BarcodeLogoAnalysis>({
    photo,
    schemaName: "hello_cal_barcode_logo",
    schema: BARCODE_LOGO_SCHEMA,
    system: BARCODE_LOGO_SYSTEM,
    text: barcodeLogoText({ barcode, context, knownBrands: knownBrands.slice(0, 750).map((item) => item.name) }),
  });
  const result: BarcodeLogoAnalysis = { ...value, logoBox: cleanBox(value.logoBox) };
  const brandMatch = matchBrand(result.logoText, knownBrands);

  const previous = row.prediction && typeof row.prediction === "object" && !Array.isArray(row.prediction) ? row.prediction : {};
  await prisma.aiProductAnalysis.update({
    where: { id: analysisId },
    data: {
      prediction: {
        ...previous,
        logo: { ...result, brandMatch, model, promptVersion: BARCODE_LOGO_PROMPT_VERSION },
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return { imageUrl: row.imageUrl, result, brandMatch };
}

export async function analyzeNutritionPhoto({ photo, barcode, marketRegion, ocrText = "", signals, storedImageUrl }: PhotoAnalysisInput): Promise<{
  analysisId: string;
  result: NutritionAnalysis;
}> {
  const context = buildBarcodeContext(barcode, marketRegion, signals);
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
  const imageUrl = storedImageUrl ?? (await saveDataUrlImage(photo).catch(() => null));

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

export async function analyzeIngredientsPhoto({ photo, barcode, marketRegion, ocrText = "", signals, storedImageUrl }: PhotoAnalysisInput): Promise<{
  analysisId: string;
  result: IngredientsAnalysis;
}> {
  const context = buildBarcodeContext(barcode, marketRegion, signals);
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
  const imageUrl = storedImageUrl ?? (await saveDataUrlImage(photo).catch(() => null));

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

// Energi + indhold fra ét foto i ét kald (brugerens valg 2026-09-27: "lokal
// først + ét samlet kald"). Bruges, når telefonens OCR ikke kunne læse
// næringen, og ingredienslisten står på samme foto. Giver to rækker
// (NUTRITION + INGREDIENTS), så prediction/correction virker som før.
export async function analyzeLabelPhoto({ photo, barcode, marketRegion, ocrText = "", signals, storedImageUrl }: PhotoAnalysisInput): Promise<{
  nutrition: { analysisId: string; result: NutritionAnalysis };
  ingredients: { analysisId: string; result: IngredientsAnalysis };
}> {
  const context = buildBarcodeContext(barcode, marketRegion, signals);
  const { value: aiValue, model } = await callStructuredVision<{
    nutrition: NutritionAiResult;
    ingredients: IngredientsAiResult;
  }>({
    photo,
    schemaName: "hello_cal_label",
    schema: LABEL_SCHEMA,
    system: LABEL_SYSTEM,
    text: labelText({ barcode, context, ocrText }),
  });
  const nutrition: NutritionAnalysis = {
    ...aiValue.nutrition,
    fiberPercent: deriveFiberPercent(aiValue.nutrition.basis, aiValue.nutrition.fiberPer100g),
  };
  const wholeGrain = parseWholeGrain({
    ingredientsText: aiValue.ingredients.ingredientsText || aiValue.ingredients.rawText,
  });
  const ingredients: IngredientsAnalysis = {
    ...aiValue.ingredients,
    wholeGrainPercent: wholeGrain.wholeGrainPercent,
    isWholeGrain: wholeGrain.isWholeGrain,
    wholeGrainConfidence: wholeGrain.confidence,
    wholeGrainEvidence: wholeGrain.evidence,
  };
  const regions = readRegions(aiValue) as unknown as Prisma.InputJsonValue;
  const imageUrl = storedImageUrl ?? (await saveDataUrlImage(photo).catch(() => null));
  const common = {
    barcode,
    marketRegion: context.marketRegion,
    gs1Regions: context.gs1Regions,
    languages: context.primaryOcrLanguages,
    model,
    promptVersion: LABEL_PROMPT_VERSION,
    regions,
    imageUrl,
  };
  const [nutritionRow, ingredientsRow] = await Promise.all([
    prisma.aiProductAnalysis.create({
      data: { ...common, kind: "NUTRITION", prediction: nutrition as unknown as Prisma.InputJsonValue, confidence: nutrition.confidence },
      select: { id: true },
    }),
    prisma.aiProductAnalysis.create({
      data: { ...common, kind: "INGREDIENTS", prediction: ingredients as unknown as Prisma.InputJsonValue, confidence: ingredients.confidence },
      select: { id: true },
    }),
  ]);
  return {
    nutrition: { analysisId: nutritionRow.id, result: nutrition },
    ingredients: { analysisId: ingredientsRow.id, result: ingredients },
  };
}

// Telefonens egen aflæsning gemmes som en AiProductAnalysis-række med model
// "local-tesseract", så også lokalt læste varer giver prediction/correction-
// træningsdata og kvalitetskontrollen har fotoet.
export async function recordLocalAnalysis({
  kind,
  photo,
  barcode,
  marketRegion,
  signals,
  prediction,
  storedImageUrl,
}: {
  kind: "NUTRITION" | "INGREDIENTS";
  photo: string;
  barcode: string;
  marketRegion: string;
  signals?: unknown;
  prediction: NutritionAnalysis | IngredientsAnalysis;
  storedImageUrl?: string | null;
}): Promise<{ analysisId: string }> {
  const context = buildBarcodeContext(barcode, marketRegion, signals);
  const imageUrl = storedImageUrl ?? (await saveDataUrlImage(photo).catch(() => null));
  const row = await prisma.aiProductAnalysis.create({
    data: {
      kind,
      barcode,
      marketRegion: context.marketRegion,
      gs1Regions: context.gs1Regions,
      languages: context.primaryOcrLanguages,
      model: LOCAL_OCR_MODEL,
      promptVersion: LOCAL_OCR_PROMPT_VERSION,
      prediction: prediction as unknown as Prisma.InputJsonValue,
      confidence: prediction.confidence,
      imageUrl,
    },
    select: { id: true },
  });
  return { analysisId: row.id };
}
