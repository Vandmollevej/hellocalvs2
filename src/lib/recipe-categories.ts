import { RECIPE_DIETS } from "@/lib/recipe-filters";

// Kategorier for en ret (docs/DECISIONS.md 2026-09-25). Gemmes som
// "<gruppe>:<værdi>" i Dish.tags / SharedRecipe.tags. Diæterne foreslås ud
// fra ingredienserne; resten vælger brugeren i vinduet efter Gem.

export const RECIPE_CATEGORY_GROUPS = {
  diet: RECIPE_DIETS,
  meal: ["breakfast", "lunch", "dinner", "snack", "dessert"],
  cuisine: ["danish", "nordic", "italian", "french", "spanish", "greek", "middleEastern", "indian", "asian", "mexican", "american"],
  method: ["quick", "oven", "stew", "salad", "soup", "grill", "noCook"],
} as const;

export type RecipeCategoryGroup = keyof typeof RECIPE_CATEGORY_GROUPS;

const ALL_TAGS = new Set<string>(
  Object.entries(RECIPE_CATEGORY_GROUPS).flatMap(([group, values]) => values.map((v) => `${group}:${v}`)),
);

export function parseRecipeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((v): v is string => typeof v === "string" && ALL_TAGS.has(v))));
}

// Fremgangsmåde: overskrift + tekst (+ evt. billede) pr. trin.
export type RecipeStep = { title: string; text: string; image: string | null };

export const MAX_RECIPE_IMAGES = 3;
export const MAX_RECIPE_STEPS = 30;

export function parseRecipeSteps(value: unknown, isImage: (path: string) => boolean): RecipeStep[] {
  if (!Array.isArray(value)) return [];
  const steps: RecipeStep[] = [];
  for (const raw of value.slice(0, MAX_RECIPE_STEPS) as Record<string, unknown>[]) {
    const title = typeof raw?.title === "string" ? raw.title.trim().slice(0, 120) : "";
    const text = typeof raw?.text === "string" ? raw.text.trim().slice(0, 2000) : "";
    const image = typeof raw?.image === "string" && isImage(raw.image) ? raw.image : null;
    if (title || text || image) steps.push({ title, text, image });
  }
  return steps;
}

export function stepsText(steps: RecipeStep[]) {
  return steps.map((s) => `${s.title} ${s.text}`).join(" ");
}
