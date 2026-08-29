// AI-estimeret "Trendvægt" (docs/SPECIFICATION.md §5: "Vægtvisning arbejder
// med Målt vægt, Trendvægt (AI-beregnet) og Forventet vægt"). Beregnes altid
// on-the-fly ud fra WeightEntry — gemmes aldrig som sin egen række, så målte
// data ikke forurenes.
//
// Metode: separate eksponentielt udjævnede gennemsnit for morgen- og
// aften-vejninger (brugerens eget udsvingsmønster over døgnet), med et lille
// fast fradrag når der er registreret mad tæt på vejningstidspunktet (mad
// vejer typisk 0,3-0,6 kg midlertidigt). Dette er letvægts statistik, ikke en
// ML-model — se docs/DECISIONS.md.

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

/** Returnerer null hvis der ikke er nok data til et pålideligt estimat endnu. */
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
