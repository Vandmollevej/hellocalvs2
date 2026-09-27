// Ernæringsmål i en målsætning (docs/DECISIONS.md 2026-09-26): dagligt
// indtag af kcal og makroer. Klientsikker (ingen Prisma), så formularen og
// visningshjælperne kan bruge den samme liste som serveren.
export const NUTRITION_GOAL_FIELDS = [
  { field: "kcal", unit: "kcal", nameKey: "goals.nutrition.kcal" },
  { field: "proteinG", unit: "g", nameKey: "goals.nutrition.proteinG" },
  { field: "carbsG", unit: "g", nameKey: "goals.nutrition.carbsG" },
  { field: "fatG", unit: "g", nameKey: "goals.nutrition.fatG" },
] as const;

export type NutritionGoalField = (typeof NUTRITION_GOAL_FIELDS)[number]["field"];

export function isNutritionGoalField(value: string): value is NutritionGoalField {
  return NUTRITION_GOAL_FIELDS.some(({ field }) => field === value);
}

export function emptyNutritionGoalValues(): Record<NutritionGoalField, string> {
  return Object.fromEntries(NUTRITION_GOAL_FIELDS.map(({ field }) => [field, ""])) as Record<NutritionGoalField, string>;
}
