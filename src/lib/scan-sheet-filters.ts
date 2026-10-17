// Arkenes `_is_`-værdier læst ud af en nyscannet vares forsidetekst (bruger
// 2026-10-17). Ren funktion — gemmes af src/lib/scan-sheet-rules.ts.

import { splitOffProduct, type OffSplitFilters, type VocabIndex } from "./off-name-split.ts";

export type ScannedFrontText = {
  productName?: string | null;
  variant?: string | null;
  brand?: string | null;
  packageSizeText?: string | null;
  /** Påstande på forsiden ("Økologisk", "Vegansk", "Uden tilsat sukker" …). */
  claims?: readonly string[] | null;
  ingredientsText?: string | null;
};

// Samme værdier som butiksimporten (scripts/store-products-import/build_data.py).
export type SheetFilterValues = {
  organic: string | null;
  glutenFree: string | null;
  lactoseFree: string | null;
  sugarFree: string | null;
  noAddedSugar: string | null;
  vegan: string | null;
  vegetarian: string | null;
  meatType: string | null;
  alcohol: string | null;
  alcoholPercent: number | null;
  fatPercent: number | null;
  countryOfOrigin: string | null;
  wholeGrain: string | null;
  storage: string | null;
  lightSugar: string | null;
  certifications: string[];
  animalWelfare: string[];
};

function filtersFrom(f: OffSplitFilters, keywords: string[]): SheetFilterValues {
  return {
    organic: f.organic,
    glutenFree: f.glutenFree,
    lactoseFree: f.lactoseFree,
    sugarFree: f.sugarFree,
    noAddedSugar: f.noAddedSugar,
    vegan: f.vegan,
    vegetarian: f.vegetarian,
    meatType: f.meatType,
    alcohol: f.alcohol,
    alcoholPercent: f.alcoholPercent,
    fatPercent: f.fatPercent,
    countryOfOrigin: f.countryOfOrigin,
    wholeGrain: f.wholeGrain,
    storage: f.storage,
    lightSugar: keywords.includes("light") ? "Light" : null,
    certifications: f.certifications,
    animalWelfare: f.animalWelfare,
  };
}

/** Arkenes `_is_`-værdier læst ud af forsidens tekst. Ren funktion (testbar). */
export function sheetFiltersFromFront(input: ScannedFrontText, vocab: VocabIndex): SheetFilterValues {
  const parts = [input.productName, input.variant, ...(input.claims ?? [])]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const split = splitOffProduct(
    {
      name: parts.join(" "),
      brands: input.brand ?? null,
      quantity: input.packageSizeText ?? null,
      ingredientsText: input.ingredientsText ?? null,
      lang: "da",
      hasDanishName: true,
    },
    vocab,
  );
  return filtersFrom(split.filters, split.keywords);
}

