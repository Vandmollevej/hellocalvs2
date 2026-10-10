// Beregninger bag tal-sliderens mål-linjer (forside). Rene funktioner uden UI,
// så reglerne kan testes og genbruges.

export const DEFAULT_STEPS_GOAL = 10_000;
export const DEFAULT_FLOORS_GOAL = 10;
/** Netto-kcal pr. skridt (ekstra over hvile), grov gennemsnitsværdi. */
export const KCAL_PER_STEP = 0.04;

/** Standardfordeling af energien (P/F/K i %), når brugeren ikke har egne mål. */
export const DEFAULT_ENERGY_SPLIT = { protein: 15, fat: 30, carbs: 55 } as const;
/** Sukker højst 10 % af energien (WHO), 4 kcal pr. g. */
export const SUGAR_ENERGY_SHARE = 0.1;
/** Salt højst 6 g pr. dag (Fødevarestyrelsen/WHO). */
export const SALT_LIMIT_G = 6;

export type MacroGoals = { proteinG: number; fatG: number; carbsG: number; sugarG: number; saltG: number };

/** Gram-mål ud fra dagens kaloriemål; egne mål (Målsætning) overstyrer standarden. */
export function macroGoalsFor(
  goalKcal: number,
  own: { proteinG?: number; fatG?: number; carbsG?: number },
  proteinFallbackG: number,
): MacroGoals {
  return {
    proteinG: own.proteinG ?? proteinFallbackG,
    fatG: own.fatG ?? Math.round((goalKcal * DEFAULT_ENERGY_SPLIT.fat) / 100 / 9),
    carbsG: own.carbsG ?? Math.round((goalKcal * DEFAULT_ENERGY_SPLIT.carbs) / 100 / 4),
    sugarG: Math.round((goalKcal * SUGAR_ENERGY_SHARE) / 4),
    saltG: SALT_LIMIT_G,
  };
}

/** Energifordeling i hele procent (P/F/K) ud fra dagens gram; null uden indtag. */
export function energySplitPercent(proteinG: number, fatG: number, carbsG: number) {
  const kcal = proteinG * 4 + fatG * 9 + carbsG * 4;
  if (kcal <= 0) return null;
  const protein = Math.round((proteinG * 4 * 100) / kcal);
  const fat = Math.round((fatG * 9 * 100) / kcal);
  return { protein, fat, carbs: Math.max(0, 100 - protein - fat) };
}

export type TimedKcal = { at: string | Date; kcal: number };

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Indtag i dag indtil nu mod gennemsnittet af de forrige dage (op til `maxDays`
 * med registreringer) indtil samme klokkeslæt. `percent` er afvigelsen i
 * procent af det normale; null uden sammenligningsgrundlag.
 */
export function intakeVsTypical(entries: TimedKcal[], now: Date, maxDays = 7) {
  const cutoff = minuteOfDay(now);
  let today = 0;
  const previous = new Map<string, number>();
  for (const entry of entries) {
    const at = new Date(entry.at);
    if (minuteOfDay(at) > cutoff) continue;
    if (sameDay(at, now)) {
      today += entry.kcal;
      continue;
    }
    if (at > now) continue;
    const key = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
    previous.set(key, (previous.get(key) ?? 0) + entry.kcal);
  }
  const days = [...previous.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, maxDays);
  if (days.length === 0) return { today, typical: null, percent: null };
  const typical = days.reduce((sum, [, kcal]) => sum + kcal, 0) / days.length;
  const percent = typical > 0 ? Math.round(((today - typical) / typical) * 100) : null;
  return { today, typical: Math.round(typical), percent };
}

export type PulseZone = { min: number; max: number };

/** Standardzoner (% af en antaget maxpuls 190), kan rettes i Indstillinger → Visning → Forside. */
export const DEFAULT_PULSE_ZONES: PulseZone[] = [
  { min: 95, max: 113 },
  { min: 114, max: 132 },
  { min: 133, max: 151 },
  { min: 152, max: 170 },
  { min: 171, max: 220 },
];

export type PulseSample = { bpm: number; at: string | Date };

/** Længste tid ét pulsmål antages at gælde, før næste måling (minutter). */
const MAX_SAMPLE_GAP_MIN = 5;

/** Minutter i en pulszone: hvert mål gælder til det næste (højst fem minutter). */
export function minutesInZone(samples: PulseSample[], zone: PulseZone) {
  const sorted = [...samples]
    .map((sample) => ({ bpm: sample.bpm, at: new Date(sample.at).getTime() }))
    .sort((a, b) => a.at - b.at);
  let minutes = 0;
  for (let i = 0; i < sorted.length; i++) {
    const sample = sorted[i];
    if (sample.bpm < zone.min || sample.bpm > zone.max) continue;
    const next = sorted[i + 1];
    const gap = next ? (next.at - sample.at) / 60_000 : 1;
    minutes += Math.min(MAX_SAMPLE_GAP_MIN, Math.max(0, gap));
  }
  return Math.round(minutes);
}

export type WeightPoint = { weightKg: number; at: string | Date };

function averageWeight(points: WeightPoint[]) {
  return points.reduce((sum, point) => sum + point.weightKg, 0) / points.length;
}

const DAY_MS = 86_400_000;

export type WeightOutlook = {
  /** Forventet vægt på måldagen ud fra forløbet siden målet blev sat. */
  predictedKg: number;
  verdict: "likely" | "possible" | "unlikely";
  /** Skøn for chancen for at nå målet inden for anbefalingen (0–100). */
  chancePercent: number;
  /** Anbefalet maksimal ændring pr. uge (kg). */
  recommendedKgPerWeek: number;
  requiredKgPerWeek: number;
};

/**
 * Vægt på måldagen mod målet. Udgangspunktet er gennemsnittet af vejningerne
 * omkring oprettelsen af målet (±3 dage); den nuværende vægt er gennemsnittet
 * af de seneste tre vejninger. Tempoet siden målet blev sat fremskrives til
 * måldagen.
 */
export function weightOutlook(
  weights: WeightPoint[],
  goalCreatedAt: Date,
  targetDate: Date,
  targetKg: number,
  now: Date,
): WeightOutlook | null {
  const sorted = [...weights].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  if (sorted.length === 0 || targetDate.getTime() <= now.getTime()) return null;
  const around = sorted.filter((p) => Math.abs(new Date(p.at).getTime() - goalCreatedAt.getTime()) <= 3 * DAY_MS);
  const startPoints = around.length > 0 ? around : [sorted.reduce((best, p) =>
    Math.abs(new Date(p.at).getTime() - goalCreatedAt.getTime()) < Math.abs(new Date(best.at).getTime() - goalCreatedAt.getTime()) ? p : best,
  )];
  const startKg = averageWeight(startPoints);
  const currentKg = averageWeight(sorted.slice(-3));
  const elapsedDays = Math.max(1, (now.getTime() - goalCreatedAt.getTime()) / DAY_MS);
  const daysLeft = (targetDate.getTime() - now.getTime()) / DAY_MS;
  const ratePerDay = (currentKg - startKg) / elapsedDays;
  const predictedKg = currentKg + ratePerDay * daysLeft;

  const weeksLeft = Math.max(daysLeft / 7, 1 / 7);
  const requiredKgPerWeek = Math.abs(targetKg - currentKg) / weeksLeft;
  // 0,5–1 % af kropsvægten pr. uge er den gængse anbefaling; midten bruges som grænse.
  const recommendedKgPerWeek = Math.round(currentKg * 0.0075 * 100) / 100;
  const maxKgPerWeek = currentKg * 0.01;
  let chancePercent: number;
  if (requiredKgPerWeek <= recommendedKgPerWeek) chancePercent = 90;
  else if (requiredKgPerWeek <= maxKgPerWeek) chancePercent = 60;
  else chancePercent = Math.max(5, Math.round(60 * (maxKgPerWeek / requiredKgPerWeek) ** 2));

  const direction = Math.sign(targetKg - startKg);
  const missed = direction === 0 ? Math.abs(predictedKg - targetKg) : Math.max(0, direction * (targetKg - predictedKg));
  const tolerance = Math.max(0.5, targetKg * 0.01);
  const verdict = missed <= tolerance ? "likely" : missed <= tolerance * 3 ? "possible" : "unlikely";
  return { predictedKg, verdict, chancePercent, recommendedKgPerWeek, requiredKgPerWeek };
}
