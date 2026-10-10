// HelloFresh-opskriftssiden (docs/DECISIONS.md 2026-09-27). Visningsdata
// fra Product.recipeDetails (scripts/hellofresh-import/agent.py) med
// fallback til de ældre kolonner for rækker, der endnu ikke er genimporteret.
// Værdierne vises præcis som HelloFresh angiver dem. Samme side viser RetNemt-
// og BetterFeast-retter (src/lib/meal-kit-providers.ts, DECISIONS 2026-10-10).

import { mealKitBySource, type MealKitKey } from "@/lib/meal-kit-providers";

export type HfNutritionRow = {
  // HelloFreshs egen betegnelse (fx "Mættet fedt"), eller en i18n-nøgle
  // under hfRecipe.nutrients, når værdien er beregnet af os.
  name: string | null;
  key: string | null;
  amount: number;
  unit: string | null;
};

export type HfRecipeView = {
  id: string;
  // Udbyderen (HelloFresh, RetNemt, BetterFeast) styrer kildetekster og noter.
  provider: MealKitKey;
  name: string;
  headline: string | null;
  description: string | null;
  imageUrl: string | null;
  totalMinutes: number | null;
  difficulty: number | null;
  tags: string[];
  // Navne fra HelloFresh; ellers nøgler til recipeFilters.allergens.
  allergenNames: string[];
  allergenKeys: string[];
  ingredients: { key: string; name: string; amount: number | null; unit: string | null; imageUrl: string | null }[];
  steps: { text: string }[];
  nutrition: HfNutritionRow[];
  // "portion" (HelloFresh/RetNemt) eller "100g" (BetterFeast: færdigretter
  // uden portionsvægt).
  nutritionBasis: "portion" | "100g";
  // Hele varedeklarationen, når udbyderen kun har den (BetterFeast).
  declaration: string | null;
  isFavorite: boolean;
  photos: { id: string; image: string }[];
};

type StoredDetails = {
  headline?: unknown;
  description?: unknown;
  totalTime?: unknown;
  prepTime?: unknown;
  difficulty?: unknown;
  tags?: unknown;
  allergens?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  nutrition?: unknown;
  nutritionBasis?: unknown;
  declaration?: unknown;
};

type ProductForView = {
  id: string;
  name: string;
  externalSource?: string | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  servingSizeGrams: number | null;
  allergens: string[];
  nutritionExtra: unknown;
  recipeDetails: unknown;
  ingredients: { rawAmount: number; rawUnit: string; ingredient: { id: string; name: string; imageUrl: string | null } }[];
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const texts = (value: unknown) => (Array.isArray(value) ? value.map(text).filter((v): v is string => v !== null) : []);

// ISO 8601-varighed fra HelloFresh ("PT35M", "PT1H10M") til minutter.
export function durationMinutes(value: unknown): number | null {
  const match = typeof value === "string" ? /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(value) : null;
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

// Tal vises som HelloFresh gør (punktum som decimaltegn, ingen afrunding af
// deres egne værdier); vores egne beregnede værdier afrundes til 2 decimaler.
export function formatHfAmount(amount: number): string {
  return String(Math.round(amount * 1000) / 1000);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

// Rækkefølge og enheder som HelloFreshs "Næringsværdier".
function fallbackNutrition(product: ProductForView): HfNutritionRow[] {
  const grams = product.servingSizeGrams;
  if (!grams) return [];
  const f = grams / 100;
  const extra = (product.nutritionExtra ?? {}) as Record<string, unknown>;
  const num = (value: unknown) => (typeof value === "number" ? value : null);
  const kcal = product.kcalPer100g * f;
  const rows: [string, number | null, string][] = [
    ["kcal", kcal, "kcal"],
    ["kj", kcal * 4.184, "kJ"],
    ["fat", product.fatPer100g * f, "g"],
    ["saturatedFat", num(extra.saturatedFatG), "g"],
    ["carbs", product.carbsPer100g * f, "g"],
    ["sugar", num(extra.sugarG), "g"],
    ["fiber", num(extra.fiberG), "g"],
    ["protein", product.proteinPer100g * f, "g"],
    ["salt", num(extra.saltG), "g"],
  ];
  return rows
    .filter((row): row is [string, number, string] => row[1] !== null)
    .map(([key, amount, unit]) => ({
      name: null,
      key,
      amount: key === "kcal" || key === "kj" ? Math.round(amount) : round2(amount),
      unit,
    }));
}

export function buildHfRecipeView(
  product: ProductForView,
  extras: { isFavorite: boolean; photos: { id: string; image: string }[] },
): HfRecipeView {
  const details = (product.recipeDetails ?? {}) as StoredDetails;
  const imageById = new Map(product.ingredients.map((pi) => [pi.ingredient.id, pi.ingredient.imageUrl]));

  const storedIngredients = Array.isArray(details.ingredients)
    ? (details.ingredients as Record<string, unknown>[]).flatMap((item, index) => {
        const name = text(item.name);
        if (!name) return [];
        const ingredientId = text(item.ingredientId);
        return [
          {
            key: `${ingredientId ?? name}-${index}`,
            name,
            amount: typeof item.amount === "number" ? item.amount : null,
            unit: text(item.unit),
            imageUrl: ingredientId ? (imageById.get(ingredientId) ?? null) : null,
          },
        ];
      })
    : null;

  const storedNutrition = Array.isArray(details.nutrition)
    ? (details.nutrition as Record<string, unknown>[]).flatMap((item) => {
        const name = text(item.name);
        return name && typeof item.amount === "number"
          ? [{ name, key: null, amount: item.amount, unit: text(item.unit) }]
          : [];
      })
    : [];

  const allergenNames = texts(details.allergens);

  return {
    id: product.id,
    provider: mealKitBySource(product.externalSource ?? "HELLOFRESH")?.key ?? "hellofresh",
    name: product.name,
    headline: text(details.headline),
    description: text(details.description),
    imageUrl: product.imageUrl,
    totalMinutes: durationMinutes(details.totalTime) ?? durationMinutes(details.prepTime),
    difficulty: typeof details.difficulty === "number" ? details.difficulty : null,
    tags: texts(details.tags),
    allergenNames,
    allergenKeys: allergenNames.length ? [] : product.allergens,
    ingredients:
      storedIngredients ??
      product.ingredients.map((pi) => ({
        key: pi.ingredient.id,
        name: pi.ingredient.name,
        amount: pi.rawAmount,
        unit: pi.rawUnit,
        imageUrl: pi.ingredient.imageUrl,
      })),
    steps: Array.isArray(details.steps)
      ? (details.steps as Record<string, unknown>[]).flatMap((step) => {
          const value = text(step.text);
          return value ? [{ text: value }] : [];
        })
      : [],
    nutrition: storedNutrition.length ? storedNutrition : fallbackNutrition(product),
    nutritionBasis: details.nutritionBasis === "100g" ? "100g" : "portion",
    declaration: text(details.declaration),
    ...extras,
  };
}

// Proteinindholdet pr. portion til meta-rækken øverst.
export function proteinRow(view: HfRecipeView) {
  return view.nutrition.find((row) => row.key === "protein" || row.name?.toLowerCase() === "protein") ?? null;
}

export const HF_RECIPE_MAX_PHOTOS = 12;
