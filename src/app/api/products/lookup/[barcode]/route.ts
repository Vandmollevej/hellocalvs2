import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupOpenFoodFacts } from "@/lib/openFoodFacts";
import { lookupFoodDataCentral } from "@/lib/foodDataCentral";
import { inferGs1OriginCountryCode } from "@/lib/regions";
import { createExternalImageCutoutJob } from "@/lib/image-cutout-jobs";
import { syncProductNutritionFeaturesSafely } from "@/lib/product-nutrition-features";
import { debugLog, errorText, flowIdFromRequest } from "@/lib/debug-log";

// GET /api/products/lookup/:barcode
//
// 1. Looks in our own database first (the barcode may already be known).
// 2. Falls back to Open Food Facts if the product is unknown.
// 3. Saves the found product locally (as "PENDING" — requires admin approval,
//    per docs/ADMIN.md), so it doesn't need to be looked up again next time.
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
    const existing = await prisma.barcode.findUnique({
      where: { code: barcode },
      include: { product: { include: { brand: true } } },
    });

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
