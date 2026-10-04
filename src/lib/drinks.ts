// Fælles typer og regning for drinks (docs/DRINKS.md). Ingen UI her.

export type DrinkIngredientDto = {
  id: string;
  name: string;
  unit: string;
  defaultAmount: number;
  minAmount: number;
  maxAmount: number;
  step: number;
  kcalPer100ml: number;
  proteinPer100ml: number;
  carbsPer100ml: number;
  fatPer100ml: number;
  sugarPer100ml: number | null;
  alcoholPercent: number | null;
};

export type DrinkDto = {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  ingredients: DrinkIngredientDto[];
};

/** Mængde i den angivne enhed → ml (1 ml regnes som 1 g). */
export function ingredientMl(unit: string, amount: number) {
  switch (unit.toLowerCase()) {
    case "cl":
      return amount * 10;
    case "dl":
      return amount * 100;
    case "l":
      return amount * 1000;
    default:
      return amount;
  }
}

type NutritionIngredient = Pick<
  DrinkIngredientDto,
  "unit" | "kcalPer100ml" | "proteinPer100ml" | "carbsPer100ml" | "fatPer100ml" | "sugarPer100ml"
>;

export function drinkTotals(chosen: { ingredient: NutritionIngredient; amount: number }[]) {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let sugar: number | null = null;
  for (const { ingredient, amount } of chosen) {
    const factor = ingredientMl(ingredient.unit, amount) / 100;
    kcal += ingredient.kcalPer100ml * factor;
    protein += ingredient.proteinPer100ml * factor;
    carbs += ingredient.carbsPer100ml * factor;
    fat += ingredient.fatPer100ml * factor;
    if (ingredient.sugarPer100ml !== null) sugar = (sugar ?? 0) + ingredient.sugarPer100ml * factor;
  }
  return { kcal, protein, carbs, fat, sugar };
}
