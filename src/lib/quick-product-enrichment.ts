import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  analyzeBarcodePhotoLogo,
  analyzeFrontPhoto,
  analyzeIngredientsPhoto,
  analyzeLabelPhoto,
  analyzeNutritionPhoto,
  recordLocalAnalysis,
} from "@/lib/product-photo-analysis";
import { localIngredients, localNutrition } from "@/lib/local-label";
import { hasIngredientsHeading } from "@/lib/product-ocr";
import { createBarcodeLogoCutoutJob, linkCutoutJobsToProduct } from "@/lib/image-cutout-jobs";
import { matchBrand } from "@/lib/brand-match";
import { cleanAlternativeServings } from "@/lib/alternative-servings";
import { flagUncertainAlternativeServings } from "@/lib/alternative-servings-review";
import { flagSimultaneousDuplicates } from "@/lib/product-duplicates";
import { recordNutrientSources } from "@/lib/product-nutrient-sources";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import type { IngredientsAnalysis, NutritionAnalysis } from "@/lib/product-analysis-types";
import { debugLog, errorText } from "@/lib/debug-log";
import { composeProductName, normalizeProductName } from "@/lib/product-naming";

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
  // Stregkode-fotoets AiProductAnalysis (kind=BARCODE), hvis det nåede at
  // blive gemt — læses for logo og variant.
  barcodeAnalysisId?: string | null;
  // "Scan varen igen" (docs/DECISIONS.md 2026-10-02): varen er ikke ny, så
  // dens registreringer kan være dage gamle og skal beholde deres snapshot,
  // og en mislykket næringsaflæsning må ikke nedgradere dens kilder.
  existingProduct?: boolean;
};

// Atomisk i SQL: aflæsningerne rydder hver sine felter samtidig.
export async function clearPending(productId: string, fields: PendingField[]) {
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
async function refreshRegistrationSnapshots(productId: string, input?: Pick<QuickEnrichmentInput, "existingProduct">) {
  if (input?.existingProduct) return;
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

// Returnerer, om forsidefotoet blev genkendt som en vare (navn, logo eller
// vareboks) — null, hvis aflæsningen fejlede teknisk.
export async function enrichFront(input: QuickEnrichmentInput): Promise<boolean | null> {
  const { productId } = input;
  const startedAt = Date.now();
  let recognized: boolean | null = null;
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
    // Navnet sammensættes som ved manuel oprettelse (produkttype + variant,
    // docs/DECISIONS.md 2026-09-23) — ellers endte fx "Uden brus" kun i
    // variant-feltet, og varen hed bare "Vand".
    const productName = result.productName?.trim() ?? "";
    recognized = Boolean(productName || result.logoText?.trim() || result.productBox);
    const variant = result.variant?.trim() ?? "";
    const name = productName
      ? variant && !productName.toLowerCase().includes(variant.toLowerCase())
        ? composeProductName({ productType: productName, variant })
        : normalizeProductName(productName)
      : input.fallbackName;
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
    await debugLog({
      category: "scan",
      event: "enrich_front",
      message: `Forside læst af AI: ${brand ? `${brand.name} — ` : ""}${name}${result.productName?.trim() ? "" : " (intet navn fundet, reservenavn beholdt)"}`,
      level: result.productName?.trim() ? "info" : "warn",
      productId,
      durationMs: Date.now() - startedAt,
      data: {
        name,
        brand: brand?.name ?? null,
        brandMatchedDatabase: Boolean(brandMatch),
        subbrand: result.subbrand ?? null,
        variant: result.variant ?? null,
        packageSizeText: result.packageSizeText ?? null,
      },
    });
  } catch (error) {
    console.error("Quick product front enrichment failed", productId, error);
    await debugLog({
      category: "scan",
      event: "enrich_front",
      level: "error",
      message: `Forside-aflæsningen fejlede: ${errorText(error)}`,
      productId,
      durationMs: Date.now() - startedAt,
    });
  } finally {
    await clearPending(productId, ["name", "brand"]);
    // Navnet indgår i registreringernes titleSnapshot.
    await refreshRegistrationSnapshots(productId, input).catch(() => {});
  }
  return recognized;
}

// Stregkode-fotoet (docs/DECISIONS.md 2026-09-28): logoet står ikke altid på
// forsiden. Kører efter forsiden, så den kun udfylder det forsiden manglede:
// - et logo i fotoet bliver altid et fritskrabnings-job (logo-kandidat),
// - brand sættes kun, hvis forsiden intet brand gav,
// - variant (fx "Uden brus") kun, hvis forsiden ingen variant gav.
async function enrichBarcodeLogo(input: QuickEnrichmentInput) {
  const { productId, barcodeAnalysisId } = input;
  if (!barcodeAnalysisId) return;
  const startedAt = Date.now();
  try {
    const read = await analyzeBarcodePhotoLogo({
      analysisId: barcodeAnalysisId,
      barcode: input.barcode,
      marketRegion: input.marketRegion,
      signals: input.signals,
    });
    if (!read) {
      await debugLog({
        category: "scan",
        event: "enrich_barcode_logo",
        level: "warn",
        message: "Stregkode-fotoet kunne ikke findes — intet logo læst derfra",
        productId,
        durationMs: Date.now() - startedAt,
      });
      return;
    }
    const { result, brandMatch, imageUrl } = read;
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { name: true, variant: true, brand: { select: { id: true, name: true } } },
    });
    if (!product) return;

    const logoText = result.logoText?.trim() || null;
    const changes: Prisma.ProductUpdateInput = {};
    let brand = product.brand;
    const brandName = (brandMatch?.name ?? logoText ?? "").trim();
    if (!brand && brandName && result.logoConfidence >= 0.5) {
      brand = await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName }, select: { id: true, name: true } });
      changes.brand = { connect: { id: brand.id } };
    }

    const variant = result.variant?.trim() ?? "";
    if (!product.variant && variant && result.variantConfidence >= 0.5) {
      changes.variant = variant;
      if (product.name !== input.fallbackName && !product.name.toLowerCase().includes(variant.toLowerCase())) {
        changes.name = composeProductName({ productType: product.name, variant });
      }
    }
    if (Object.keys(changes).length) {
      await prisma.product.update({ where: { id: productId }, data: changes });
      if (changes.name) await refreshRegistrationSnapshots(productId, input).catch(() => {});
    }

    // Logo-jobbet kobles til varens brand, når logoet er det brand;
    // ellers til det bedste match i brand-databasen.
    let logoJobCreated = false;
    if (result.logoBox) {
      const productBrandMatch = brand ? matchBrand(logoText, [brand]) : null;
      await createBarcodeLogoCutoutJob({
        analysisId: barcodeAnalysisId,
        sourceUrl: imageUrl,
        logoBox: result.logoBox,
        logoText,
        logoConfidence: result.logoConfidence,
        productId,
        brandMatch: productBrandMatch ?? brandMatch,
      });
      logoJobCreated = true;
    }

    await debugLog({
      category: "scan",
      event: "enrich_barcode_logo",
      message: `Stregkode-foto læst af AI: ${logoText ? `logo "${logoText}"` : "intet logo"}${variant ? ` · variant "${variant}"` : ""}${
        changes.brand ? " · brand sat fra stregkode-fotoet" : ""
      }${changes.variant ? " · variant sat fra stregkode-fotoet" : ""}`,
      productId,
      durationMs: Date.now() - startedAt,
      data: {
        logoText,
        logoConfidence: result.logoConfidence,
        brandMatch,
        variant: variant || null,
        variantConfidence: result.variantConfidence,
        logoJobCreated,
        changedFields: Object.keys(changes),
      },
    });
  } catch (error) {
    console.error("Quick product barcode logo enrichment failed", productId, error);
    await debugLog({
      category: "scan",
      event: "enrich_barcode_logo",
      level: "error",
      message: `Logo-aflæsningen af stregkode-fotoet fejlede: ${errorText(error)}`,
      productId,
      durationMs: Date.now() - startedAt,
    });
  }
}

type Read<T> = { analysisId: string; result: T } | null;

// Energi + indhold: lokal først, ét samlet OpenAI-kald for det, der mangler.
// - Næringen bruges lokalt, når alle fire hovedtal findes og hænger sammen.
// - Ingredienslisten bruges lokalt ved en tydelig "Ingredienser:"-sektion og
//   OCR-sikkerhed >= 85 % (src/lib/local-label.ts).
// - Mangler næringen, og står indholdet på samme foto: ét kald til begge.
// - Ellers kun det kald, der mangler (to separate fotos kræver to kald).
// Hvad der blev læst fra brugerens fotos — "Scan varen igen" bruger det til
// at afgøre, om varen kan overtages som vores egen (src/lib/product-rescan.ts).
export type LabelReadOutcome = { nutritionComplete: boolean; ingredientsRead: boolean; saturatedFatRead: boolean };

export async function enrichLabel(input: QuickEnrichmentInput): Promise<LabelReadOutcome> {
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
  const startedAt = Date.now();
  // Til admin "Log": hvilken vej aflæsningen tog, og hvad der evt. fejlede.
  let labelPath = "local";
  const labelErrors: string[] = [];

  try {
    if (!localN && !input.ingredientsPhoto) {
      labelPath = "openai-combined";
      const both = await analyzeLabelPhoto({ ...base, photo: input.nutritionPhoto, ocrText: nutritionText });
      nutrition = both.nutrition;
      // En sikker lokal ingrediensliste beholdes kun, hvis OpenAI intet fandt.
      if (both.ingredients.result.ingredientsText || !localI) ingredients = both.ingredients;
    } else {
      const wantIngredients =
        !localI && (Boolean(input.ingredientsPhoto) || !ingredientsText || hasIngredientsHeading(ingredientsText));
      labelPath = `nutrition:${localN ? "local" : "openai"}, ingredients:${wantIngredients ? "openai" : localI ? "local" : "skipped"}`;
      const [nutritionRead, ingredientsRead] = await Promise.all([
        localN
          ? Promise.resolve(null)
          : analyzeNutritionPhoto({ ...base, photo: input.nutritionPhoto, ocrText: nutritionText }).catch((error) => {
              console.error("Quick product nutrition enrichment failed", productId, error);
              labelErrors.push(`nutrition: ${errorText(error)}`);
              return null;
            }),
        wantIngredients
          ? analyzeIngredientsPhoto({ ...base, photo: ingredientsPhoto, ocrText: ingredientsText }).catch((error) => {
              console.error("Quick product ingredients enrichment failed", productId, error);
              labelErrors.push(`ingredients: ${errorText(error)}`);
              return null;
            })
          : Promise.resolve(null),
      ]);
      nutrition = nutritionRead;
      ingredients = ingredientsRead;
    }
  } catch (error) {
    console.error("Quick product label enrichment failed", productId, error);
    labelErrors.push(`label: ${errorText(error)}`);
  }
  const nutritionFromAi = Boolean(nutrition);
  const ingredientsFromAi = Boolean(ingredients);

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
    labelErrors.push(`save: ${errorText(error)}`);
  } finally {
    if (nutrition || !input.existingProduct) await recordNutrientSources(productId, nutrition?.analysisId ?? null);
    await clearPending(productId, ["nutrition", "ingredients"]);
    await refreshRegistrationSnapshots(productId, input).catch(() => {});
  }

  const read = nutrition?.result;
  const nutritionComplete =
    read != null && read.kcalPer100g != null && read.proteinPer100g != null && read.carbsPer100g != null && read.fatPer100g != null;
  const nutritionSource = nutrition ? (nutritionFromAi ? "OpenAI" : "telefonens OCR") : "ingen";
  const ingredientsSource = ingredients ? (ingredientsFromAi ? "OpenAI" : "telefonens OCR") : "ingen";
  await debugLog({
    category: "scan",
    event: "enrich_label",
    level: labelErrors.length || !nutritionComplete ? (nutrition ? "warn" : "error") : "info",
    message: `Energi: ${nutritionComplete ? `${read!.kcalPer100g} kcal/100 (${nutritionSource})` : `ikke komplet (${nutritionSource})`} · Ingredienser: ${
      ingredients?.result.ingredientsText ? `${ingredients.result.ingredientsText.length} tegn (${ingredientsSource})` : `ingen (${ingredientsSource})`
    }`,
    productId,
    durationMs: Date.now() - startedAt,
    data: {
      path: labelPath,
      nutrition: read ?? null,
      ingredientsText: ingredients?.result.ingredientsText?.slice(0, 500) ?? null,
      errors: labelErrors,
    },
  });
  return {
    nutritionComplete,
    ingredientsRead: Boolean(ingredients?.result.ingredientsText),
    saturatedFatRead:
      (read?.basis === "100g" || read?.basis === "100ml") &&
      typeof read?.saturatedFatPer100g === "number" &&
      read.saturatedFatPer100g >= 0,
  };
}

export async function enrichQuickProduct(input: QuickEnrichmentInput) {
  const startedAt = Date.now();
  await Promise.all([enrichFront(input).then(() => enrichBarcodeLogo(input)), enrichLabel(input)]);
  await syncProductNutritionFeaturesSafely(input.productId);

  const product = await prisma.product
    .findUnique({
      where: { id: input.productId },
      select: { name: true, pendingFields: true, kcalPer100g: true, brand: { select: { name: true } } },
    })
    .catch(() => null);
  await debugLog({
    category: "scan",
    event: "enrichment_done",
    level: product && product.pendingFields.length === 0 ? "info" : "warn",
    message: product
      ? `Varen er færdig: ${product.brand ? `${product.brand.name} — ` : ""}${product.name} (${product.kcalPer100g} kcal/100)${
          product.pendingFields.length ? ` · stadig ventende felter: ${product.pendingFields.join(", ")}` : ""
        }`
      : "Varen findes ikke længere",
    productId: input.productId,
    durationMs: Date.now() - startedAt,
    data: product ? { pendingFields: product.pendingFields } : null,
  });
}
