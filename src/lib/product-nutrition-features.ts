// Server-only: keeps ProductNutritionFeatures — the normalized, indexed
// values the app searches/filters/scores on (sugar, fiber, salt, whole grain)
// — in sync with the evidence stored on the product (docs/DECISIONS.md
// 2026-09-23). Evidence is kept untouched: Product.nutritionExtra,
// Product.ingredientsText and the AiProductAnalysis rows. Everything here is
// recomputed from that evidence, so better parsing later needs no new OCR.
//
// RAW EVIDENCE → INTERPRETATION → NORMALIZED FIELDS. Per nutrient the best
// available source wins (SOURCE_PRIORITY: manual > explicit percent on the
// package > label/manufacturer value > external database > deterministic
// derivation > AI interpretation), and a manually verified value is never
// overwritten by an automatic run.

import type { ProductFeatureSource, ProductNutritionFeatures } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  derivePercentFromPer100g,
  inferBasisFromPackageText,
  normalizePer100,
  type NutritionBasis,
} from "@/lib/nutrition-normalize";
import { parseWholeGrain } from "@/lib/whole-grain";

const SOURCE_PRIORITY: Record<ProductFeatureSource, number> = {
  MANUAL: 6,
  PACKAGE_PERCENT: 5,
  NUTRITION_LABEL: 4,
  MANUFACTURER: 4,
  EXTERNAL_DATABASE: 3,
  DERIVED: 2,
  AI_INTERPRETATION: 1,
};

type Per100Candidate = { per100g: number; source: ProductFeatureSource; confidence: number };

type Group = "sugar" | "fiber" | "salt";

function readNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Every run recomputes from ALL current evidence and picks the best source
// (see best()), so an automatic value simply follows the evidence. The only
// thing that can never be overwritten automatically is a manual value.
function mayReplace(existingSource: ProductFeatureSource | null | undefined, next: ProductFeatureSource) {
  return existingSource !== "MANUAL" || next === "MANUAL";
}

// Picks the best candidate per nutrient from all evidence on the product.
function best(candidates: (Per100Candidate | null)[]) {
  return candidates
    .filter((c): c is Per100Candidate => c !== null)
    .sort((a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source] || b.confidence - a.confidence)[0];
}

export async function syncProductNutritionFeatures(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      name: true,
      packageSizeText: true,
      servingSizeGrams: true,
      ingredientsText: true,
      nutritionExtra: true,
      externalSource: true,
      nutritionFeatures: true,
      aiAnalyses: {
        where: { kind: { in: ["NUTRITION", "FRONT"] } },
        orderBy: { createdAt: "desc" },
        select: { kind: true, prediction: true, confidence: true },
      },
    },
  });
  if (!product) return null;

  const extra = (product.nutritionExtra ?? null) as Record<string, unknown> | null;
  const nutritionAnalysis = product.aiAnalyses.find((a) => a.kind === "NUTRITION");
  const frontAnalysis = product.aiAnalyses.find((a) => a.kind === "FRONT");
  const nutrition = (nutritionAnalysis?.prediction ?? null) as Record<string, unknown> | null;
  const front = (frontAnalysis?.prediction ?? null) as Record<string, unknown> | null;

  // Basis: the label says it; otherwise infer from the package size.
  const labelBasis = typeof nutrition?.basis === "string" ? (nutrition.basis as NutritionBasis) : null;
  const inferredBasis = inferBasisFromPackageText(product.packageSizeText, product.name);

  // Per-100 values from each evidence source.
  const fromLabel = (key: string): Per100Candidate | null => {
    if (labelBasis !== "100g" && labelBasis !== "100ml") return null;
    const value = normalizePer100(readNumber(nutrition, key));
    return value === null
      ? null
      : { per100g: value, source: "NUTRITION_LABEL", confidence: nutritionAnalysis?.confidence ?? 0.8 };
  };
  // Retailer/OFF per-100 keys (scripts/rema1000-import, src/lib/openFoodFacts.ts).
  const extraSource: ProductFeatureSource =
    product.externalSource === "OPEN_FOOD_FACTS" ? "EXTERNAL_DATABASE" : "MANUFACTURER";
  const fromExtraPer100 = (key: string): Per100Candidate | null => {
    const value = normalizePer100(readNumber(extra, key));
    return value === null ? null : { per100g: value, source: extraSource, confidence: 0.9 };
  };
  // HelloFresh stores per serving (servingSizeGrams), docs/DECISIONS.md 2026-08-29.
  const fromExtraPerServing = (key: string): Per100Candidate | null => {
    const perServing = readNumber(extra, key);
    if (perServing === null || !product.servingSizeGrams) return null;
    const value = normalizePer100((perServing / product.servingSizeGrams) * 100);
    return value === null ? null : { per100g: value, source: "DERIVED", confidence: 0.8 };
  };

  const candidates: Record<Group, Per100Candidate | undefined> = {
    sugar: best([fromLabel("sugarsPer100g"), fromExtraPer100("sugarPer100g"), fromExtraPerServing("sugarG")]),
    fiber: best([fromLabel("fiberPer100g"), fromExtraPer100("fiberPer100g"), fromExtraPerServing("fiberG")]),
    salt: best([fromLabel("saltPer100g"), fromExtraPer100("saltPer100g"), fromExtraPerServing("saltG")]),
  };
  const basis: "100g" | "100ml" =
    labelBasis === "100g" || labelBasis === "100ml" ? labelBasis : inferredBasis;

  const existing = product.nutritionFeatures;
  const data: Partial<Omit<ProductNutritionFeatures, "id" | "productId" | "createdAt" | "updatedAt">> = {};

  const applyGroup = (
    group: Group,
    per100Field: "sugarsPer100g" | "fiberPer100g" | "saltPer100g",
    percentField: "sugarPercent" | "fiberPercent" | "saltPercent"
  ) => {
    const candidate = candidates[group];
    if (!candidate) return;
    const sourceField = `${group}Source` as const;
    const confidenceField = `${group}Confidence` as const;
    if (!mayReplace(existing?.[sourceField], candidate.source)) return;
    data[per100Field] = candidate.per100g;
    // g per 100 g = mass percent; for 100 ml it stays null (needs density).
    data[percentField] = derivePercentFromPer100g(basis, candidate.per100g);
    data[sourceField] = candidate.source;
    data[confidenceField] = candidate.confidence;
    data.basis = basis;
  };
  applyGroup("sugar", "sugarsPer100g", "sugarPercent");
  applyGroup("fiber", "fiberPer100g", "fiberPercent");
  applyGroup("salt", "saltPer100g", "saltPercent");

  // Whole grain from the ingredient declaration (+ front-label claims).
  const claims = Array.isArray(front?.claims)
    ? (front.claims as unknown[]).filter((c): c is string => typeof c === "string")
    : [];
  const wholeGrain = parseWholeGrain({ ingredientsText: product.ingredientsText, claims });
  if (wholeGrain.kind !== "unknown") {
    const source: ProductFeatureSource = wholeGrain.kind === "explicit" ? "PACKAGE_PERCENT" : "DERIVED";
    if (mayReplace(existing?.wholeGrainSource, source)) {
      data.wholeGrainPercent = wholeGrain.wholeGrainPercent;
      data.isWholeGrain = wholeGrain.isWholeGrain;
      data.wholeGrainSource = source;
      data.wholeGrainConfidence = wholeGrain.confidence;
      data.wholeGrainEvidence = wholeGrain.evidence;
    }
  }

  // No evidence at all: still store an all-null row, so the product counts
  // as processed and the scheduler backfill doesn't revisit it every tick.
  if (Object.keys(data).length === 0) {
    return existing ?? prisma.productNutritionFeatures.create({ data: { productId } });
  }

  return prisma.productNutritionFeatures.upsert({
    where: { productId },
    create: { productId, ...data },
    update: data,
  });
}

// Scheduler backfill (src/lib/scheduler.ts): products that have never been
// processed — existing products after the 2026-09-23 migration and products
// written straight to the database by the REMA 1000/HelloFresh importers.
const BACKFILL_BATCH = 500;

export async function backfillMissingProductNutritionFeatures() {
  const products = await prisma.product.findMany({
    where: { nutritionFeatures: null },
    take: BACKFILL_BATCH,
    select: { id: true },
  });
  for (const product of products) await syncProductNutritionFeaturesSafely(product.id);
  return products.length;
}

// Never lets feature bookkeeping break the caller (product creation, import,
// admin edit) — the features can always be recomputed later.
export async function syncProductNutritionFeaturesSafely(productId: string) {
  try {
    await syncProductNutritionFeatures(productId);
  } catch (error) {
    console.error("ProductNutritionFeatures sync failed", productId, error);
  }
}
