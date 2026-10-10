import data from "@/data/kitchen-conversions.json";
import {
  findConversionIn,
  formatKitchenNumber,
  gramsToMeasure,
  volumeToGrams,
  type KitchenConversion,
  type KitchenConversionGroup,
} from "@/lib/kitchen-conversion-units";

// Omregningstabellen væsker (og tørvarer målt i dl) → gram (brugerens krav
// 2026-10-10). Vises under Viden om mad → Omregning (/viden-om/omregning) og
// bruges, når en ret skiftes mellem mål (dl, spsk) og gram. Native henter den
// samme tabel via GET /api/kitchen-conversions.

export const KITCHEN_CONVERSION_GROUPS: KitchenConversionGroup[] = data.groups;
export const KITCHEN_CONVERSIONS: KitchenConversion[] = data.items;

export function findKitchenConversion(name: string | null | undefined): KitchenConversion | null {
  return findConversionIn(KITCHEN_CONVERSIONS, name);
}

// "2 dl" sødmælk → "206 g". Null, når mængden ikke kan omregnes (ukendt vare
// eller enhed som stk/fed/g).
export function measureAsGramsText(amount: number | null, unit: string | null, name: string): string | null {
  if (amount === null) return null;
  const item = findKitchenConversion(name);
  const grams = item ? volumeToGrams(amount, unit, item) : null;
  return grams === null ? null : `${formatKitchenNumber(Math.round(grams), 0)} g`;
}

// 206 g sødmælk → "2 dl". Null, når varen ikke står i tabellen.
export function gramsAsMeasureText(grams: number, name: string): string | null {
  const item = findKitchenConversion(name);
  const measure = item ? gramsToMeasure(grams, item) : null;
  return measure ? `${formatKitchenNumber(measure.amount)} ${measure.unit}` : null;
}
