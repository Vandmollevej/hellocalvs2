import { readFile } from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readRegions } from "@/lib/ai-regions";
import { buildBarcodeContext } from "@/lib/barcode-context";
import { callStructuredVision } from "@/lib/product-ai";
import {
  FRONT_PROMPT_VERSION,
  FRONT_SCHEMA,
  FRONT_SYSTEM,
  INGREDIENTS_PROMPT_VERSION,
  INGREDIENTS_SCHEMA,
  INGREDIENTS_SYSTEM,
  NUTRITION_PROMPT_VERSION,
  NUTRITION_SCHEMA,
  NUTRITION_SYSTEM,
  frontText,
  ingredientsText,
  nutritionText,
} from "@/lib/product-ai-tasks";
import { labelNutrientsFromPrediction, asNumberRecord } from "@/lib/nutrients";
import { applyAnalysisValues } from "@/lib/uncertainty-corrections";
import { UNCERTAINTY_TARGET } from "@/lib/uncertainty-thresholds";

// Natlig AI-genkørsel for admin "Uncertainties" (job "uncertainty-rerun",
// docs/DECISIONS.md 2026-09-25): kører samme aflæsning igen på de gemte
// fotos for åbne analyser under 90 %. Et mere sikkert svar erstatter det
// gamle; når det når målet, skrives værdierne til produktet (som ved
// oprettelsen), og rækken forsvinder fra listen. EAN har intet AI-kald og
// genkøres ikke. Højst MAX_PER_RUN pr. kørsel for at begrænse AI-udgiften.

const MAX_PER_RUN = 100;

const MIME_BY_EXT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

// Gemte fotos ligger under public/ (fx /product-images/qc-uploads/...).
async function loadPhoto(url: string | null): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (!url.startsWith("/")) return null;
  const file = path.join(process.cwd(), "public", path.normalize(url).replace(/^([/\\])+/, ""));
  if (!file.startsWith(path.join(process.cwd(), "public"))) return null;
  const mime = MIME_BY_EXT[path.extname(file).toLowerCase()];
  if (!mime) return null;
  const buffer = await readFile(file).catch(() => null);
  return buffer ? `data:${mime};base64,${buffer.toString("base64")}` : null;
}

function valuesFromPrediction(kind: string, prediction: Record<string, unknown>): Record<string, unknown> {
  if (kind === "FRONT") {
    return {
      productName: prediction.productName,
      subbrand: prediction.subbrand,
      variant: prediction.variant,
      packageSizeText: prediction.packageSizeText,
    };
  }
  if (kind === "INGREDIENTS") return { ingredientsText: prediction.ingredientsText };
  return prediction;
}

export async function rerunUncertainAnalyses(): Promise<string> {
  const analyses = await prisma.aiProductAnalysis.findMany({
    where: {
      productId: { not: null },
      reviewedAt: null,
      kind: { in: ["FRONT", "NUTRITION", "INGREDIENTS"] },
      confidence: { lt: UNCERTAINTY_TARGET },
    },
    orderBy: { confidence: "asc" },
    take: MAX_PER_RUN,
    include: {
      product: {
        select: {
          id: true,
          imageUrl: true,
          productType: true,
          micronutrientsPer100g: true,
          nutrientSources: true,
          nutrientTolerances: true,
          barcodes: { select: { code: true }, take: 1 },
        },
      },
    },
  });

  let tried = 0;
  let improved = 0;
  let resolved = 0;
  let failed = 0;
  let knownBrands: string[] | null = null;

  for (const analysis of analyses) {
    const product = analysis.product;
    if (!product) continue;
    const photo = await loadPhoto(analysis.kind === "FRONT" ? product.imageUrl : analysis.imageUrl);
    if (!photo) continue;
    const barcode = analysis.barcode ?? product.barcodes[0]?.code ?? "";
    const context = buildBarcodeContext(barcode, analysis.marketRegion ?? "DK");
    tried += 1;

    try {
      let prediction: Record<string, unknown>;
      let confidence: number;
      let promptVersion: string;
      let model: string;
      if (analysis.kind === "FRONT") {
        knownBrands ??= (await prisma.brand.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 750 })).map(
          (b) => b.name,
        );
        const result = await callStructuredVision<Record<string, unknown>>({
          photo,
          schemaName: "hello_cal_product_front",
          schema: FRONT_SCHEMA,
          system: FRONT_SYSTEM,
          text: frontText({ barcode, context, knownBrands }),
        });
        prediction = result.value;
        confidence = Number(result.value.overallConfidence);
        promptVersion = FRONT_PROMPT_VERSION;
        model = result.model;
      } else if (analysis.kind === "NUTRITION") {
        const result = await callStructuredVision<Record<string, unknown>>({
          photo,
          schemaName: "hello_cal_nutrition",
          schema: NUTRITION_SCHEMA,
          system: NUTRITION_SYSTEM,
          text: nutritionText({ barcode, context }),
        });
        prediction = result.value;
        confidence = Number(result.value.confidence);
        promptVersion = NUTRITION_PROMPT_VERSION;
        model = result.model;
      } else {
        const result = await callStructuredVision<Record<string, unknown>>({
          photo,
          schemaName: "hello_cal_ingredients",
          schema: INGREDIENTS_SCHEMA,
          system: INGREDIENTS_SYSTEM,
          text: ingredientsText({ barcode, context }),
        });
        prediction = result.value;
        confidence = Number(result.value.confidence);
        promptVersion = INGREDIENTS_PROMPT_VERSION;
        model = result.model;
      }

      if (!Number.isFinite(confidence) || confidence <= (analysis.confidence ?? 0)) continue;
      improved += 1;

      await prisma.$transaction(async (tx) => {
        await tx.aiProductAnalysis.update({
          where: { id: analysis.id },
          data: {
            prediction: prediction as Prisma.InputJsonValue,
            confidence,
            regions: readRegions(prediction) as unknown as Prisma.InputJsonValue,
            model,
            promptVersion,
          },
        });
        if (confidence < UNCERTAINTY_TARGET) return;
        await applyAnalysisValues(tx, analysis, product, valuesFromPrediction(analysis.kind, prediction));
        if (analysis.kind === "NUTRITION") {
          const { micronutrientsPer100g, nutrientTolerances } = labelNutrientsFromPrediction(prediction);
          if (Object.keys(micronutrientsPer100g).length) {
            const sources = { ...(product.nutrientSources as Record<string, string> | null) };
            for (const key of Object.keys(micronutrientsPer100g)) sources[key] = "LABEL";
            await tx.product.update({
              where: { id: product.id },
              data: {
                micronutrientsPer100g: { ...asNumberRecord(product.micronutrientsPer100g), ...micronutrientsPer100g },
                nutrientTolerances: { ...asNumberRecord(product.nutrientTolerances), ...nutrientTolerances },
                nutrientSources: sources,
              },
            });
          }
        }
      });
      if (confidence >= UNCERTAINTY_TARGET) resolved += 1;
    } catch (error) {
      failed += 1;
      console.error("[uncertainty-rerun] analyse fejlede", analysis.id, error);
    }
  }

  return `${analyses.length} åbne, ${tried} genkørt, ${improved} forbedret, ${resolved} nu over ${Math.round(
    UNCERTAINTY_TARGET * 100,
  )} %, ${failed} fejl`;
}
