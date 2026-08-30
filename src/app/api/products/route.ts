import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchOpenFoodFacts } from "@/lib/openFoodFacts";
import { barcodeMatchesRegion } from "@/lib/regions";
import { getDemoUser } from "@/lib/demo-user";

// Henter Open Food Facts-produkter globalt live for søgeord uden nok lokale
// resultater, og gemmer dem som PENDING (samme mønster som stregkodeopslag i
// /api/products/lookup/[barcode]), så de kan søges igen uden ny live-kald.
async function importMatchingOffProducts(q: string) {
  try {
    const offProducts = await searchOpenFoodFacts(q);
    for (const offProduct of offProducts) {
      const existing = await prisma.barcode.findUnique({ where: { code: offProduct.barcode } });
      if (existing) continue;

      const brand = offProduct.brand
        ? await prisma.brand.upsert({
            where: { name: offProduct.brand },
            update: {},
            create: { name: offProduct.brand },
          })
        : null;

      await prisma.product.create({
        data: {
          name: offProduct.name,
          brandId: brand?.id,
          imageUrl: offProduct.imageUrl,
          kcalPer100g: offProduct.kcalPer100g,
          proteinPer100g: offProduct.proteinPer100g,
          carbsPer100g: offProduct.carbsPer100g,
          fatPer100g: offProduct.fatPer100g,
          servingSizeGrams: offProduct.servingSizeGrams,
          ingredientsText: offProduct.ingredientsText,
          allergens: offProduct.allergens,
          additives: offProduct.additives,
          externalSource: "OPEN_FOOD_FACTS",
          externalId: offProduct.barcode,
          sourceCheckedAt: new Date(),
          status: "PENDING",
          barcodes: { create: { code: offProduct.barcode } },
        },
      });
    }
  } catch (error) {
    // Live OFF-søgning er et supplement — fejler ikke selve produktsøgningen.
    console.error("Open Food Facts search import failed", error);
  }
}

// GET /api/products?q=rugbrød — søgning i egen produktdatabase, suppleret med
// en global live søgning i Open Food Facts hvis lokale resultater er
// sparsomme. Resultater med stregkode fra brugerens valgte region (se
// /profil/indstillinger) prioriteres øverst.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  try {
    const findProducts = () =>
      prisma.product.findMany({
        where: q
          ? { name: { contains: q, mode: "insensitive" }, discontinued: false }
          : { discontinued: false },
        include: { brand: true, barcodes: true },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

    let products = await findProducts();

    if (q && products.length < 10) {
      await importMatchingOffProducts(q);
      products = await findProducts();
    }

    if (q) {
      const user = await getDemoUser();
      products = [...products].sort((a, b) => {
        const aMatch = a.barcodes.some((bc) => barcodeMatchesRegion(bc.code, user.region));
        const bMatch = b.barcodes.some((bc) => barcodeMatchesRegion(bc.code, user.region));
        return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
      });
    }

    return NextResponse.json({ products });
  } catch (error) {
    console.error("Product search failed", error);
    return NextResponse.json(
      { products: [], message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}

function parsePositiveNumber(value: unknown): number | null {
  const num = typeof value === "string" ? parseFloat(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) && num >= 0 ? num : null;
}

// POST /api/products — opret et produkt manuelt, fx fra et foto af en
// næringsdeklaration (se /kamera?mode=naering). Oprettes som PENDING,
// samme status som andre brugerbidragede produkter (se docs/ADMIN.md).
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Ugyldig anmodning" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const kcalPer100g = parsePositiveNumber(body.kcalPer100g);
  const proteinPer100g = parsePositiveNumber(body.proteinPer100g);
  const carbsPer100g = parsePositiveNumber(body.carbsPer100g);
  const fatPer100g = parsePositiveNumber(body.fatPer100g);
  const servingSizeGrams = parsePositiveNumber(body.servingSizeGrams);

  if (!name || kcalPer100g === null || proteinPer100g === null || carbsPer100g === null || fatPer100g === null) {
    return NextResponse.json(
      { message: "Navn, kalorier, protein, kulhydrat og fedt skal udfyldes med gyldige tal" },
      { status: 400 }
    );
  }

  try {
    const product = await prisma.product.create({
      data: {
        name,
        kcalPer100g,
        proteinPer100g,
        carbsPer100g,
        fatPer100g,
        servingSizeGrams: servingSizeGrams ?? undefined,
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
