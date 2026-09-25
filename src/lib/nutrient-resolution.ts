import { prisma } from "@/lib/prisma";
import { matchFridaProduct } from "@/lib/generic-ingredient-match";
import {
  NUTRIENTS,
  asNumberRecord,
  isEstimatedSource,
  isNutrientKey,
  type NutrientKey,
  type ResolvedNutrient,
} from "@/lib/nutrients";

// Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): samler et produkts
// næringsstoffer ud over de fire makroer til én liste pr. 100 g, og markerer
// hvilke der er estimerede.
//
// - Producentens egne tal (varedeklaration/producentdata/Open Food Facts)
//   og Frida på selve den generiske vare er sikre → ingen ~.
// - Mangler producenten et felt, lånes værdien fra den nærmeste Frida-vare
//   → estimeret (~). Det er den eneste kilde til estimater i dag.
// - Producentens egen ± (nutrientTolerances) sendes med 1:1; vi beregner
//   aldrig selv en ±.

type ProductForResolution = {
  name: string;
  productType?: string | null;
  brand?: { name: string } | null;
  externalSource?: string | null;
  servingSizeGrams?: number | null;
  nutritionExtra?: unknown;
  saturatedFatPer100g?: number | null;
  unsaturatedFatPer100g?: number | null;
  transFatPer100g?: number | null;
  cholesterolPer100g?: number | null;
  vitaminAPer100g?: number | null;
  vitaminCPer100g?: number | null;
  micronutrientsPer100g?: unknown;
  nutrientSources?: unknown;
  nutrientTolerances?: unknown;
  nutritionFeatures?: {
    sugarsPer100g: number | null;
    sugarSource: string | null;
    fiberPer100g: number | null;
    fiberSource: string | null;
    saltPer100g: number | null;
    saltSource: string | null;
  } | null;
};

type FridaReference = {
  id: string;
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  micronutrients: Record<string, number>;
};

// Frida-listen (et par tusinde rækker) ændrer sig kun ved en ny Frida-
// version, så den holdes i hukommelsen i en time frem for at blive hentet
// ved hvert produktopslag.
const FRIDA_CACHE_MS = 60 * 60 * 1000;
let fridaCache: { loadedAt: number; references: FridaReference[] } | null = null;

async function loadFridaReferences(): Promise<FridaReference[]> {
  if (fridaCache && Date.now() - fridaCache.loadedAt < FRIDA_CACHE_MS) return fridaCache.references;
  const rows = await prisma.product.findMany({
    where: { externalSource: "FRIDA" },
    select: {
      id: true,
      name: true,
      kcalPer100g: true,
      proteinPer100g: true,
      carbsPer100g: true,
      fatPer100g: true,
      micronutrientsPer100g: true,
    },
  });
  const references = rows
    .map(({ micronutrientsPer100g, ...row }) => ({ ...row, micronutrients: asNumberRecord(micronutrientsPer100g) }))
    .filter((row) => Object.keys(row.micronutrients).length > 0);
  fridaCache = { loadedAt: Date.now(), references };
  return references;
}

// Den del af navnet, en Frida-vare deler med en mærkevare: produkttypen
// (fx "Skyr") hvis den kendes, ellers navnet uden mærket.
function fridaQueryFor(product: ProductForResolution): string {
  if (product.productType?.trim()) return product.productType.trim();
  const brand = product.brand?.name?.trim();
  let name = product.name;
  if (brand) name = name.replace(new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "");
  return name.replace(/\d+([.,]\d+)?\s*(g|kg|ml|cl|l)\b/gi, "").trim();
}

// nutritionExtra er pr. produktets egen portion (HelloFresh), ikke pr. 100 g.
const EXTRA_KEYS: Record<string, NutrientKey> = {
  sugarG: "sugar",
  fiberG: "fiber",
  saltG: "salt",
  potassiumMg: "potassium",
  calciumMg: "calcium",
  ironMg: "iron",
};

function ownValues(product: ProductForResolution) {
  const values: Partial<Record<NutrientKey, number>> = {};
  const featureSources: Partial<Record<NutrientKey, string>> = {};

  const extra = asNumberRecord(product.nutritionExtra);
  if (product.servingSizeGrams && product.servingSizeGrams > 0) {
    for (const [extraKey, key] of Object.entries(EXTRA_KEYS)) {
      if (extra[extraKey] !== undefined) values[key] = (extra[extraKey] * 100) / product.servingSizeGrams;
    }
  }

  const features = product.nutritionFeatures;
  if (features) {
    const pairs: [NutrientKey, number | null, string | null][] = [
      ["sugar", features.sugarsPer100g, features.sugarSource],
      ["fiber", features.fiberPer100g, features.fiberSource],
      ["salt", features.saltPer100g, features.saltSource],
    ];
    for (const [key, value, source] of pairs) {
      if (value === null) continue;
      values[key] = value;
      if (source === "AI_INTERPRETATION") featureSources[key] = "AI";
    }
  }

  const columns: [NutrientKey, number | null | undefined][] = [
    ["saturatedFat", product.saturatedFatPer100g],
    ["unsaturatedFat", product.unsaturatedFatPer100g],
    ["transFat", product.transFatPer100g],
    ["cholesterol", product.cholesterolPer100g],
    ["vitaminA", product.vitaminAPer100g],
    ["vitaminC", product.vitaminCPer100g],
  ];
  for (const [key, value] of columns) if (typeof value === "number") values[key] = value;

  for (const [key, value] of Object.entries(asNumberRecord(product.micronutrientsPer100g))) {
    if (isNutrientKey(key)) values[key] = value;
  }

  return { values, featureSources };
}

export async function resolveProductNutrients(product: ProductForResolution): Promise<ResolvedNutrient[]> {
  const { values, featureSources } = ownValues(product);
  const sources = product.nutrientSources && typeof product.nutrientSources === "object"
    ? (product.nutrientSources as Record<string, string>)
    : {};
  const tolerances = asNumberRecord(product.nutrientTolerances);

  const isReference = product.externalSource === "FRIDA";
  const missing = NUTRIENTS.some((n) => values[n.key] === undefined);
  let borrowed: Record<string, number> = {};
  if (!isReference && missing) {
    const query = fridaQueryFor(product);
    const match = query ? matchFridaProduct(query, await loadFridaReferences()) : null;
    borrowed = match?.micronutrients ?? {};
  }

  const resolved: ResolvedNutrient[] = [];
  for (const { key } of NUTRIENTS) {
    const own = values[key];
    if (own !== undefined) {
      resolved.push({
        key,
        per100g: own,
        estimated: isEstimatedSource(sources[key] ?? featureSources[key]),
        tolerancePer100g: tolerances[key] ?? null,
      });
    } else if (borrowed[key] !== undefined) {
      resolved.push({ key, per100g: borrowed[key], estimated: true, tolerancePer100g: null });
    }
  }
  return resolved;
}

// Generisk ingrediens: Frida-data på selve varen er sikre (ingen ~).
export async function resolveGenericIngredientNutrients(ingredient: {
  micronutrientsPer100g?: unknown;
  fridaProductId?: string | null;
}): Promise<ResolvedNutrient[]> {
  let micros = asNumberRecord(ingredient.micronutrientsPer100g);
  if (Object.keys(micros).length === 0 && ingredient.fridaProductId) {
    const frida = await prisma.product.findUnique({
      where: { id: ingredient.fridaProductId },
      select: { micronutrientsPer100g: true },
    });
    micros = asNumberRecord(frida?.micronutrientsPer100g);
  }
  return NUTRIENTS.filter((n) => micros[n.key] !== undefined).map((n) => ({
    key: n.key,
    per100g: micros[n.key],
    estimated: false,
    tolerancePer100g: null,
  }));
}
