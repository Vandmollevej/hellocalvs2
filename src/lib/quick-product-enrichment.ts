import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  analyzeFrontPhoto,
  analyzeIngredientsPhoto,
  analyzeLabelPhoto,
  analyzeNutritionPhoto,
  recordLocalAnalysis,
} from "@/lib/product-photo-analysis";
import { localIngredients, localNutrition } from "@/lib/local-label";
import { hasIngredientsHeading } from "@/lib/product-ocr";
import { linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import { cleanAlternativeServings } from "@/lib/alternative-servings";
import { flagUncertainAlternativeServings } from "@/lib/alternative-servings-review";
import { flagSimultaneousDuplicates } from "@/lib/product-duplicates";
import { recordNutrientSources } from "@/lib/product-nutrient-sources";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import type { IngredientsAnalysis, NutritionAnalysis } from "@/lib/product-analysis-types";

// "Opret straks" (docs/DECISIONS.md 2026-09-27): kameraflowet opretter varen,
// så snart den lokale OCR er kørt, og sender brugeren videre til /add/[id].
// Her udfyldes resten bagefter. Forsiden (navn/brand/subbrand) læses af
// OpenAI. Energi og indhold følger brugerens valg "lokal først + ét samlet
// kald": telefonens OCR bruges, når den kan læses sikkert, og ellers læser
// ét OpenAI-kald det, der mangler. Hvert felt fjernes fra
// Product.pendingFields, så snart det er aflæst (eller aflæsningen fejlede).

export type PendingField = "name" | "brand" | "nutrition" | "ingredients";

export type QuickEnrichmentInput = {
  productId: string;
  barcode: string;
  marketRegion: string;
  // Telefonens land/sprog og appens sprog, fastfrosset ved scanningen.
  signals?: unknown;
  frontPhoto: string;
  nutritionPhoto: string;
  // Udeladt, når ingredienslisten stod på næringsfotoet.
  ingredientsPhoto?: string;
  nutritionOcrText?: string;
  nutritionOcrConfidence?: number;
  ingredientsOcrText?: string;
  ingredientsOcrConfidence?: number;
  // Navn, hvis OpenAI ikke kan læse forsiden.
  fallbackName: string;
};

// Atomisk i SQL: aflæsningerne rydder hver sine felter samtidig.
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
      signals: input.signals,
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

type Read<T> = { analysisId: string; result: T } | null;

// Energi + indhold: lokal først, ét samlet OpenAI-kald for det, der mangler.
// - Næringen bruges lokalt, når alle fire hovedtal findes og hænger sammen.
// - Ingredienslisten bruges lokalt ved en tydelig "Ingredienser:"-sektion og
//   OCR-sikkerhed >= 85 % (src/lib/local-label.ts).
// - Mangler næringen, og står indholdet på samme foto: ét kald til begge.
// - Ellers kun det kald, der mangler (to separate fotos kræver to kald).
async function enrichLabel(input: QuickEnrichmentInput) {
  const { productId } = input;
  const base = { barcode: input.barcode, marketRegion: input.marketRegion, signals: input.signals };
  const nutritionText = input.nutritionOcrText ?? "";
  const ingredientsPhoto = input.ingredientsPhoto ?? input.nutritionPhoto;
  const ingredientsText = input.ingredientsPhoto ? (input.ingredientsOcrText ?? "") : nutritionText;
  const ingredientsConfidence = input.ingredientsPhoto ? input.ingredientsOcrConfidence : input.nutritionOcrConfidence;

  const localN = localNutrition(nutritionText, input.nutritionOcrConfidence ?? 0);
  const localI = localIngredients(ingredientsText, ingredientsConfidence ?? 0);

  let nutrition: Read<NutritionAnalysis> = null;
  let ingredients: Read<IngredientsAnalysis> = null;

  try {
    if (!localN && !input.ingredientsPhoto) {
      const both = await analyzeLabelPhoto({ ...base, photo: input.nutritionPhoto, ocrText: nutritionText });
      nutrition = both.nutrition;
      // En sikker lokal ingrediensliste beholdes kun, hvis OpenAI intet fandt.
      if (both.ingredients.result.ingredientsText || !localI) ingredients = both.ingredients;
    } else {
      const wantIngredients =
        !localI && (Boolean(input.ingredientsPhoto) || !ingredientsText || hasIngredientsHeading(ingredientsText));
      const [nutritionRead, ingredientsRead] = await Promise.all([
        localN
          ? Promise.resolve(null)
          : analyzeNutritionPhoto({ ...base, photo: input.nutritionPhoto, ocrText: nutritionText }).catch((error) => {
              console.error("Quick product nutrition enrichment failed", productId, error);
              return null;
            }),
        wantIngredients
          ? analyzeIngredientsPhoto({ ...base, photo: ingredientsPhoto, ocrText: ingredientsText }).catch((error) => {
              console.error("Quick product ingredients enrichment failed", productId, error);
              return null;
            })
          : Promise.resolve(null),
      ]);
      nutrition = nutritionRead;
      ingredients = ingredientsRead;
    }
  } catch (error) {
    console.error("Quick product label enrichment failed", productId, error);
  }

  try {
    if (!nutrition && localN) {
      const { analysisId } = await recordLocalAnalysis({ ...base, kind: "NUTRITION", photo: input.nutritionPhoto, prediction: localN });
      nutrition = { analysisId, result: localN };
    }
    if (!ingredients && localI) {
      const { analysisId } = await recordLocalAnalysis({ ...base, kind: "INGREDIENTS", photo: ingredientsPhoto, prediction: localI });
      ingredients = { analysisId, result: localI };
    }

    if (nutrition) {
      await prisma.aiProductAnalysis.update({ where: { id: nutrition.analysisId }, data: { productId } });
      const read = nutrition.result;
      const complete =
        read.kcalPer100g != null && read.proteinPer100g != null && read.carbsPer100g != null && read.fatPer100g != null;
      const alternativeServings = cleanAlternativeServings(read.alternativeServings ?? []);
      const per100 = read.basis === "100g" || read.basis === "100ml";
      await prisma.product.update({
        where: { id: productId },
        data: {
          ...(complete
            ? {
                kcalPer100g: read.kcalPer100g!,
                proteinPer100g: read.proteinPer100g!,
                carbsPer100g: read.carbsPer100g!,
                fatPer100g: read.fatPer100g!,
              }
            : {}),
          ...(per100 && typeof read.saturatedFatPer100g === "number" && read.saturatedFatPer100g >= 0
            ? { saturatedFatPer100g: read.saturatedFatPer100g }
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
    }

    if (ingredients) {
      await prisma.aiProductAnalysis.update({ where: { id: ingredients.analysisId }, data: { productId } });
      if (ingredients.result.ingredientsText) {
        await prisma.product.update({ where: { id: productId }, data: { ingredientsText: ingredients.result.ingredientsText } });
      }
    }
  } catch (error) {
    console.error("Quick product label could not be saved", productId, error);
  } finally {
    await recordNutrientSources(productId, nutrition?.analysisId ?? null);
    await clearPending(productId, ["nutrition", "ingredients"]);
    await refreshRegistrationSnapshots(productId).catch(() => {});
  }
}

export async function enrichQuickProduct(input: QuickEnrichmentInput) {
  await Promise.all([enrichFront(input), enrichLabel(input)]);
  await syncProductNutritionFeaturesSafely(input.productId);
}
