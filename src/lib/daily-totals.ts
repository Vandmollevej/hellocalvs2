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
  // Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): alle næringsstoffer fra
  // src/lib/nutrients.ts, estimeret andel og producentens ±. Når de findes,
  // har de forrang for de enkelte *Snapshot-felter ovenfor.
  nutrientSnapshot?: Record<string, number>;
  nutrientEstimatedSnapshot?: Record<string, number>;
  nutrientToleranceSnapshot?: Record<string, number>;
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
  // Summer pr. næringsstof-nøgle (src/lib/nutrients.ts) — inkl. de navngivne
  // felter ovenfor — samt hvor meget af summen der er estimeret, og summen
  // af producenternes egne ±.
  nutrients: Record<string, number>;
  nutrientsEstimated: Record<string, number>;
  nutrientsTolerance: Record<string, number>;
};

// Ældre registreringers enkeltfelter → næringsstof-nøgle.
const LEGACY_SNAPSHOT_FIELDS = {
  sugar: "sugarSnapshot",
  fiber: "fiberSnapshot",
  salt: "saltSnapshot",
  potassium: "potassiumSnapshot",
  calcium: "calciumSnapshot",
  iron: "ironSnapshot",
  saturatedFat: "saturatedFatSnapshot",
  unsaturatedFat: "unsaturatedFatSnapshot",
  transFat: "transFatSnapshot",
  cholesterol: "cholesterolSnapshot",
  vitaminA: "vitaminASnapshot",
  vitaminC: "vitaminCSnapshot",
} as const satisfies Record<string, keyof RegistrationTotals>;

type LegacyKey = keyof typeof LEGACY_SNAPSHOT_FIELDS;

function add(target: Record<string, number>, key: string, value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  target[key] = (target[key] ?? 0) + value;
}

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
    nutrients: {},
    nutrientsEstimated: {},
    nutrientsTolerance: {},
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
    const snapshot = registration.nutrientSnapshot;
    const legacyKeys = new Set<string>(Object.keys(LEGACY_SNAPSHOT_FIELDS));
    for (const key of legacyKeys) {
      const legacy = registration[LEGACY_SNAPSHOT_FIELDS[key as LegacyKey]] as number | null | undefined;
      add(total.nutrients, key, snapshot && key in snapshot ? snapshot[key] : legacy);
    }
    for (const [key, value] of Object.entries(snapshot ?? {})) {
      if (!legacyKeys.has(key)) add(total.nutrients, key, value);
    }
    for (const [key, value] of Object.entries(registration.nutrientEstimatedSnapshot ?? {})) {
      add(total.nutrientsEstimated, key, value);
    }
    for (const [key, value] of Object.entries(registration.nutrientToleranceSnapshot ?? {})) {
      add(total.nutrientsTolerance, key, value);
    }
    byDay.set(key, total);
  }

  for (const total of byDay.values()) {
    for (const key of Object.keys(LEGACY_SNAPSHOT_FIELDS) as LegacyKey[]) {
      total[key] = total.nutrients[key] ?? 0;
    }
  }

  return Array.from(byDay.values());
}

export function withinLastDays(registrations: RegistrationTotals[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return registrations.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}
