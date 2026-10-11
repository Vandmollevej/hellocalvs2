// Open Food Facts-vare → felterne i vores tabeller (docs/DECISIONS.md 2026-10-11).
//
// Ren logik uden database (kan testes med `node --test`):
//  - pickOffRaw: de felter af OFF's svar, vi gemmer uændret (off_products.raw)
//  - offSplitInputFromRaw: input til navne-opdeleren (src/lib/off-name-split.ts)
//  - offNutritionFromRaw: næring pr. 100 g/ml i vores enheder (products +
//    product_nutrition_features + products.micronutrientsPer100g)
//  - productFiltersFromOff: ProductFilters-formen (tabel 3)
//  - buildOffRecordData: kolonnerne i off_products

import { OFF_SPLIT_VERSION, type OffSplitInput, type OffSplitResult } from "./off-name-split.ts";
import { certificationFiltersFromLabels, offLabelNames } from "./label-certifications.ts";

export type OffRaw = Record<string, unknown>;

// Felterne vi beder OFF om og gemmer. Samme liste som Excelark/off_hent.py
// (+ de to portionsfelter og additiver, som scanningen bruger).
export const OFF_RAW_KEYS = [
  "code", "product_name", "product_name_da", "generic_name", "generic_name_da", "brands", "brands_tags",
  "quantity", "product_quantity", "product_quantity_unit", "categories", "categories_tags", "categories_old",
  "labels", "labels_tags", "allergens_tags", "traces_tags", "ingredients_text", "ingredients_text_da",
  "ingredients_analysis_tags", "countries_tags", "stores", "stores_tags", "origins", "origins_tags",
  "manufacturing_places", "packaging", "packaging_tags", "nutriments", "image_front_url", "image_url",
  "url", "states_tags", "nova_group", "nutriscore_grade", "last_modified_t", "lang", "serving_size",
  "serving_quantity", "additives_tags",
] as const;

export function pickOffRaw(product: OffRaw): OffRaw {
  const out: OffRaw = {};
  for (const key of OFF_RAW_KEYS) {
    const value = product[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    out[key] = value;
  }
  return out;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function offSplitInputFromRaw(raw: OffRaw, opts: { translatedName?: string | null } = {}): OffSplitInput {
  const da = str(raw.product_name_da);
  // oversat navn (scanningen oversætter fremmedsprog) ligger som _translated_name i det gemte svar
  const translated = str(opts.translatedName) ?? str(raw._translated_name);
  return {
    name: translated ?? da ?? str(raw.product_name),
    genericName: str(raw.generic_name_da) ?? str(raw.generic_name),
    brands: str(raw.brands),
    quantity: str(raw.quantity),
    productQuantity: typeof raw.product_quantity === "number" || typeof raw.product_quantity === "string" ? raw.product_quantity : null,
    productQuantityUnit: str(raw.product_quantity_unit),
    categoriesText: str(raw.categories),
    categoriesTags: strArray(raw.categories_tags),
    labelsTags: strArray(raw.labels_tags),
    allergensTags: strArray(raw.allergens_tags),
    ingredientsText: str(raw.ingredients_text_da) ?? str(raw.ingredients_text),
    packagingTags: strArray(raw.packaging_tags),
    originsTags: strArray(raw.origins_tags),
    nutriments: (raw.nutriments as Record<string, unknown> | null) ?? null,
    lang: str(raw.lang),
    hasDanishName: Boolean(da),
    translated: Boolean(translated),
    ingredientsAnalysisTags: strArray(raw.ingredients_analysis_tags),
  };
}

// ---------------------------------------------------------------- næring

export type OffNutrition = {
  basis: "100g" | "100ml";
  kcal: number | null;
  kj: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  saturatedFat: number | null;
  monounsaturatedFat: number | null;
  polyunsaturatedFat: number | null;
  transFat: number | null;
  sugars: number | null;
  fiber: number | null;
  salt: number | null;
  /** mg */
  sodium: number | null;
  /** g/100 g */
  alcohol: number | null;
  /** produktkatalogets nøgler og enheder (src/lib/nutrients.ts) */
  micronutrients: Record<string, number>;
};

function numberOf(n: Record<string, unknown>, key: string): number | null {
  const v = n[key];
  const value = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

// OFF's `<næringsstof>_100g` er ALTID gram pr. 100 g (uanset `_unit`, som kun er den
// enhed, etiketten brugte) — målt mod live-API 2026-10-11 (calcium_100g 0.158 = 158 mg).
// Energi er kJ/kcal.
const MICRO: [offKey: string, key: string, unit: "mg" | "µg"][] = [
  ["vitamin-a", "vitaminA", "µg"], ["vitamin-c", "vitaminC", "mg"], ["vitamin-d", "vitaminD", "µg"],
  ["vitamin-e", "vitaminE", "mg"], ["vitamin-k", "vitaminK", "µg"], ["vitamin-b1", "vitaminB1", "mg"],
  ["vitamin-b2", "vitaminB2", "mg"], ["vitamin-pp", "vitaminB3", "mg"], ["pantothenic-acid", "vitaminB5", "mg"],
  ["vitamin-b6", "vitaminB6", "mg"], ["biotin", "vitaminB7", "µg"], ["vitamin-b9", "vitaminB9", "µg"],
  ["vitamin-b12", "vitaminB12", "µg"], ["potassium", "potassium", "mg"], ["calcium", "calcium", "mg"],
  ["magnesium", "magnesium", "mg"], ["iron", "iron", "mg"], ["zinc", "zinc", "mg"], ["copper", "copper", "mg"],
  ["manganese", "manganese", "mg"], ["selenium", "selenium", "µg"], ["phosphorus", "phosphorus", "mg"],
  ["iodine", "iodine", "µg"], ["cholesterol", "cholesterol", "mg"],
];

const round = (v: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export function offNutritionFromRaw(raw: OffRaw): OffNutrition | null {
  const n = (raw.nutriments as Record<string, unknown> | null) ?? null;
  if (!n || typeof n !== "object") return null;
  const kcal = numberOf(n, "energy-kcal_100g");
  const kj = numberOf(n, "energy-kj_100g") ?? numberOf(n, "energy_100g");
  const protein = numberOf(n, "proteins_100g");
  const carbs = numberOf(n, "carbohydrates_100g");
  const fat = numberOf(n, "fat_100g");
  if (kcal === null && kj === null && protein === null && carbs === null && fat === null) return null;
  const unit = String(raw.product_quantity_unit ?? "").toLowerCase();
  const quantity = String(raw.quantity ?? "").toLowerCase();
  const liquid = /(^|\d|\s)(ml|cl|dl|l|ltr|liter)\b/.test(quantity) || ["ml", "l", "cl"].includes(unit);
  const micronutrients: Record<string, number> = {};
  for (const [offKey, key, target] of MICRO) {
    const grams = numberOf(n, `${offKey}_100g`);
    if (grams === null) continue;
    micronutrients[key] = round(target === "mg" ? grams * 1000 : grams * 1_000_000, 4);
  }
  const sodiumG = numberOf(n, "sodium_100g");
  if (sodiumG !== null) micronutrients.sodium = round(sodiumG * 1000, 2);
  return {
    basis: liquid ? "100ml" : "100g",
    kcal,
    kj,
    protein,
    carbs,
    fat,
    saturatedFat: numberOf(n, "saturated-fat_100g"),
    monounsaturatedFat: numberOf(n, "monounsaturated-fat_100g"),
    polyunsaturatedFat: numberOf(n, "polyunsaturated-fat_100g"),
    transFat: numberOf(n, "trans-fat_100g"),
    sugars: numberOf(n, "sugars_100g"),
    fiber: numberOf(n, "fiber_100g"),
    salt: numberOf(n, "salt_100g"),
    sodium: sodiumG !== null ? round(sodiumG * 1000, 2) : null,
    alcohol: numberOf(n, "alcohol_100g"),
    micronutrients,
  };
}

// ---------------------------------------------------------------- filtre (tabel 3)

export type OffProductFiltersData = {
  organic: string | null;
  glutenFree: string | null;
  lactoseFree: string | null;
  sugarFree: string | null;
  lowSugar: string | null;
  noAddedSugar: string | null;
  reducedSugar: string | null;
  lightSugar: string | null;
  sweeteners: string | null;
  vegan: string | null;
  vegetarian: string | null;
  meatType: string | null;
  alcohol: string | null;
  alcoholPercent: number | null;
  fatPercent: number | null;
  countryOfOrigin: string | null;
  wholeGrain: string | null;
  keyhole: string | null;
  animalWelfare: string[];
  certifications: string[];
  storage: string | null;
  size: string | null;
  toxins: string[];
};

const LOW_SUGAR_SOLID_G = 5.0;
const LOW_SUGAR_DRINK_G = 2.5;

export function productFiltersFromOff(split: OffSplitResult, raw: OffRaw, nutrition: OffNutrition | null): OffProductFiltersData {
  const f = split.filters;
  const certs = certificationFiltersFromLabels(offLabelNames(raw.labels_tags));
  const animalWelfare = Array.from(new Set([...certs.animalWelfare, ...f.animalWelfare]));
  const sugars = nutrition?.sugars ?? null;
  const isDrink = nutrition?.basis === "100ml";
  const limit = isDrink ? LOW_SUGAR_DRINK_G : LOW_SUGAR_SOLID_G;
  const lowSugar = f.sugarFree || (sugars !== null && sugars <= limit) ? "Lavt sukkerindhold" : null;
  return {
    organic: certs.organic ?? f.organic,
    glutenFree: f.glutenFree,
    lactoseFree: f.lactoseFree,
    sugarFree: f.sugarFree,
    lowSugar,
    noAddedSugar: f.noAddedSugar,
    reducedSugar: null,
    lightSugar: split.keywords.includes("light") ? "Light" : null,
    sweeteners: f.sweeteners ? "Sødemidler" : null,
    vegan: f.vegan,
    vegetarian: f.vegetarian,
    meatType: f.meatType,
    alcohol: f.alcohol,
    alcoholPercent: f.alcoholPercent,
    fatPercent: f.fatPercent,
    countryOfOrigin: f.countryOfOrigin,
    wholeGrain: certs.wholeGrain ?? f.wholeGrain,
    keyhole: certs.keyhole,
    animalWelfare,
    certifications: Array.from(new Set([...certs.certifications, ...f.certifications])),
    storage: f.storage,
    size: null,
    toxins: [],
  };
}

// ---------------------------------------------------------------- off_products

export type OffRecordData = {
  barcode: string;
  lang: string | null;
  offModifiedAt: Date | null;
  raw: OffRaw;
  rawName: string | null;
  rawBrands: string | null;
  rawQuantity: string | null;
  rawCategories: string | null;
  imageUrl: string | null;
  name: string | null;
  brand: string | null;
  brandKnown: boolean;
  extraBrands: string[];
  subbrand: string | null;
  productType: string | null;
  productTypePlural: string | null;
  variant: string | null;
  keywords: string[];
  packaging: string | null;
  category: string | null;
  packageSizeText: string | null;
  packCount: number | null;
  filters: OffProductFiltersData;
  nutrition: OffNutrition | null;
  splitConfidence: number;
  splitIssues: string[];
  splitFields: OffSplitResult["fieldScores"];
  splitLanguage: string;
  splitVersion: number;
  splitAt: Date;
};

export function buildOffRecordData(args: { barcode: string; raw: OffRaw; split: OffSplitResult }): OffRecordData {
  const { barcode, raw, split } = args;
  const nutrition = offNutritionFromRaw(raw);
  const modified = typeof raw.last_modified_t === "number" ? new Date(raw.last_modified_t * 1000) : null;
  return {
    barcode,
    lang: str(raw.lang),
    offModifiedAt: modified && !Number.isNaN(modified.getTime()) ? modified : null,
    raw,
    rawName: str(raw.product_name_da) ?? str(raw.product_name),
    rawBrands: str(raw.brands),
    rawQuantity: str(raw.quantity),
    rawCategories: str(raw.categories),
    imageUrl: str(raw.image_front_url) ?? str(raw.image_url),
    name: split.title || null,
    brand: split.brand,
    brandKnown: split.brandKnown,
    extraBrands: split.extraBrands,
    subbrand: split.subbrand,
    productType: split.productType,
    productTypePlural: split.productTypePlural,
    variant: split.variant,
    keywords: split.keywords,
    packaging: split.packaging,
    category: split.category,
    packageSizeText: split.quantityText,
    packCount: split.packCount,
    filters: productFiltersFromOff(split, raw, nutrition),
    nutrition,
    splitConfidence: split.confidence,
    splitIssues: split.issues,
    splitFields: split.fieldScores,
    splitLanguage: split.language,
    splitVersion: OFF_SPLIT_VERSION,
    splitAt: new Date(),
  };
}

// Hvor sikker opdelingen skal være, før den bruges på selve varen (Product).
// Under grænsen beholdes OFF's navn, og kun mærket (fra OFF's brands) udfyldes.
export const OFF_USE_FIELDS_MIN_CONFIDENCE = 45;
export const OFF_USE_NAME_MIN_CONFIDENCE = 60;
