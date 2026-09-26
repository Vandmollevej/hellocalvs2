import type { Prisma } from "@prisma/client";
import { DEFAULT_RECIPE_FILTERS, RECIPE_DIETS } from "@/lib/recipe-filters";
import { evaluateRecipe, type RecipeFacts } from "@/lib/recipe-filter-match";
import { parseRecipeSteps, stepsText } from "@/lib/recipe-categories";
import { isRecipeImagePath } from "@/lib/recipe-image-storage";

// Egen ret med ingredienser (til forslag af kategorier efter gem,
// docs/DECISIONS.md 2026-09-25).
type DishWithProducts = Prisma.DishGetPayload<{ include: { ingredients: { include: { product: true } } } }>;

export function dishFacts(dish: DishWithProducts): RecipeFacts {
  const totals = dish.ingredients.reduce(
    (acc, i) => {
      const f = i.grams / 100;
      acc.kcal += i.product.kcalPer100g * f;
      acc.proteinG += i.product.proteinPer100g * f;
      acc.carbsG += i.product.carbsPer100g * f;
      acc.fatG += i.product.fatPer100g * f;
      return acc;
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  const steps = parseRecipeSteps(dish.steps, isRecipeImagePath);
  return {
    title: dish.name,
    segments: [
      ...dish.ingredients.map((i) => ({
        name: i.product.name,
        text: i.product.ingredientsText ?? "",
        allergens: i.product.allergens,
      })),
      // Fremgangsmåden scannes også (fx "vend med smør").
      ...(steps.length ? [{ name: "", text: stepsText(steps), allergens: [] }] : []),
    ],
    ...totals,
    nutrients: {},
    // Sukker kendes ikke her; "Lavt sukker" foreslås derfor aldrig.
    sugarPer100g: null,
  };
}

// Diæter, retten opfylder ud fra ingredienserne, som "diet:<key>".
export function suggestDishTags(dish: DishWithProducts): string[] {
  const facts = dishFacts(dish);
  return RECIPE_DIETS.filter(
    (diet) => evaluateRecipe(facts, { ...DEFAULT_RECIPE_FILTERS, diets: [diet] }).pass,
  ).map((diet) => `diet:${diet}`);
}
