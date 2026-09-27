import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { analyzeFrontPhoto, analyzeIngredientsPhoto, analyzeNutritionPhoto } from "@/lib/product-photo-analysis";
import { linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import { cleanAlternativeServings } from "@/lib/alternative-servings";
import { flagUncertainAlternativeServings } from "@/lib/alternative-servings-review";
import { flagSimultaneousDuplicates } from "@/lib/product-duplicates";
import { recordNutrientSources } from "@/lib/product-nutrient-sources";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";

// "Opret straks" (docs/DECISIONS.md 2026-09-27): kameraflowet opretter varen,
// så snart den lokale OCR er kørt, og sender brugeren videre til /add/[id].
// Her udfyldes resten bagefter med OpenAI — forside (navn/brand/subbrand),
// næring og ingredienser kører parallelt, og hvert felt fjernes fra
// Product.pendingFields, så snart det er aflæst (eller aflæsningen fejlede).

export type PendingField = "name" | "brand" | "nutrition" | "ingredients";

export type QuickEnrichmentInput = {
  productId: string;
  barcode: string;
  marketRegion: string;
  frontPhoto: string;
  nutritionPhoto: string;
  // Udeladt, når ingredienslisten stod på næringsfotoet.
  ingredientsPhoto?: string;
  nutritionOcrText?: string;
  ingredientsOcrText?: string;
  // Navn, hvis OpenAI ikke kan læse forsiden.
  fallbackName: string;
};

// Atomisk i SQL: de tre aflæsninger rydder hver sine felter samtidig.
async function clearPending(productId: string, fields: PendingField[]) {
  await prisma.$executeRaw`
    UPDATE "products"
    SET "pendingFields" = ARRAY(
      SELECT field FROM unnest("pendingFields") AS field WHERE NOT (field = ANY(${fields}::text[]))
    )
    WHERE "id" = ${productId}`;
}

// Registreringer lavet, mens næringen stadig blev aflæst, fik et foreløbigt
// snapshot. Varen er få minutter gammel, så alle dens registreringer stammer
// fra den periode og regnes om med de aflæste tal.
async function refreshRegistrationSnapshots(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, kcalPer100g: true, proteinPer100g: true, carbsPer100g: true, fatPer100g: true },
  });
  if (!product) return;
  const registrations = await prisma.registration.findMany({
    where: { productId },
    select: { id: true, amountGrams: true },
  });
  for (const registration of registrations) {
    const factor = registration.amountGrams / 100;
    await prisma.registration.update({
      where: { id: registration.id },
      data: {
        titleSnapshot: product.name,
        kcalSnapshot: product.kcalPer100g * factor,
        proteinSnapshot: product.proteinPer100g * factor,
        carbsSnapshot: product.carbsPer100g * factor,
        fatSnapshot: product.fatPer100g * factor,
      },
    });
  }
}

async function enrichFront(input: QuickEnrichmentInput) {
  const { productId } = input;
  try {
    const { analysisId, result, brandMatch } = await analyzeFrontPhoto({
      photo: input.frontPhoto,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
    });
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId } });

    // Logonavnet er holdt op mod brand-databasen; et match giver databasens
    // stavemåde, så der ikke oprettes en næsten-dublet.
    const brandName = (brandMatch?.name ?? result.brand ?? result.logoText ?? "").trim();
    const brand = brandName
      ? await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName } })
      : null;
    const name = result.productName?.trim() || input.fallbackName;
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        brandId: brand?.id,
        subbrand: result.subbrand ?? undefined,
        variant: result.variant ?? undefined,
        packageSizeText: result.packageSizeText ?? undefined,
      },
      select: { id: true, name: true, createdAt: true },
    });
    await flagSimultaneousDuplicates(product.id, product.name, product.createdAt);
    await linkCutoutJobsToProduct({
      frontAnalysisId: analysisId,
      productId,
      brand: brand ? { id: brand.id, name: brand.name } : null,
    }).catch((error) => console.error("Could not link cutout jobs", error));
  } catch (error) {
    console.error("Quick product front enrichment failed", productId, error);
  } finally {
    await clearPending(productId, ["name", "brand"]);
    // Navnet indgår i registreringernes titleSnapshot.
    await refreshRegistrationSnapshots(productId).catch(() => {});
  }
}

async function enrichNutrition(input: QuickEnrichmentInput) {
  const { productId } = input;
  let analysisId: string | null = null;
  try {
    const analysis = await analyzeNutritionPhoto({
      photo: input.nutritionPhoto,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      ocrText: input.nutritionOcrText,
    });
    analysisId = analysis.analysisId;
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId } });

    const ai = analysis.result;
    const aiComplete =
      ai.kcalPer100g != null && ai.proteinPer100g != null && ai.carbsPer100g != null && ai.fatPer100g != null;
    const alternativeServings = cleanAlternativeServings(ai.alternativeServings ?? []);
    const per100 = ai.basis === "100g" || ai.basis === "100ml";
    await prisma.product.update({
      where: { id: productId },
      data: {
        ...(aiComplete
          ? {
              kcalPer100g: ai.kcalPer100g!,
              proteinPer100g: ai.proteinPer100g!,
              carbsPer100g: ai.carbsPer100g!,
              fatPer100g: ai.fatPer100g!,
            }
          : {}),
        ...(per100 && typeof ai.saturatedFatPer100g === "number" && ai.saturatedFatPer100g >= 0
          ? { saturatedFatPer100g: ai.saturatedFatPer100g }
          : {}),
        ...(alternativeServings.length
          ? { alternativeServings: alternativeServings as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
    if (alternativeServings.length) {
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
      await flagUncertainAlternativeServings(productId, product?.name ?? "", alternativeServings);
    }
  } catch (error) {
    console.error("Quick product nutrition enrichment failed", productId, error);
  } finally {
    await recordNutrientSources(productId, analysisId);
    await clearPending(productId, ["nutrition"]);
    await refreshRegistrationSnapshots(productId).catch(() => {});
  }
}

async function enrichIngredients(input: QuickEnrichmentInput) {
  const { productId } = input;
  const photo = input.ingredientsPhoto ?? input.nutritionPhoto;
  const ocrText = input.ingredientsPhoto ? input.ingredientsOcrText : input.nutritionOcrText;
  try {
    const { analysisId, result } = await analyzeIngredientsPhoto({
      photo,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      ocrText,
    });
    await prisma.aiProductAnalysis.update({ where: { id: analysisId }, data: { productId } });
    if (result.ingredientsText) {
      await prisma.product.update({ where: { id: productId }, data: { ingredientsText: result.ingredientsText } });
    }
  } catch (error) {
    console.error("Quick product ingredients enrichment failed", productId, error);
  } finally {
    await clearPending(productId, ["ingredients"]);
  }
}

export async function enrichQuickProduct(input: QuickEnrichmentInput) {
  await Promise.all([enrichFront(input), enrichNutrition(input), enrichIngredients(input)]);
  await syncProductNutritionFeaturesSafely(input.productId);
}
