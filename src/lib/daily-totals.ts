// Aggregates registrations into daily totals, shared by Statistics and the key-metrics wheel.

export type RegistrationTotals = {
  kcalSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot?: number;
  fatSnapshot?: number;
  // Only present for products with matching Product.nutritionExtra data
  // (currently HelloFresh recipes only, see docs/DECISIONS.md 2026-08-29).
  sugarSnapshot?: number | null;
  fiberSnapshot?: number | null;
  saltSnapshot?: number | null;
  potassiumSnapshot?: number | null;
  calciumSnapshot?: number | null;
  ironSnapshot?: number | null;
  // MyFitnessPal-style extended panel (2026-09-11) — only present for
  // products sourced from Open Food Facts so far, see src/lib/openFoodFacts.ts.
  saturatedFatSnapshot?: number | null;
  unsaturatedFatSnapshot?: number | null;
  transFatSnapshot?: number | null;
  cholesterolSnapshot?: number | null;
  vitaminASnapshot?: number | null;
  vitaminCSnapshot?: number | null;
  createdAt: string;
};

export type DailyTotal = {
  dateKey: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  salt: number;
  potassium: number;
  calcium: number;
  iron: number;
  saturatedFat: number;
  unsaturatedFat: number;
  transFat: number;
  cholesterol: number;
  vitaminA: number;
  vitaminC: number;
};

function dateKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function emptyTotal(key: string): DailyTotal {
  return {
    dateKey: key,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
    fiber: 0,
    salt: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    saturatedFat: 0,
    unsaturatedFat: 0,
    transFat: 0,
    cholesterol: 0,
    vitaminA: 0,
    vitaminC: 0,
  };
}

export function groupByDay(registrations: RegistrationTotals[]): DailyTotal[] {
  const byDay = new Map<string, DailyTotal>();

  for (const registration of registrations) {
    const key = dateKey(registration.createdAt);
    const total = byDay.get(key) ?? emptyTotal(key);
    total.kcal += registration.kcalSnapshot;
    total.protein += registration.proteinSnapshot;
    total.carbs += registration.carbsSnapshot ?? 0;
    total.fat += registration.fatSnapshot ?? 0;
    total.sugar += registration.sugarSnapshot ?? 0;
    total.fiber += registration.fiberSnapshot ?? 0;
    total.salt += registration.saltSnapshot ?? 0;
    total.potassium += registration.potassiumSnapshot ?? 0;
    total.calcium += registration.calciumSnapshot ?? 0;
    total.iron += registration.ironSnapshot ?? 0;
    total.saturatedFat += registration.saturatedFatSnapshot ?? 0;
    total.unsaturatedFat += registration.unsaturatedFatSnapshot ?? 0;
    total.transFat += registration.transFatSnapshot ?? 0;
    total.cholesterol += registration.cholesterolSnapshot ?? 0;
    total.vitaminA += registration.vitaminASnapshot ?? 0;
    total.vitaminC += registration.vitaminCSnapshot ?? 0;
    byDay.set(key, total);
  }

  return Array.from(byDay.values());
}

export function withinLastDays(registrations: RegistrationTotals[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return registrations.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}
