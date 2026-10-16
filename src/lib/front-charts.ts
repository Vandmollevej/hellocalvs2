// Beregninger bag forsidens grafer (puls, kalorier, målsætning). Rene
// funktioner uden UI, så reglerne kan testes og deles med den native skærm.

export const DEFAULT_WAKE_HOUR = 7;
export const DEFAULT_BED_HOUR = 23;

/** Vågne timer som hele timer: rund OP til venstre og NED til højre, så aksen holder sig inden for de vågne timer (bruger 2026-10-14). */
export function awakeHours(wakeTime: string | null | undefined, bedtime: string | null | undefined) {
  const parse = (value: string | null | undefined) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? "");
    return match ? Number(match[1]) + Number(match[2]) / 60 : null;
  };
  const wake = parse(wakeTime) ?? DEFAULT_WAKE_HOUR;
  let bed = parse(bedtime) ?? DEFAULT_BED_HOUR;
  // Sengetid efter midnat (fx 00:30) tæller som slutningen af samme dag.
  if (bed <= wake) bed = 24;
  const start = Math.min(23, Math.max(0, Math.ceil(wake)));
  const end = Math.min(24, Math.max(start + 1, Math.floor(bed)));
  return { start, end };
}

/** Sengetid/opvågning for en given ugedag (0 = mandag i databasen, JS: 0 = søndag). */
export function scheduleForDate<T extends { weekday: number }>(schedules: T[], date: Date) {
  const weekday = (date.getDay() + 6) % 7;
  return schedules.find((item) => item.weekday === weekday) ?? null;
}

export type Sample = { value: number; at: Date };
export type StickBucket = { index: number; min: number; max: number } | null;

/** Pindediagram: én min/maks-pind pr. tidsrum; null hvor der ikke er målinger. */
export function stickBuckets(samples: Sample[], startHour: number, endHour: number, bucketMinutes = 15): StickBucket[] {
  const count = Math.max(1, Math.round(((endHour - startHour) * 60) / bucketMinutes));
  const buckets: StickBucket[] = new Array(count).fill(null);
  for (const sample of samples) {
    const hour = sample.at.getHours() + sample.at.getMinutes() / 60;
    if (hour < startHour || hour >= endHour) continue;
    const index = Math.min(count - 1, Math.floor(((hour - startHour) * 60) / bucketMinutes));
    const current = buckets[index];
    buckets[index] = current
      ? { index, min: Math.min(current.min, sample.value), max: Math.max(current.max, sample.value) }
      : { index, min: sample.value, max: sample.value };
  }
  return buckets;
}

/** Kalorier lagt sammen pr. tidsrum (søjlehøjde = kcal spist i tidsrummet). */
export function sumBuckets(entries: { at: Date; kcal: number }[], startHour: number, endHour: number, bucketMinutes = 15) {
  const count = Math.max(1, Math.round(((endHour - startHour) * 60) / bucketMinutes));
  const sums = new Array<number>(count).fill(0);
  for (const entry of entries) {
    const hour = entry.at.getHours() + entry.at.getMinutes() / 60;
    if (hour < startHour || hour >= endHour) continue;
    sums[Math.min(count - 1, Math.floor(((hour - startHour) * 60) / bucketMinutes))] += entry.kcal;
  }
  return sums;
}

/**
 * Anbefalet energifordeling over dagen: morgenmad, frokost, aftensmad og små
 * mellemmåltider som glatte toppe. Returnerer andel (summer til 1) pr. tidsrum.
 */
const MEALS = [
  { hour: 7.75, share: 0.25, spread: 0.9 },
  { hour: 12.5, share: 0.3, spread: 1.0 },
  { hour: 18.25, share: 0.35, spread: 1.1 },
  { hour: 15.5, share: 0.1, spread: 0.8 },
];
export function recommendedShares(startHour: number, endHour: number, bucketMinutes = 15) {
  const count = Math.max(1, Math.round(((endHour - startHour) * 60) / bucketMinutes));
  const raw = new Array<number>(count).fill(0);
  for (let i = 0; i < count; i++) {
    const hour = startHour + ((i + 0.5) * bucketMinutes) / 60;
    for (const meal of MEALS) raw[i] += meal.share * Math.exp(-(((hour - meal.hour) / meal.spread) ** 2));
  }
  const total = raw.reduce((a, b) => a + b, 0) || 1;
  return raw.map((v) => v / total);
}

/** Løbende sum. */
export function cumulative(values: number[]) {
  let sum = 0;
  return values.map((v) => (sum += v));
}

/**
 * Hvor meget indtaget ligger over den anbefalede kurve lige nu (kcal);
 * 0 når man ligger på eller under. `elapsedBuckets` = tidsrum til og med nu.
 */
export function aheadOfPlan(intakeSums: number[], budgetKcal: number, shares: number[], elapsedBuckets: number) {
  const idx = Math.max(0, Math.min(shares.length, elapsedBuckets)) - 1;
  if (idx < 0) return 0;
  const planned = cumulative(shares.map((s) => s * budgetKcal))[idx] ?? 0;
  const eaten = cumulative(intakeSums)[idx] ?? 0;
  return Math.max(0, Math.round(eaten - planned));
}

/** Del overskuddet mellem at spise mindre og at forbrænde mere (halvt hver). */
export function splitSurplus(surplusKcal: number) {
  const reduce = Math.round(surplusKcal / 2 / 10) * 10;
  return { reduceKcal: reduce, burnKcal: Math.max(0, surplusKcal - reduce) };
}

export type WalkOption = { key: "easy" | "brisk" | "fast"; met: number; minutes: number };
const WALK_METS = [
  { key: "easy", met: 2.8 },
  { key: "brisk", met: 4.3 },
  { key: "fast", met: 5.5 },
] as const;

/** Gåtur-længde for at forbrænde `kcal` ved tre tempoer (kcal/min = MET·3,5·kg/200). */
export function walkOptions(kcal: number, weightKg: number | null): WalkOption[] {
  const kg = weightKg && weightKg > 0 ? weightKg : 75;
  return WALK_METS.map(({ key, met }) => ({
    key,
    met,
    minutes: Math.max(5, Math.round(kcal / ((met * 3.5 * kg) / 200) / 5) * 5),
  }));
}

// ---- Målsætning: tidslinje med dage/uger -----------------------------------

export type DayKcal = { day: string; kcal: number | null; minRec?: number; maxRec?: number };
export type GoalBar = { label: string; avgKcal: number | null; lowKcal: number | null; highKcal: number | null };

export function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Dage pr. søjle ud fra pladsen: uger når der er langt, ellers 1, 2, 3 … dage pr. søjle. */
export function daysPerBar(totalDays: number, maxBars: number) {
  if (totalDays <= maxBars) return 1;
  const raw = Math.ceil(totalDays / Math.max(1, maxBars));
  return raw >= 5 ? Math.ceil(raw / 7) * 7 : raw;
}

/**
 * Samler dage til søjler. Dage uden registreret indtag (`null`) tæller ikke med;
 * en søjle uden nogen målte dage bliver tom. Bunden er laveste dag, toppen den
 * højeste, og højden/gennemsnittet er snittet af de målte dage.
 */
export function groupDays(days: DayKcal[], perBar: number): GoalBar[] {
  const bars: GoalBar[] = [];
  for (let i = 0; i < days.length; i += perBar) {
    const slice = days.slice(i, i + perBar);
    const measured = slice.map((d) => d.kcal).filter((v): v is number => v !== null && v > 0);
    bars.push({
      label: slice[0].day,
      avgKcal: measured.length ? measured.reduce((a, b) => a + b, 0) / measured.length : null,
      lowKcal: measured.length ? Math.min(...measured) : null,
      highKcal: measured.length ? Math.max(...measured) : null,
    });
  }
  return bars;
}

/**
 * Anbefalet interval pr. dag: maks er det sunde budget (aldrig under gulvet,
 * også selvom brugerens eget mål er sat lavere), min er 15 % under, dog ikke
 * under gulvet.
 */
export function recommendedRange(budgetKcal: number, floorKcal: number) {
  const max = Math.max(budgetKcal, floorKcal);
  return { min: Math.min(max, Math.max(floorKcal, Math.round((max * 0.85) / 10) * 10)), max };
}
