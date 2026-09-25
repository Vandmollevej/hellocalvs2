import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, unauthorized } from "@/lib/session";
import { findVisibleSharedRecipe, markSharedRecipeUsed } from "@/lib/shared-recipe-share";
import type { PublicSharedRecipe } from "@/lib/shared-recipes";

// POST — "Gem som egen kopi": en privat, uafhængig ret, brugeren selv ejer.
// Virker også på en favorit, hvis ejeren har slettet originalen.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  let recipe = await findVisibleSharedRecipe(id);
  if (!recipe) {
    const favorite = await prisma.sharedRecipeFavorite.findUnique({
      where: { userId_recipeId: { userId: user.id, recipeId: id } },
    });
    recipe = (favorite?.recipe as unknown as PublicSharedRecipe | undefined) ?? null;
  }
  if (!recipe) return NextResponse.json({ message: "Retten findes ikke" }, { status: 404 });

  // Kun ingredienser, hvis produkt stadig findes, kan blive til en ret.
  const productIds = recipe.ingredients.map((i) => i.productId);
  const existing = new Set(
    (await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })).map((p) => p.id)
  );
  const ingredients = recipe.ingredients.filter((i) => existing.has(i.productId) && i.grams > 0);
  if (ingredients.length === 0) return NextResponse.json({ message: "Retten findes ikke" }, { status: 404 });

  const dish = await prisma.dish.create({
    data: {
      name: recipe.name,
      ownerId: user.id,
      ingredients: { create: ingredients.map((i) => ({ productId: i.productId, grams: i.grams })) },
    },
    include: { ingredients: { include: { product: true } } },
  });
  await markSharedRecipeUsed(id);
  return NextResponse.json({ dish }, { status: 201 });
}
