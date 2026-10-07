import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isIncompleteExternalProduct, lookupOpenFoodFacts, missingOffFields } from "@/lib/openFoodFacts";
import { addCertificationFilters } from "@/lib/product-certification-filters";
import { lookupFoodDataCentral } from "@/lib/foodDataCentral";
import { inferGs1OriginCountryCode } from "@/lib/regions";
import { createExternalImageCutoutJob } from "@/lib/image-cutout-jobs";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";
import { PET_FOOD_BLOCKED_MESSAGE, petFoodBlockReason } from "@/lib/pet-food-blacklist";

// GET /api/products/lookup/:barcode
//
// 1. Looks in our own database first (the barcode may already be known).
// 2. Falls back to Open Food Facts if the product is unknown.
// 3. Saves the found product locally (as "PENDING" — requires admin approval,
//    per docs/ADMIN.md), so it doesn't need to be looked up again next time.
//    A thin OFF record (no image, ingredients or salt) is NOT saved: the
//    answer is 404 so the camera flow goes on to the photos, and the photos
//    fill the product (docs/DECISIONS.md 2026-10-02). The same goes for a thin
//    OFF product saved before that rule — /api/products/quick fills it up.
// Every lookup is written to admin "Log" (docs/DECISIONS.md 2026-09-28).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params;
  const startedAt = Date.now();
  const log = (event: string, message: string, extra: { level?: "info" | "warn" | "error"; productId?: string; data?: Record<string, unknown> } = {}) =>
    void debugLog({
      category: "scan",
      event,
      message,
      flowId: flowIdFromRequest(req),
      barcode,
      durationMs: Date.now() - startedAt,
      ...extra,
    });

  try {
    // Dyrefoder-spærring (src/lib/pet-food-blacklist.ts): spærret stregkode
    // afvises før opslag, og dyrefoder fra Open Food Facts/USDA gemmes aldrig.
    const blockedResponse = (reason: string, match: string) => {
      log("barcode_lookup", `Afvist: dyrefoder (${reason}: ${match})`, { level: "warn", data: { source: "blocked" } });
      return NextResponse.json(
        { source: "blocked", product: null, code: "PET_FOOD_BLOCKED", message: PET_FOOD_BLOCKED_MESSAGE },
        { status: 422 }
      );
    };
    const barcodeBlock = petFoodBlockReason({ barcode });
    if (barcodeBlock) return blockedResponse(barcodeBlock.reason, barcodeBlock.match);

    const existing = await prisma.barcode.findUnique({
      where: { code: barcode },
      include: { product: { include: { brand: true } } },
    });

    if (existing && isIncompleteExternalProduct(existing.product)) {
      log("barcode_lookup", `Kendt fra Open Food Facts, men uden billede/ingredienser: ${existing.product.name} — kameraflowet fortsætter til fotoene`, {
        level: "warn",
        productId: existing.product.id,
        data: { source: "local-incomplete", hasImage: Boolean(existing.product.imageUrl), hasIngredients: Boolean(existing.product.ingredientsText) },
      });
      return NextResponse.json({ source: "incomplete", product: null, productId: existing.product.id }, { status: 404 });
    }

    if (existing) {
      log("barcode_lookup", `Fundet i egen database: ${existing.product.name}`, {
        productId: existing.product.id,
        data: { source: "local", status: existing.product.status },
      });
      return NextResponse.json({ source: "local", product: existing.product });
    }

    const offProduct = await lookupOpenFoodFacts(barcode);
    const usdaProduct = offProduct
      ? null
      : await lookupFoodDataCentral(barcode);
    const externalProduct = offProduct ?? usdaProduct;
    const externalSource = offProduct ? "OPEN_FOOD_FACTS" : "USDA";
    const externalId = offProduct?.barcode ?? usdaProduct?.externalId;

    if (!externalProduct || !externalId) {
      log("barcode_lookup", "Ukendt stregkode (hverken egen database, Open Food Facts eller USDA) — kameraflowet fortsætter", {
        data: { source: "none" },
      });
      return NextResponse.json({ source: "none", product: null }, { status: 404 });
    }

    const offMissing = offProduct ? missingOffFields(offProduct) : [];
    if (offMissing.length) {
      log("barcode_lookup", `Open Food Facts mangler ${offMissing.join(", ")} for "${offProduct!.name}" — gemmes ikke, kameraflowet fortsætter til fotoene`, {
        level: "warn",
        data: { source: "openfoodfacts-incomplete", missing: offMissing },
      });
      return NextResponse.json({ source: "incomplete", product: null }, { status: 404 });
    }

    const externalBlock = petFoodBlockReason({
      texts: [externalProduct.name, externalProduct.brand, offProduct?.ingredientsText],
    });
    if (externalBlock) return blockedResponse(externalBlock.reason, externalBlock.match);

    const brand = externalProduct.brand
      ? await prisma.brand.upsert({
          where: { name: externalProduct.brand },
          update: {},
          create: { name: externalProduct.brand },
        })
      : null;

    const product = await prisma.product.create({
      data: {
        name: externalProduct.name,
        brandId: brand?.id,
        imageUrl: externalProduct.imageUrl,
        kcalPer100g: externalProduct.kcalPer100g,
        proteinPer100g: externalProduct.proteinPer100g,
        carbsPer100g: externalProduct.carbsPer100g,
        fatPer100g: externalProduct.fatPer100g,
        servingSizeGrams: externalProduct.servingSizeGrams,
        servingSizeUnitSingular: offProduct?.servingIsSlice ? "skive" : undefined,
        servingSizeUnitPlural: offProduct?.servingIsSlice ? "skiver" : undefined,
        productCategory: offProduct?.isBeverage ? "DRINK" : undefined,
        ingredientsText: offProduct?.ingredientsText ?? null,
        allergens: offProduct?.allergens ?? [],
        additives: offProduct?.additives ?? [],
        saturatedFatPer100g: offProduct?.saturatedFatPer100g ?? null,
        unsaturatedFatPer100g: offProduct?.unsaturatedFatPer100g ?? null,
        transFatPer100g: offProduct?.transFatPer100g ?? null,
        cholesterolPer100g: offProduct?.cholesterolPer100g ?? null,
        vitaminAPer100g: offProduct?.vitaminAPer100g ?? null,
        vitaminCPer100g: offProduct?.vitaminCPer100g ?? null,
        nutritionExtra: offProduct?.nutritionExtraPer100 ?? undefined,
        packageSizeText: offProduct?.packageSizeText ?? undefined,
        externalSource,
        externalId,
        sourceCheckedAt: new Date(),
        originCountryCode: inferGs1OriginCountryCode(barcode),
        status: "PENDING",
        barcodes: { create: { code: barcode } },
      },
      include: { brand: true },
    });
    await syncProductNutritionFeaturesSafely(product.id);
    if (offProduct?.certificationLabels.length) {
      await addCertificationFilters(product.id, offProduct.certificationLabels).catch((error) =>
        console.error("Could not save OFF certifications", error),
      );
    }
    await createExternalImageCutoutJob(product.id, product.imageUrl).catch((error) =>
      console.error("Could not queue cutout for external image", error),
    );
    log("barcode_lookup", `Hentet fra ${offProduct ? "Open Food Facts" : "USDA"} og oprettet: ${product.name}`, {
      productId: product.id,
      data: { source: offProduct ? "openfoodfacts" : "usda", kcalPer100g: product.kcalPer100g },
    });

    return NextResponse.json(
      { source: offProduct ? "openfoodfacts" : "usda", product }
    );
  } catch (error) {
    // No database connection in this environment (running without Postgres) —
    // fails clearly instead of crashing the app. Works unchanged when
    // DATABASE_URL points to a real Postgres container on Synology.
    console.error("Product lookup failed", error);
    log("barcode_lookup", `Opslaget fejlede: ${errorText(error)}`, { level: "error" });
    return NextResponse.json(
      {
        source: "error",
        product: null,
        message: "Vareopslag er midlertidigt utilgængeligt",
      },
      { status: 503 }
    );
  }
}
