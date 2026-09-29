// Søvnstatistik (/statistics/sleep, docs/DECISIONS.md 2026-09-29): oplevet
// søvn (1–5) pr. morgen sammenholdt med dagen FØR natten — kalorier, sidste
// indtag om aftenen, koffein og sport — og evt. målt søvn fra smartudstyr.
// Ren beregning; siden og statistikmodulet henter selv data.

import type { ActivityTotals, HealthMetricTotals } from "@/lib/stat-cards";
import { localDateKey } from "@/lib/sleep-quality";
import { matchToxins } from "@/lib/toxins";

export type SleepStatPeriodKey = "last7" | "last30" | "lastMonth" | "last3Months" | "thisYear";

export const SLEEP_STAT_PERIODS: SleepStatPeriodKey[] = ["last7", "last30", "lastMonth", "last3Months", "thisYear"];

/** Morgenerne i perioden (den dato man vågnede og vurderede natten). */
export function sleepPeriodDays(key: SleepStatPeriodKey, now: Date = new Date()): Date[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start: Date;
  let end = today;
  if (key === "last7") start = addDays(today, -6);
  else if (key === "last30") start = addDays(today, -29);
  else if (key === "lastMonth") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (key === "last3Months") start = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate() + 1);
  else start = new Date(today.getFullYear(), 0, 1);

  const days: Date[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

function addDays(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

export type SleepRegistration = { createdAt: string; kcalSnapshot: number; titleSnapshot?: string };

export type SleepStatDay = {
  date: Date;
  rating: number | null;
  /** Kalorier dagen før natten. */
  kcal: number | null;
  /** Sidste registrering dagen før, i minutter efter midnat. */
  lastMealMinutes: number | null;
  coffeeCount: number;
  lastCoffeeMinutes: number | null;
  sportMinutes: number;
  /** Hvornår dagens sidste træning sluttede (kan gå over midnat, fx 1470). */
  lastSportEndMinutes: number | null;
  /** Målt søvn fra smartudstyr, i timer. */
  deviceSleepHours: number | null;
  /** Fedtprocent målt på dagen (gennemsnit, hvis flere målinger). */
  bodyFatPercent: number | null;
};

// Koffein genkendes med samme ordliste som produktsidens toksiner.
function isCaffeine(title: string | undefined) {
  return matchToxins(title).some((match) => match.toxin.key === "caffeine");
}

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function buildSleepStatDays(input: {
  days: Date[];
  ratings: { date: string; rating: number }[];
  registrations: SleepRegistration[];
  activities: ActivityTotals[];
  metrics: HealthMetricTotals[];
}): SleepStatDay[] {
  const ratingByDay = new Map(input.ratings.map((entry) => [entry.date, entry.rating]));

  const regsByDay = new Map<string, SleepRegistration[]>();
  for (const registration of input.registrations) {
    const key = localDateKey(new Date(registration.createdAt));
    const list = regsByDay.get(key) ?? [];
    list.push(registration);
    regsByDay.set(key, list);
  }

  const activitiesByDay = new Map<string, ActivityTotals[]>();
  for (const activity of input.activities) {
    const key = localDateKey(new Date(activity.startedAt));
    const list = activitiesByDay.get(key) ?? [];
    list.push(activity);
    activitiesByDay.set(key, list);
  }

  const sleepMinutesByDay = new Map<string, number>();
  for (const metric of input.metrics) {
    if (metric.type !== "SLEEP_MINUTES") continue;
    const key = localDateKey(new Date(metric.recordedAt));
    sleepMinutesByDay.set(key, (sleepMinutesByDay.get(key) ?? 0) + metric.value);
  }

  const bodyFatByDay = new Map<string, { sum: number; count: number }>();
  for (const metric of input.metrics) {
    if (metric.type !== "BODY_FAT_PERCENT") continue;
    const key = localDateKey(new Date(metric.recordedAt));
    const entry = bodyFatByDay.get(key) ?? { sum: 0, count: 0 };
    entry.sum += metric.value;
    entry.count += 1;
    bodyFatByDay.set(key, entry);
  }

  return input.days.map((date) => {
    const eveningKey = localDateKey(addDays(date, -1));
    const regs = regsByDay.get(eveningKey) ?? [];
    const coffee = regs.filter((registration) => isCaffeine(registration.titleSnapshot));
    const sports = activitiesByDay.get(eveningKey) ?? [];
    const deviceMinutes = sleepMinutesByDay.get(localDateKey(date));
    const bodyFat = bodyFatByDay.get(localDateKey(date));

    const latest = (times: number[]) => (times.length ? Math.max(...times) : null);
    return {
      date,
      rating: ratingByDay.get(localDateKey(date)) ?? null,
      kcal: regs.length ? Math.round(regs.reduce((sum, r) => sum + r.kcalSnapshot, 0)) : null,
      lastMealMinutes: latest(regs.map((r) => minutesOfDay(new Date(r.createdAt)))),
      coffeeCount: coffee.length,
      lastCoffeeMinutes: latest(coffee.map((r) => minutesOfDay(new Date(r.createdAt)))),
      sportMinutes: sports.reduce((sum, a) => sum + a.durationMinutes, 0),
      lastSportEndMinutes: latest(sports.map((a) => minutesOfDay(new Date(a.startedAt)) + a.durationMinutes)),
      deviceSleepHours: deviceMinutes ? Math.round((deviceMinutes / 60) * 10) / 10 : null,
      bodyFatPercent: bodyFat ? Math.round((bodyFat.sum / bodyFat.count) * 10) / 10 : null,
    };
  });
}

/** "21:45" — også over midnat (1470 → "00:30"). */
export function formatMinutesOfDay(minutes: number) {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
