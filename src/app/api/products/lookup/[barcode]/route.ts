import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupOpenFoodFacts } from "@/lib/openFoodFacts";
import { lookupFoodDataCentral } from "@/lib/foodDataCentral";

// GET /api/products/lookup/:barcode
//
// 1. Looks in our own database first (the barcode may already be known).
// 2. Falls back to Open Food Facts if the product is unknown.
// 3. Saves the found product locally (as "PENDING" — requires admin approval,
//    per docs/ADMIN.md), so it doesn't need to be looked up again next time.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ barcode: string }> }
) {
  const { barcode } = await params;

  try {
    const existing = await prisma.barcode.findUnique({
      where: { code: barcode },
      include: { product: { include: { brand: true } } },
    });

    if (existing) {
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
        externalSource,
        externalId,
        sourceCheckedAt: new Date(),
        status: "PENDING",
        barcodes: { create: { code: barcode } },
      },
      include: { brand: true },
    });

    return NextResponse.json(
      { source: offProduct ? "openfoodfacts" : "usda", product }
    );
  } catch (error) {
    // No database connection in this environment (running without Postgres) —
    // fails clearly instead of crashing the app. Works unchanged when
    // DATABASE_URL points to a real Postgres container on Synology.
    console.error("Product lookup failed", error);
    return NextResponse.json(
      {
        source: "error",
        product: null,
        message: "Produktopslag er midlertidigt utilgængeligt",
      },
      { status: 503 }
    );
  }
}
