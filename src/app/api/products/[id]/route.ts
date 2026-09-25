import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveGenericIngredientNutrients, resolveProductNutrients } from "@/lib/nutrient-resolution";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        brand: true,
        barcodes: true,
        images: { orderBy: { order: "asc" } },
        nutritionFeatures: {
          select: {
            sugarsPer100g: true,
            sugarSource: true,
            fiberPer100g: true,
            fiberSource: true,
            saltPer100g: true,
            saltSource: true,
          },
        },
      },
    });
    // En privat ingrediens vises kun for ejeren.
    if (product && product.privateOwnerId) {
      const user = await getSessionUser();
      if (user?.id !== product.privateOwnerId) return NextResponse.json({ message: "Ikke fundet" }, { status: 404 });
    }
    if (product) {
      // Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): alle næringsstoffer
      // ud over makroerne, pr. 100 g, med estimeret-flag.
      const nutrients = await resolveProductNutrients(product).catch((error) => {
        console.error("Nutrient resolution failed", error);
        return [];
      });
      return NextResponse.json({ product: { ...product, nutrients } });
    }

    // Not a Product — try the separate GenericIngredient table (loose
    // fruit/vegetable/meat with no brand/packaging, see docs/DECISIONS.md
    // 2026-09-19) and reshape it into the same product-like JSON contract, so
    // /add/[id] can display it through the exact same screen. `brand`,
    // `barcodes` and `ingredientsText` are always empty/null — a generic
    // ingredient never has those.
    const ingredient = await prisma.genericIngredient.findUnique({
      where: { id },
      include: { images: { orderBy: { order: "asc" } } },
    });
    if (ingredient) {
      const nutrients = await resolveGenericIngredientNutrients(ingredient).catch(() => []);
      return NextResponse.json({
        product: {
          id: ingredient.id,
          name: ingredient.name,
          kcalPer100g: ingredient.kcalPer100g ?? 0,
          proteinPer100g: ingredient.proteinPer100g ?? 0,
          carbsPer100g: ingredient.carbsPer100g ?? 0,
          fatPer100g: ingredient.fatPer100g ?? 0,
          servingSizeGrams: null,
          servingSizeUnitSingular: null,
          servingSizeUnitPlural: null,
          brand: null,
          imageUrl: ingredient.imageUrl,
          images: ingredient.images,
          ingredientsText: null,
          allergens: [],
          additives: [],
          barcodes: [],
          createdByUserId: ingredient.createdByUserId,
          // Løs ingrediens uden brand/stregkode — altid gram.
          productCategory: "INGREDIENT",
          packageSizeText: null,
          isGenericIngredient: true,
          // Uden et Frida-match har ingrediensen ingen kendt næringsværdi —
          // UI skal vise "–", ikke lade som om 0 er en rigtig målt værdi.
          hasKnownNutrition: ingredient.kcalPer100g !== null,
          nutrients,
        },
      });
    }

    return NextResponse.json({ product: null }, { status: 404 });
  } catch (error) {
    console.error("Product fetch failed", error);
    return NextResponse.json(
      { product: null, message: "Database ikke tilgængelig" },
      { status: 503 }
    );
  }
}
