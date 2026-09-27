import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProfileUser } from "@/lib/family-access";
import { buildHfRecipeView } from "@/lib/hellofresh-recipe";

// GET — en HelloFresh-opskrift til opskriftssiden (docs/DECISIONS.md
// 2026-09-27), med brugerens favorit-status og kogebogsbilleder.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const product = await prisma.product.findFirst({
      where: { id, externalSource: "HELLOFRESH" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        kcalPer100g: true,
        proteinPer100g: true,
        carbsPer100g: true,
        fatPer100g: true,
        servingSizeGrams: true,
        allergens: true,
        nutritionExtra: true,
        recipeDetails: true,
        ingredients: {
          select: { rawAmount: true, rawUnit: true, ingredient: { select: { id: true, name: true, imageUrl: true } } },
        },
      },
    });
    if (!product) return NextResponse.json({ recipe: null }, { status: 404 });

    const user = await getProfileUser("recipeFavorites", "VIEWED");
    const [favorite, photos] = user
      ? await Promise.all([
          prisma.sharedRecipeFavorite.findUnique({ where: { userId_recipeId: { userId: user.id, recipeId: id } } }),
          prisma.recipeCookbookPhoto.findMany({
            where: { userId: user.id, productId: id },
            orderBy: { createdAt: "asc" },
            select: { id: true, image: true },
          }),
        ])
      : [null, []];

    return NextResponse.json({ recipe: buildHfRecipeView(product, { isFavorite: Boolean(favorite), photos }) });
  } catch (error) {
    console.error("HelloFresh recipe fetch failed", error);
    return NextResponse.json({ recipe: null, message: "Database ikke tilgængelig" }, { status: 503 });
  }
}
