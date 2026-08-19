import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lookupOpenFoodFacts } from "@/lib/openFoodFacts";

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
    if (!offProduct) {
      return NextResponse.json({ source: "none", product: null }, { status: 404 });
    }

    const brand = offProduct.brand
      ? await prisma.brand.upsert({
          where: { name: offProduct.brand },
          update: {},
          create: { name: offProduct.brand },
        })
      : null;

    const product = await prisma.product.create({
      data: {
        name: offProduct.name,
        brandId: brand?.id,
        imageUrl: offProduct.imageUrl,
        kcalPer100g: offProduct.kcalPer100g,
        proteinPer100g: offProduct.proteinPer100g,
        carbsPer100g: offProduct.carbsPer100g,
        fatPer100g: offProduct.fatPer100g,
        status: "PENDING",
        barcodes: { create: { code: barcode } },
      },
      include: { brand: true },
    });

    return NextResponse.json({ source: "openfoodfacts", product });
  } catch (error) {
    // Ingen databaseforbindelse i dette miljø (kører uden Postgres) —
    // fejler tydeligt i stedet for at crashe appen. Virker uændret, når
    // DATABASE_URL peger på en rigtig Postgres-container på Synology.
    console.error("Product lookup failed", error);
    return NextResponse.json(
      { source: "error", product: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
