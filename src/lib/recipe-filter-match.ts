import {
  KETO_MAX_CARBS_PERCENT,
  LOW_SUGAR_MAX_PER_100G,
  MACRO_KEYS,
  MACRO_THRESHOLDS,
  type MacroKey,
  type RecipeAllergen,
  type RecipeFilters,
  type RecipeNutrient,
} from "@/lib/recipe-filters";

// Vurderer én ret mod filtrene fra filterskærmen (docs/DECISIONS.md
// 2026-09-25). Allergener og diæter udledes af to kilder: madvarens
// EU-allergenmærkning (Product.allergens) og en scanning af rettens navn,
// ingrediensnavne og varedeklarationer (Product.ingredientsText) for kendte
// ord på dansk og engelsk. Ukendte næringsværdier tæller som "ikke opfyldt".

// Ét stykke tekst pr. ingrediens: navnet + varedeklarationen + madvarens
// egne EU-allergener.
export type RecipeSegment = {
  name: string;
  text: string;
  allergens: string[];
};

export type RecipeFacts = {
  title: string;
  segments: RecipeSegment[];
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  // Samlet mængde i hele retten (samme enhed som NUTRIENT_RULES), null =
  // ukendt for en for stor del af retten.
  nutrients: Partial<Record<RecipeNutrient, number | null>>;
  sugarPer100g: number | null;
};

export type RecipeWarning = { ingredient: string; allergen: RecipeAllergen };

// ---------------------------------------------------------------------------
// Ordgenkendelse. "^x" = ordet starter med x, "x$" = ordet slutter med x,
// "^x$" = hele ordet, ellers hvor som helst i ordet (danske sammensatte ord).
// "?" gør det foregående bogstav valgfrit (fx "^eggs?").

function toRegex(term: string) {
  const start = term.startsWith("^");
  const end = term.endsWith("$");
  const core = term.replace(/^\^/, "").replace(/\$$/, "").replace(/[.*+(){}[\]\\|]/g, "\\$&");
  return `${start ? "(?<![\\p{L}])" : ""}${core}${end ? "(?![\\p{L}])" : ""}`;
}

function matcher(terms: string[]) {
  return new RegExp(terms.map(toRegex).join("|"), "iu");
}

type AllergenRule = {
  terms: string[];
  // Ord, der fjernes før søgningen, fordi de ligner men ikke er allergenet
  // (fx "kokosmælk" for mælk, "muskatnød" for nødder).
  exclude?: string[];
  // Står et af disse i ingrediensens navn, er ingrediensen fri for allergenet.
  freeMarkers?: string[];
};

const PLANT_MARKERS = ["vegan", "plantebaseret", "plant-based", "plantbased"];

const ALLERGEN_RULES: Record<RecipeAllergen, AllergenRule> = {
  gluten: {
    terms: [
      "hvede", "^rug", "^byg", "spelt", "^emmer", "kamut", "durum", "semolina", "couscous", "bulgur",
      "pasta", "spaghetti", "nudler", "lasagne", "tortilla", "brød", "^boller", "rasp", "panko", "^mel$",
      "^kiks", "^pita", "naan", "^øl$", "^malt", "sojasauce", "soyasauce", "soy sauce", "seitan", "wheat",
      "barley", "^rye$", "flour", "bread", "noodle", "^beer", "croissant", "^wraps?$",
    ],
    freeMarkers: ["glutenfri", "gluten-free", "gluten free", "glutenfree"],
  },
  crustaceans: {
    terms: ["reje", "hummer", "krebs", "krabbe", "scampi", "langust", "shrimp", "prawn", "lobster", "crab", "crayfish"],
  },
  eggs: {
    terms: ["^æg", "æg$", "mayonnaise", "^mayo", "^marengs", "^aioli", "^eggs?", "egg$"],
    exclude: ["ægte"],
    freeMarkers: ["æggefri", "egg-free", "egg free", ...PLANT_MARKERS],
  },
  fish: {
    terms: [
      "fisk", "laks", "torsk", "^tun", "makrel", "^sild", "rødspætte", "^sej$", "kuller", "ansjos", "sardin",
      "hellefisk", "ørred", "pangasius", "tilapia", "kaviar", "^rogn", "surimi", "^fish", "salmon", "^cod$",
      "tuna", "mackerel", "anchov", "sardine", "trout",
    ],
  },
  peanuts: { terms: ["jordnød", "peanut", "arachis"] },
  soybeans: { terms: ["^soja", "^soya", "^soy", "tofu", "edamame", "^miso", "tempeh", "tamari"] },
  milk: {
    terms: [
      "mælk", "fløde", "^oste", "ost$", "^ost", "smør", "yoghurt", "yogurt", "skyr", "kvark", "creme fraiche",
      "crème fraîche", "cremefraiche", "mascarpone", "ricotta", "mozzarella", "parmesan", "feta", "cheddar",
      "^brie", "halloumi", "^valle", "kasein", "casein", "laktose", "lactose", "^milk", "butter", "cream",
      "cheese", "whey", "^ghee", "burrata", "gorgonzola", "^kefir",
    ],
    exclude: [
      "kokosmælk", "kokosfløde", "mandelmælk", "havremælk", "havrefløde", "sojamælk", "sojafløde", "rismælk",
      "jordnøddesmør", "peanutbutter", "peanut butter", "kakaosmør", "cocoa butter", "shea", "coconut milk",
      "coconut cream", "almond milk", "oat milk", "soy milk", "smørbønne", "butter bean", "ostindien",
    ],
    freeMarkers: ["mælkefri", "dairy-free", "dairy free", ...PLANT_MARKERS],
  },
  nuts: {
    terms: [
      "hasselnød", "valnød", "cashew", "mandel", "mandler", "pistacie", "pekan", "paranød", "macadamia",
      "^nød", "^nuts?$", "walnut", "hazelnut", "almond", "pecan", "pistachio", "marcipan", "marzipan",
      "nougat", "praline",
    ],
    exclude: ["muskatnød", "jordnød", "kokosnød", "nutmeg", "peanut", "coconut"],
  },
  celery: { terms: ["selleri", "celery", "celeriac"] },
  mustard: { terms: ["sennep", "mustard", "dijon"] },
  "sesame-seeds": { terms: ["sesam", "tahin", "sesame", "hummus"] },
  "sulphur-dioxide-and-sulphites": {
    terms: [
      "sulfit", "svovldioxid", "sulphite", "sulfite", "^e220", "^e221", "^e222", "^e223", "^e224", "^e226", "^e227", "^e228", "^vin$", "vin$", "^wine", "balsamico",
      "vineddike",
    ],
  },
  lupin: { terms: ["lupin"] },
  molluscs: {
    terms: ["musling", "blæksprutte", "squid", "calamar", "østers", "^snegl", "mussel", "^clams?$", "oyster", "octopus", "scallop"],
  },
  apple: { terms: ["æble", "^apple", "^cider", "calvados"] },
  avocado: { terms: ["avocado", "guacamole"] },
  banana: { terms: ["banan"] },
  citrus: {
    terms: ["citron", "^lime", "appelsin", "grapefrugt", "grapefruit", "mandarin", "clementin", "lemon", "^orange", "yuzu", "citrus"],
  },
  garlic: { terms: ["hvidløg", "garlic"] },
  kiwi: { terms: ["kiwi"] },
  coconut: { terms: ["kokos", "coconut"] },
  onion: { terms: ["løg", "skalot", "porre", "^onion", "shallot", "^leek", "chives"] },
  corn: { terms: ["majs", "^corn", "polenta", "maizena", "popcorn"] },
  legumes: {
    terms: ["^ært", "ærter", "kikært", "linse", "bønne", "lentil", "chickpea", "^peas?$", "^beans?$", "falafel", "hummus"],
    exclude: ["kaffebønne", "vaniljebønne", "kakaobønne"],
  },
  "red-meat": {
    terms: [
      "okse", "kalv", "svin", "^gris", "^lam$", "^lamme", "vildt", "hjort", "bacon", "skinke", "pølse", "chorizo",
      "salami", "pepperoni", "flæsk", "medister", "frikadelle", "^beef", "pork", "^lamb", "^veal", "^ham$",
      "gelatine", "gelatin", "^rådyr", "^elg", "^bøf", "^steak",
    ],
  },
  mushrooms: {
    terms: ["svamp", "champignon", "shiitake", "kantarel", "østershat", "portobello", "karljohan", "mushroom", "trøffel", "truffle"],
  },
  "stone-fruit": {
    terms: ["fersken", "nektarin", "abrikos", "blomme", "kirsebær", "^peach", "apricot", "^plums?$", "cherr", "nectarine"],
    exclude: ["æggeblomme", "blommeolie"],
  },
  strawberry: { terms: ["jordbær", "strawberr"] },
  tomato: { terms: ["tomat", "tomato", "ketchup", "passata"] },
};

// Kød uden for "rødt kød" (til vegetar/pescetar), og animalske ting ud over
// kød, fisk, mælk og æg (til vegansk).
const POULTRY = matcher(["kylling", "høns", "^and$", "^ande", "kalkun", "fjerkræ", "^gås", "chicken", "turkey", "duck", "poultry", "wachtel", "vagtel"]);
const OTHER_ANIMAL = matcher(["honning", "honey", "gelatine", "gelatin", "^lard", "svinefedt", "^fond$", "^bouillon"]);
const VEGAN_OK = matcher(["vegan", "grøntsagsbouillon", "grøntsagsfond", "vegetable stock", "vegetable broth"]);

// Ingredienser, der ofte indeholder spor af et allergen, selvom det ikke
// står i ingredienslisten (krydskontaminering i produktionen).
const TRACE_RULES: { terms: RegExp; allergens: RecipeAllergen[] }[] = [
  { terms: matcher(["chokolade", "chocolate", "kakao", "cocoa", "nutella"]), allergens: ["nuts", "peanuts", "milk"] },
  { terms: matcher(["havre", "^oat"]), allergens: ["gluten"] },
  { terms: matcher(["müsli", "musli", "muesli", "granola"]), allergens: ["nuts", "peanuts", "gluten"] },
  { terms: matcher(["^kiks", "småkage", "^kage", "cookie", "biscuit"]), allergens: ["nuts", "peanuts", "sesame-seeds", "eggs", "milk"] },
  { terms: matcher(["brød", "^bolle", "bread", "^buns?$"]), allergens: ["sesame-seeds", "nuts"] },
  { terms: matcher(["krydderiblanding", "krydderimix", "spice mix", "bouillon", "^fond$", "^stock"]), allergens: ["celery", "mustard", "gluten"] },
  { terms: matcher(["rosin", "raisin", "tørret frugt", "tørrede", "dried fruit"]), allergens: ["sulphur-dioxide-and-sulphites", "nuts"] },
  { terms: matcher(["pesto"]), allergens: ["nuts"] },
  { terms: matcher(["chips"]), allergens: ["milk", "gluten"] },
  { terms: matcher(["kerner", "^frø", "seeds"]), allergens: ["sesame-seeds", "nuts", "peanuts"] },
  { terms: matcher(["^is$", "ice cream", "flødeis"]), allergens: ["nuts", "peanuts"] },
  { terms: matcher(["dressing", "remoulade"]), allergens: ["mustard", "eggs"] },
];

// "Kan indeholde spor af …" i varedeklarationen.
const TRACE_TEXT = /(kan indeholde|spor af|may contain|traces? of)[^.;]*/giu;

const MATCHERS = Object.fromEntries(
  Object.entries(ALLERGEN_RULES).map(([key, rule]) => [
    key,
    {
      terms: matcher(rule.terms),
      exclude: rule.exclude?.length ? new RegExp(rule.exclude.map(toRegex).join("|"), "giu") : null,
      free: rule.freeMarkers?.length ? matcher(rule.freeMarkers) : null,
    },
  ]),
) as Record<RecipeAllergen, { terms: RegExp; exclude: RegExp | null; free: RegExp | null }>;

function mentions(allergen: RecipeAllergen, text: string) {
  const m = MATCHERS[allergen];
  const cleaned = m.exclude ? text.replace(m.exclude, " ") : text;
  return m.terms.test(cleaned);
}

function splitTraces(text: string) {
  const traces = Array.from(text.matchAll(TRACE_TEXT), (match) => match[0]).join(" ");
  return { body: text.replace(TRACE_TEXT, " "), traces };
}

// Indeholder ingrediensen allergenet? `lactoseOnly` bruges til "laktosefri":
// laktosefri mælkeprodukter er tilladt dér, men ikke ved mælkeallergi.
function segmentContains(segment: RecipeSegment, allergen: RecipeAllergen, lactoseOnly = false) {
  if (segment.allergens.includes(allergen) && !(lactoseOnly && /laktosefri|lactose[- ]free/iu.test(segment.name))) {
    return true;
  }
  const m = MATCHERS[allergen];
  if (m.free?.test(segment.name)) return false;
  if (lactoseOnly && /laktosefri|lactose[- ]free/iu.test(segment.name)) return false;
  const { body } = splitTraces(`${segment.name} ${segment.text}`);
  return mentions(allergen, body);
}

function recipeContains(facts: RecipeFacts, allergen: RecipeAllergen) {
  if (mentions(allergen, splitTraces(facts.title).body) && !MATCHERS[allergen].free?.test(facts.title)) return true;
  return facts.segments.some((segment) => segmentContains(segment, allergen));
}

function isMeatFree(facts: RecipeFacts) {
  if (recipeContains(facts, "red-meat")) return false;
  const texts = [facts.title, ...facts.segments.map((s) => `${s.name} ${splitTraces(s.text).body}`)];
  return !texts.some((text) => POULTRY.test(text) && !VEGAN_OK.test(text));
}

function isFishFree(facts: RecipeFacts) {
  return !(["fish", "crustaceans", "molluscs"] as const).some((a) => recipeContains(facts, a));
}

// ---------------------------------------------------------------------------
// Næringsstoffer. "Højt indhold" = mindst 30 % af EU's referenceindtag (NRV,
// forordning 1169/2011) pr. 600 kcal (en typisk hovedret), fibre dog EU's
// egen grænse på 3 g pr. 100 kcal (forordning 1924/2006).
export const NUTRIENT_RULES: Record<RecipeNutrient, { perKcal: number; min: number }> = {
  fiber: { perKcal: 100, min: 3 },
  iron: { perKcal: 600, min: 14 * 0.3 },
  calcium: { perKcal: 600, min: 800 * 0.3 },
  potassium: { perKcal: 600, min: 2000 * 0.3 },
  vitaminA: { perKcal: 600, min: 800 * 0.3 },
  vitaminC: { perKcal: 600, min: 80 * 0.3 },
};

export function energyPercents(facts: Pick<RecipeFacts, "proteinG" | "carbsG" | "fatG">) {
  const protein = facts.proteinG * 4;
  const carbs = facts.carbsG * 4;
  const fat = facts.fatG * 9;
  const total = protein + carbs + fat;
  if (total <= 0) return null;
  return { protein: (protein / total) * 100, carbs: (carbs / total) * 100, fat: (fat / total) * 100 };
}

function macroOk(percent: number, key: MacroKey, level: "high" | "low") {
  const limits = MACRO_THRESHOLDS[key];
  return level === "high" ? percent >= limits.high : percent < limits.low;
}

export function needsIngredientData(filters: RecipeFilters) {
  return filters.allergens.length > 0 || filters.diets.length > 0 || filters.nutrients.length > 0;
}

export function evaluateRecipe(facts: RecipeFacts, filters: RecipeFilters): { pass: boolean; warnings: RecipeWarning[] } {
  const fail = { pass: false, warnings: [] };

  for (const allergen of filters.allergens) {
    if (recipeContains(facts, allergen)) return fail;
  }

  const split = energyPercents(facts);
  for (const diet of filters.diets) {
    if (diet === "vegan") {
      if (!isMeatFree(facts) || !isFishFree(facts)) return fail;
      if (recipeContains(facts, "milk") || recipeContains(facts, "eggs")) return fail;
      const texts = [facts.title, ...facts.segments.map((s) => `${s.name} ${splitTraces(s.text).body}`)];
      if (texts.some((text) => OTHER_ANIMAL.test(text) && !VEGAN_OK.test(text))) return fail;
    } else if (diet === "vegetarian") {
      if (!isMeatFree(facts) || !isFishFree(facts)) return fail;
    } else if (diet === "pescetarian") {
      if (!isMeatFree(facts)) return fail;
    } else if (diet === "glutenFree") {
      if (recipeContains(facts, "gluten")) return fail;
    } else if (diet === "lactoseFree") {
      if (facts.segments.some((segment) => segmentContains(segment, "milk", true))) return fail;
    } else if (diet === "keto") {
      if (!split || split.carbs > KETO_MAX_CARBS_PERCENT) return fail;
    } else if (diet === "lowSugar") {
      if (facts.sugarPer100g === null || facts.sugarPer100g > LOW_SUGAR_MAX_PER_100G) return fail;
    }
  }

  for (const key of MACRO_KEYS) {
    const level = filters.macros[key];
    if (level && (!split || !macroOk(split[key], key, level))) return fail;
  }

  for (const nutrient of filters.nutrients) {
    const amount = facts.nutrients[nutrient];
    const rule = NUTRIENT_RULES[nutrient];
    if (amount === null || amount === undefined || facts.kcal <= 0) return fail;
    if ((amount / facts.kcal) * rule.perKcal < rule.min) return fail;
  }

  // Advarsler: kun for de allergener, brugeren har valgt, og kun for
  // ingredienser, der ikke allerede har frasorteret retten.
  const warnings: RecipeWarning[] = [];
  const seen = new Set<string>();
  const add = (ingredient: string, allergen: RecipeAllergen) => {
    const key = `${ingredient.toLowerCase()}|${allergen}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push({ ingredient, allergen });
  };
  for (const segment of facts.segments) {
    const { traces } = splitTraces(segment.text);
    for (const allergen of filters.allergens) {
      if (traces && mentions(allergen, traces)) add(segment.name, allergen);
    }
    for (const rule of TRACE_RULES) {
      if (!rule.terms.test(segment.name)) continue;
      for (const allergen of rule.allergens) {
        if (filters.allergens.includes(allergen)) add(segment.name, allergen);
      }
    }
  }
  return { pass: true, warnings: warnings.slice(0, 3) };
}
