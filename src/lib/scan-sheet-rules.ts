// Arkenes regler på nyscannede varer (bruger 2026-10-17): det, butiksarkene
// lægger i `_is_`-kolonnerne (økologisk, vegansk, glutenfri, laktosefri,
// sukkerfri/uden tilsat sukker, fuldkorn, frost, koffeinfri, alkoholfri,
// fedt-% og alkohol-%, oprindelsesland, kødtype, MSC/ASC/Fairtrade …), læses
// nu også ud af forsidens tekst, når en vare scannes. Reglerne er de samme som
// Open Food Facts-opdelerens (src/lib/off-name-split.ts), der følger arkene
// (Excelark/NAVNEREGLER.md). Kun tomme felter udfyldes — et mærkelogo eller
// en admins rettelse overskrives aldrig.

import { prisma } from "@/lib/prisma";
import { sheetFiltersFromFront, type ScannedFrontText } from "@/lib/scan-sheet-filters";
import { getOffVocabBase } from "@/lib/off-vocab";

const SCALAR_KEYS = [
  "organic", "glutenFree", "lactoseFree", "sugarFree", "noAddedSugar", "vegan", "vegetarian", "meatType",
  "alcohol", "alcoholPercent", "fatPercent", "countryOfOrigin", "wholeGrain", "storage", "lightSugar",
] as const;

/** Gemmer værdierne på varen; kun felter, der er tomme, udfyldes. Returnerer de udfyldte felter. */
export async function applySheetRulesToScannedProduct(productId: string, input: ScannedFrontText): Promise<string[]> {
  const read = sheetFiltersFromFront(input, getOffVocabBase());
  const existing = await prisma.productFilters.findUnique({ where: { productId } });
  const data: Record<string, unknown> = {};
  for (const key of SCALAR_KEYS) {
    const value = read[key];
    if (value !== null && (existing?.[key] ?? null) === null) data[key] = value;
  }
  for (const key of ["certifications", "animalWelfare"] as const) {
    const merged = Array.from(new Set([...(existing?.[key] ?? []), ...read[key]]));
    if (merged.length !== (existing?.[key]?.length ?? 0)) data[key] = merged;
  }
  const filled = Object.keys(data);
  if (filled.length === 0) return [];
  await prisma.productFilters.upsert({ where: { productId }, update: data, create: { productId, ...data } });
  return filled;
}
