// Måltidskasse-integrationer (docs/DECISIONS.md 2026-10-10): HelloFresh,
// RetNemt og BetterFeast. Hver udbyders retter importeres som Product-rækker
// af sin egen natlige agent (scripts/hellofresh-import, scripts/retnemt-agent,
// scripts/betterfeast-agent), vises på HelloFresh-opskriftssiden
// (/profile/recipes/hellofresh/[id]) og slås til pr. bruger under
// Integrationer (User.recipeProviders). Ingen Prisma-import, så filen kan
// bruges i klientkomponenter.

export const MEAL_KIT_PROVIDERS = [
  { key: "hellofresh", source: "HELLOFRESH", idPrefix: "hf_", name: "HelloFresh" },
  { key: "retnemt", source: "RETNEMT", idPrefix: "rn_", name: "RetNemt" },
  { key: "betterfeast", source: "BETTERFEAST", idPrefix: "bf_", name: "BetterFeast" },
] as const;

export type MealKitProvider = (typeof MEAL_KIT_PROVIDERS)[number];
export type MealKitKey = MealKitProvider["key"];
export type MealKitSource = MealKitProvider["source"];

export const MEAL_KIT_KEYS: MealKitKey[] = MEAL_KIT_PROVIDERS.map((p) => p.key);
export const MEAL_KIT_SOURCES: MealKitSource[] = MEAL_KIT_PROVIDERS.map((p) => p.source);

// Importerede retter (måltidskasser + Valdemarsro) er ikke madvarer: de står
// under admin → Retter og aldrig i produktsøgning/Produkt-database.
export const IMPORTED_DISH_SOURCES = [...MEAL_KIT_SOURCES, "VALDEMARSRO"] as const;

export function isMealKitKey(value: unknown): value is MealKitKey {
  return typeof value === "string" && (MEAL_KIT_KEYS as string[]).includes(value);
}

export function mealKitByKey(key: MealKitKey): MealKitProvider {
  return MEAL_KIT_PROVIDERS.find((p) => p.key === key)!;
}

export function mealKitBySource(source: string | null | undefined): MealKitProvider | null {
  return MEAL_KIT_PROVIDERS.find((p) => p.source === source) ?? null;
}

export function mealKitForId(id: string): MealKitProvider | null {
  return MEAL_KIT_PROVIDERS.find((p) => id.startsWith(p.idPrefix)) ?? null;
}

// Brugerens valg (User.recipeProviders / PATCH /api/profile): kun kendte
// udbydere, hver højst én gang, i fast rækkefølge.
export function parseRecipeProviders(value: unknown): MealKitKey[] {
  const list = Array.isArray(value) ? value : [];
  return MEAL_KIT_KEYS.filter((key) => list.includes(key));
}
