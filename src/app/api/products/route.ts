import { NextResponse } from "next/server";
import { ExternalProductSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchOpenFoodFacts } from "@/lib/openFoodFacts";
import { barcodeMatchesRegion } from "@/lib/regions";
import { getDemoUser } from "@/lib/demo-user";

// Fetches Open Food Facts products globally live for search terms without enough local
// results, and saves them as PENDING (same pattern as the barcode lookup in
// /api/products/lookup/[barcode]), so they can be searched again without a new live call.
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
    // Live OFF search is a supplement — does not fail the actual product search.
    console.error("Open Food Facts search import failed", error);
  }
}

// GET /api/products?q=rugbrød — search in our own product database, supplemented by
// a global live search in Open Food Facts if local results are
// sparse. Results with a barcode from the user's selected region (see
// /profile/settings) are prioritized at the top.
// ?source=HELLOFRESH filters to a single external source (e.g. to browse the entire
// HelloFresh catalog); ?take=N overrides the default limit of 20 (max 200).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim() ?? "";
  const sourceParam = params.get("source")?.trim();
  const source =
    sourceParam && sourceParam in ExternalProductSource
      ? (sourceParam as ExternalProductSource)
      : undefined;
  const take = Math.min(Math.max(parseInt(params.get("take") ?? "20", 10) || 20, 1), 200);

  try {
    const findProducts = () =>
      prisma.product.findMany({
        where: {
          discontinued: false,
          ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
          ...(source ? { externalSource: source } : {}),
        },
        include: { brand: true, barcodes: true },
        take,
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

// POST /api/products — create a product manually, e.g. from a photo of a
// nutrition label (see /camera?mode=naering). Created as PENDING,
// the same status as other user-contributed products (see docs/ADMIN.md).
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
  const ingredientsText = typeof body.ingredientsText === "string" ? body.ingredientsText.trim() : "";
  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : undefined;
  const extraImages = Array.isArray(body.extraImages)
    ? body.extraImages.filter((img): img is string => typeof img === "string")
    : [];

  if (!name || kcalPer100g === null || proteinPer100g === null || carbsPer100g === null || fatPer100g === null) {
    return NextResponse.json(
      { message: "Navn, kalorier, protein, kulhydrat og fedt skal udfyldes med gyldige tal" },
      { status: 400 }
    );
  }

  if (barcode) {
    const existingBarcode = await prisma.barcode.findUnique({ where: { code: barcode } });
    if (existingBarcode) {
      return NextResponse.json(
        { message: "Stregkoden er allerede knyttet til et andet produkt" },
        { status: 409 }
      );
    }
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
        ingredientsText: ingredientsText || undefined,
        imageUrl,
        ...(barcode ? { barcodes: { create: { code: barcode } } } : {}),
        ...(extraImages.length
          ? { images: { create: extraImages.map((url, order) => ({ url, order })) } }
          : {}),
      },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Product creation failed", error);
    return NextResponse.json({ message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
