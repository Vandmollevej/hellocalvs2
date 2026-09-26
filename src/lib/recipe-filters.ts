// Filtre til "Delte retter" (docs/DECISIONS.md 2026-09-25). Delt mellem
// klienten (filterskærmen, søgesiden) og GET /api/shared-recipes. Selve
// vurderingen af en ret ligger i src/lib/recipe-filter-match.ts (server).

export type RecipeSort = "relevance" | "popular" | "date";
export type MacroKey = "protein" | "carbs" | "fat";
export type MacroLevel = "high" | "low";

// De 14 EU-allergener (src/lib/allergens.ts) plus andre kendte
// fødevareallergier. Vises alfabetisk efter oversat navn.
export const RECIPE_ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame-seeds",
  "sulphur-dioxide-and-sulphites",
  "lupin",
  "molluscs",
  "apple",
  "avocado",
  "banana",
  "citrus",
  "garlic",
  "kiwi",
  "coconut",
  "onion",
  "corn",
  "legumes",
  "red-meat",
  "mushrooms",
  "stone-fruit",
  "strawberry",
  "tomato",
] as const;
export type RecipeAllergen = (typeof RECIPE_ALLERGENS)[number];

export const RECIPE_DIETS = [
  "vegan",
  "vegetarian",
  "pescetarian",
  "glutenFree",
  "lactoseFree",
  "keto",
  "lowSugar",
] as const;
export type RecipeDiet = (typeof RECIPE_DIETS)[number];

export const RECIPE_NUTRIENTS = ["fiber", "iron", "calcium", "potassium", "vitaminA", "vitaminC"] as const;
export type RecipeNutrient = (typeof RECIPE_NUTRIENTS)[number];

export const RECIPE_SORTS: RecipeSort[] = ["relevance", "popular", "date"];
export const MACRO_KEYS: MacroKey[] = ["protein", "carbs", "fat"];

export type RecipeFilters = {
  sort: RecipeSort;
  allergens: RecipeAllergen[];
  diets: RecipeDiet[];
  nutrients: RecipeNutrient[];
  // "Høj på protein" er macros.protein === "high"; høj og lav udelukker
  // hinanden pr. makro.
  macros: Partial<Record<MacroKey, MacroLevel>>;
  // Visning (tæller ikke som filtre): antal personer retterne justeres til,
  // og om kalorier/energifordeling vises i listen.
  persons: number;
  showKcal: boolean;
  showEnergySplit: boolean;
};

export const DEFAULT_RECIPE_FILTERS: RecipeFilters = {
  sort: "relevance",
  allergens: [],
  diets: [],
  nutrients: [],
  macros: {},
  persons: 1,
  showKcal: true,
  showEnergySplit: false,
};

// Energiprocent-grænser. Protein "høj" følger EU's anprisningsregel
// (forordning 1924/2006: mindst 20 % af energien fra protein); resten ligger
// uden for de nordiske næringsstofanbefalingers intervaller (NNR 2023:
// protein 10–20 E%, kulhydrat 45–60 E%, fedt 25–40 E%). "Lavt kulhydrat"
// følger den gængse low-carb-definition (under 26 E%, ~130 g/2000 kcal).
export const MACRO_THRESHOLDS: Record<MacroKey, { high: number; low: number }> = {
  protein: { high: 20, low: 10 },
  carbs: { high: 60, low: 26 },
  fat: { high: 40, low: 25 },
};
export const KETO_MAX_CARBS_PERCENT = 10;
// EU "lavt sukkerindhold": højst 5 g sukker pr. 100 g.
export const LOW_SUGAR_MAX_PER_100G = 5;

function pick<T extends string>(value: string | null, allowed: readonly T[]): T[] {
  if (!value) return [];
  const set = new Set<string>(allowed);
  return Array.from(new Set(value.split(",").filter((v) => set.has(v)))) as T[];
}

function level(value: unknown): MacroLevel | undefined {
  return value === "high" || value === "low" ? value : undefined;
}

export function filtersFromParams(params: URLSearchParams): RecipeFilters {
  const sort = params.get("sort");
  const macros: RecipeFilters["macros"] = {};
  for (const key of MACRO_KEYS) {
    const value = level(params.get(key));
    if (value) macros[key] = value;
  }
  return {
    sort: sort === "popular" || sort === "date" ? sort : "relevance",
    allergens: pick(params.get("allergens"), RECIPE_ALLERGENS),
    diets: pick(params.get("diets"), RECIPE_DIETS),
    nutrients: pick(params.get("nutrients"), RECIPE_NUTRIENTS),
    macros,
    persons: Math.min(6, Math.max(1, Math.round(Number(params.get("persons")) || 1))),
    showKcal: params.get("kcal") !== "0",
    showEnergySplit: params.get("split") === "1",
  };
}

export function filtersToParams(filters: RecipeFilters, params = new URLSearchParams()) {
  params.set("sort", filters.sort);
  if (filters.allergens.length) params.set("allergens", filters.allergens.join(","));
  if (filters.diets.length) params.set("diets", filters.diets.join(","));
  if (filters.nutrients.length) params.set("nutrients", filters.nutrients.join(","));
  for (const key of MACRO_KEYS) {
    const value = filters.macros[key];
    if (value) params.set(key, value);
  }
  params.set("persons", String(filters.persons));
  params.set("kcal", filters.showKcal ? "1" : "0");
  params.set("split", filters.showEnergySplit ? "1" : "0");
  return params;
}

// Antal aktive filtre (sortering tæller ikke) — til prikken på filterikonet.
export function activeFilterCount(filters: RecipeFilters) {
  return (
    filters.allergens.length +
    filters.diets.length +
    filters.nutrients.length +
    MACRO_KEYS.filter((key) => filters.macros[key]).length
  );
}

// Valgene huskes pr. enhed (kun en bekvemmelighed; intet gemmes på serveren).
const STORAGE_KEY = "hellocal.recipeFilters";

export function loadRecipeFilters(): RecipeFilters {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RECIPE_FILTERS;
    const data = JSON.parse(raw) as Record<string, unknown>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") params.set(key, value);
    }
    return filtersFromParams(params);
  } catch {
    return DEFAULT_RECIPE_FILTERS;
  }
}

export function saveRecipeFilters(filters: RecipeFilters) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(filtersToParams(filters))));
  } catch {
    // Privat vindue o.l.: filtrene gælder så kun, til siden forlades.
  }
}
