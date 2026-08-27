import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupOpenFoodFacts } from "@/lib/openFoodFacts";
import { lookupFoodDataCentral } from "@/lib/foodDataCentral";

// GET /api/products/lookup/:barcode
//
// 1. Kigger i vores egen database først (stregkoden kan allerede være kendt).
// 2. Falder tilbage til Open Food Facts, hvis produktet er ukendt.
// 3. Gemmer fundet produkt lokalt (som "PENDING" — kræver admin-godkendelse,
//    jf. docs/ADMIN.md), så det ikke skal slås op igen næste gang.
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
    // Ingen databaseforbindelse i dette miljø (kører uden Postgres) —
    // fejler tydeligt i stedet for at crashe appen. Virker uændret, når
    // DATABASE_URL peger på en rigtig Postgres-container på Synology.
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
