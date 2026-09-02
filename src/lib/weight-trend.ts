// AI-estimated "trend weight" (docs/SPECIFICATION.md §5: "Weight display works
// with Measured weight, Trend weight (AI-calculated) and Expected weight").
// Always computed on-the-fly from WeightEntry — never stored as its own row, so
// measured data isn't contaminated.
//
// Method: separate exponentially smoothed averages for morning and evening
// weigh-ins (the user's own daily fluctuation pattern), with a small fixed
// deduction when food has been logged close to the weigh-in time (food
// typically weighs 0.3-0.6 kg temporarily). This is lightweight statistics, not
// an ML model — see docs/DECISIONS.md.

export type WeightSample = {
  weightKg: number;
  weighedAt: string;
  timeOfDay: "MORNING" | "EVENING" | "UNKNOWN";
};

export type MealSample = {
  createdAt: string;
};

export type TrendPoint = {
  dateKey: string;
  trendKg: number;
};

export const MIN_TREND_SAMPLES = 5;
const SMOOTHING_ALPHA = 0.3;
const MEAL_PROXIMITY_MS = 2 * 60 * 60 * 1000;
const MEAL_ADJUSTMENT_KG = 0.4;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function ema(previous: number | null, value: number) {
  return previous === null ? value : SMOOTHING_ALPHA * value + (1 - SMOOTHING_ALPHA) * previous;
}

/** Returns null if there isn't enough data yet for a reliable estimate. */
export function computeTrendWeight(entries: WeightSample[], meals: MealSample[] = []): TrendPoint[] | null {
  if (entries.length < MIN_TREND_SAMPLES) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(a.weighedAt).getTime() - new Date(b.weighedAt).getTime(),
  );

  let morningEma: number | null = null;
  let eveningEma: number | null = null;
  let otherEma: number | null = null;
  const points: TrendPoint[] = [];

  for (const entry of sorted) {
    const weighedAt = new Date(entry.weighedAt);
    const nearMeal = meals.some(
      (meal) => Math.abs(new Date(meal.createdAt).getTime() - weighedAt.getTime()) <= MEAL_PROXIMITY_MS,
    );
    const adjustedWeight = nearMeal ? entry.weightKg - MEAL_ADJUSTMENT_KG : entry.weightKg;

    if (entry.timeOfDay === "MORNING") morningEma = ema(morningEma, adjustedWeight);
    else if (entry.timeOfDay === "EVENING") eveningEma = ema(eveningEma, adjustedWeight);
    else otherEma = ema(otherEma, adjustedWeight);

    const active = [morningEma, eveningEma, otherEma].filter((v): v is number => v !== null);
    const trendKg = active.reduce((sum, v) => sum + v, 0) / active.length;
    points.push({ dateKey: dateKey(weighedAt), trendKg });
  }

  return points;
}

export function latestTrendWeight(entries: WeightSample[], meals: MealSample[] = []): number | null {
  const points = computeTrendWeight(entries, meals);
  return points ? points[points.length - 1].trendKg : null;
}
