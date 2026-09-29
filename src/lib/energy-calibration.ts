// Løbende kalibrering af energibehovet mod vægt over tid (docs/ACTIVITY-PAL.md
// "Kalibrering"). Lært vedligehold = gennemsnitligt indtag − energien i
// trendvægtens hældning. Det blandes med formlen, så formlen aldrig helt
// forsvinder: brugt = formel × (1 − w) + lært × w, hvor w vokser med
// datamængden op til 0,7. Ren beregning uden Prisma — testes i
// energy-calibration.test.mjs.

export const CALIBRATION_WINDOW_DAYS = 56;
export const CALIBRATION_MIN_LOGGED_DAYS = 14;
export const CALIBRATION_FULL_WEIGHT_LOGGED_DAYS = 42;
export const CALIBRATION_MAX_WEIGHT = 0.7;
export const CALIBRATION_MIN_TREND_POINTS = 3;
export const CALIBRATION_MIN_TREND_SPAN_DAYS = 14;
// Uden for dette forhold til formlen er det oftest underlogning eller en
// vand-/vægtafvigelse, ikke et rigtigt stofskifte (samme grænser som
// weekly-energy-summary).
export const CALIBRATION_MIN_RATIO = 0.7;
export const CALIBRATION_MAX_RATIO = 1.4;
const KCAL_PER_KG = 7700;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Samme dagsnøgle som weekly-energy-summary og weight-trend: "år-måned(0-11)-dag". */
export function calibrationDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export type TrendSample = { dateKey: string; trendKg: number };

export type CalibrationInput = {
  /** Formlens gennemsnitlige dagsvedligehold over vinduet (dagsreglerne anvendt). */
  formulaKcal: number;
  /** Indtag pr. dag (dagsnøgle → kcal). */
  intakeByDay: Map<string, number>;
  /** Trendvægt pr. dag (weight-trend.computeTrendWeight). */
  trend: TrendSample[];
  /** Første dag efter vinduet (typisk i dag). */
  endExclusive: Date;
  /** Dage under dette indtag regnes som underlogning og tælles ikke. */
  minimumKcal: number;
  windowDays?: number;
};

export type CalibrationReason = "OK" | "NOT_ENOUGH_INTAKE" | "NOT_ENOUGH_WEIGHT" | "IMPLAUSIBLE";

export type Calibration = {
  reason: CalibrationReason;
  formulaKcal: number;
  /** Lært vedligehold; null når der ikke kan læres. */
  learnedKcal: number | null;
  /** Vægten w på det lærte (0–0,7). */
  weight: number;
  /** Det, der bruges: blandingen. */
  usedKcal: number;
  loggedDays: number;
  trendDays: number;
  /** Trendvægtens hældning i kg/uge (negativ = vægttab). */
  slopeKgPerWeek: number | null;
  averageIntakeKcal: number | null;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calibrationWeight(loggedDays: number): number {
  const share = (loggedDays - CALIBRATION_MIN_LOGGED_DAYS) / (CALIBRATION_FULL_WEIGHT_LOGGED_DAYS - CALIBRATION_MIN_LOGGED_DAYS);
  return Math.round(CALIBRATION_MAX_WEIGHT * Math.min(1, Math.max(0, share)) * 100) / 100;
}

export function calibrateMaintenance(input: CalibrationInput): Calibration {
  const windowDays = input.windowDays ?? CALIBRATION_WINDOW_DAYS;
  const end = startOfDay(input.endExclusive);
  const start = new Date(end.getTime() - windowDays * DAY_MS);
  const base: Calibration = {
    reason: "OK",
    formulaKcal: input.formulaKcal,
    learnedKcal: null,
    weight: 0,
    usedKcal: input.formulaKcal,
    loggedDays: 0,
    trendDays: 0,
    slopeKgPerWeek: null,
    averageIntakeKcal: null,
  };

  // Indtag: kun dage med registreringer på eller over det sunde minimum.
  const keyToOffset = new Map<string, number>();
  let intakeSum = 0;
  let loggedDays = 0;
  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const key = calibrationDayKey(date);
    keyToOffset.set(key, offset);
    const kcal = input.intakeByDay.get(key) ?? 0;
    if (kcal < input.minimumKcal || kcal <= 0) continue;
    intakeSum += kcal;
    loggedDays += 1;
  }
  base.loggedDays = loggedDays;
  if (loggedDays < CALIBRATION_MIN_LOGGED_DAYS) return { ...base, reason: "NOT_ENOUGH_INTAKE" };
  const averageIntake = intakeSum / loggedDays;
  base.averageIntakeKcal = Math.round(averageIntake);

  // Trendvægt: mindst-kvadraters hældning over vinduet.
  const points = input.trend
    .map((sample) => ({ x: keyToOffset.get(sample.dateKey), y: sample.trendKg }))
    .filter((point): point is { x: number; y: number } => point.x !== undefined);
  base.trendDays = points.length;
  if (points.length < CALIBRATION_MIN_TREND_POINTS) return { ...base, reason: "NOT_ENOUGH_WEIGHT" };
  const xs = points.map((point) => point.x);
  if (Math.max(...xs) - Math.min(...xs) < CALIBRATION_MIN_TREND_SPAN_DAYS) return { ...base, reason: "NOT_ENOUGH_WEIGHT" };
  const meanX = xs.reduce((sum, x) => sum + x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    covariance += (point.x - meanX) * (point.y - meanY);
    variance += (point.x - meanX) ** 2;
  }
  if (variance === 0) return { ...base, reason: "NOT_ENOUGH_WEIGHT" };
  const slopeKgPerDay = covariance / variance;
  base.slopeKgPerWeek = Math.round(slopeKgPerDay * 7 * 100) / 100;

  const learned = averageIntake - slopeKgPerDay * KCAL_PER_KG;
  if (!Number.isFinite(learned) || learned <= 0) return { ...base, reason: "IMPLAUSIBLE" };
  const ratio = learned / input.formulaKcal;
  if (ratio < CALIBRATION_MIN_RATIO || ratio > CALIBRATION_MAX_RATIO) {
    return { ...base, reason: "IMPLAUSIBLE", learnedKcal: Math.round(learned) };
  }

  const weight = calibrationWeight(loggedDays);
  return {
    ...base,
    learnedKcal: Math.round(learned),
    weight,
    usedKcal: Math.round(input.formulaKcal * (1 - weight) + learned * weight),
  };
}
