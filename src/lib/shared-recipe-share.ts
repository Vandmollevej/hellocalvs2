import { prisma } from "@/lib/prisma";
import {
  publisherHashForUser,
  searchTextFor,
  toPublicRecipe,
  totalsFor,
  type PublicSharedRecipe,
  type SharedIngredient,
} from "@/lib/shared-recipes";
import { parseRecipeSteps, stepsText } from "@/lib/recipe-categories";
import { isRecipeImagePath } from "@/lib/recipe-image-storage";

// Deling, favoritter og kopier af brugeropskrifter på serveren
// (docs/DECISIONS.md 2026-09-24).

// En synlig delt ret (ikke afvist, udgiver ikke blokeret), ellers null.
export async function findVisibleSharedRecipe(id: string): Promise<PublicSharedRecipe | null> {
  const recipe = await prisma.sharedRecipe.findUnique({ where: { id } });
  if (!recipe || recipe.status === "REJECTED") return null;
  const blocked = await prisma.sharedRecipePublisherBlock.findUnique({
    where: { publisherHash: recipe.publisherHash },
  });
  return blocked ? null : toPublicRecipe(recipe);
}

export async function markSharedRecipeUsed(id: string) {
  await prisma.sharedRecipe
    .updateMany({ where: { id }, data: { popularity: { increment: 1 } } })
    .catch(() => undefined);
}

// Slå deling af brugerens egen ret til/fra. Returnerer det nye delte ID.
export async function setDishSharing(
  userId: string,
  dishId: string,
  shared: boolean,
  language: "da" | "en"
): Promise<{ sharedRecipeId: string | null } | { error: string; status: number }> {
  const dish = await prisma.dish.findFirst({
    where: { id: dishId, ownerId: userId },
    include: { ingredients: { include: { product: true } } },
  });
  if (!dish) return { error: "Ret ikke fundet", status: 404 };
  const publisherHash = publisherHashForUser(userId);

  if (shared && !dish.sharedRecipeId) {
    const blocked = await prisma.sharedRecipePublisherBlock.findUnique({ where: { publisherHash } });
    if (blocked) return { error: "Du kan ikke dele retter i øjeblikket", status: 403 };
    if (dish.ingredients.some((i) => i.product.privateOwnerId)) {
      return { error: "Retter med egne ingredienser kan ikke deles endnu", status: 409 };
    }
    const ingredients: SharedIngredient[] = dish.ingredients.map((i) => ({
      productId: i.productId,
      name: i.product.name,
      grams: i.grams,
      imageUrl: i.product.imageUrl ?? null,
      kcalPer100g: i.product.kcalPer100g,
      proteinPer100g: i.product.proteinPer100g,
      carbsPer100g: i.product.carbsPer100g,
      fatPer100g: i.product.fatPer100g,
    }));
    if (ingredients.length === 0) return { error: "Retten har ingen ingredienser", status: 400 };
    const recipe = await prisma.sharedRecipe.create({
      data: {
        publisherHash,
        name: dish.name,
        language,
        ingredients,
        // Billeder, fremgangsmåde og kategorier deles med (DECISIONS 2026-09-25).
        images: dish.images,
        steps: dish.steps ?? undefined,
        tags: dish.tags,
        searchText: `${searchTextFor(dish.name, ingredients)} ${stepsText(parseRecipeSteps(dish.steps, isRecipeImagePath))}`
          .trim()
          .toLowerCase(),
        ...totalsFor(ingredients),
      },
    });
    await prisma.dish.update({ where: { id: dish.id }, data: { sharedRecipeId: recipe.id } });
    return { sharedRecipeId: recipe.id };
  }

  if (!shared && dish.sharedRecipeId) {
    // Andres favoritter er snapshots og bevares.
    await prisma.sharedRecipe.deleteMany({ where: { id: dish.sharedRecipeId, publisherHash } });
    await prisma.dish.update({ where: { id: dish.id }, data: { sharedRecipeId: null } });
    return { sharedRecipeId: null };
  }

  return { sharedRecipeId: dish.sharedRecipeId };
}
