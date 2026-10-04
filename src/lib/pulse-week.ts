// Ugevisningen under pulsgrafen i "Vi kan se, at din puls var højere end
// sædvanlig …" (docs/DECISIONS.md 2026-10-04): mandag–søndag for ugen med
// udsvinget, ét felt pr. dag. Dage med registreret sport er krydset af med
// klokkeslæt; udsvingets tidspunkt står som "?".
//
// Ren logik, der regner i enhedens lokale tid (som resten af skærmen), så den
// kan testes uden database (src/lib/pulse-week.test.mjs).

export type WeekActivity = { startedAt: string; durationMinutes: number; sportType: string };

export type WeekEntry = {
  kind: "activity" | "asked";
  at: Date;
  sportType?: string;
};

export type WeekDay = {
  key: string;
  date: Date;
  isToday: boolean;
  isFuture: boolean;
  isAskedDay: boolean;
  entries: WeekEntry[];
};

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Mandag kl. 00:00 (lokal tid) i ugen, datoen ligger i. */
export function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - sinceMonday);
  return start;
}

export function buildWeek(
  anchor: Date,
  activities: WeekActivity[],
  askedAt: Date,
  now: Date = new Date(),
): WeekDay[] {
  const monday = startOfWeek(anchor);
  const todayKey = dayKey(now);
  const askedKey = dayKey(askedAt);
  const days: WeekDay[] = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index);
    const key = dayKey(date);
    return {
      key,
      date,
      isToday: key === todayKey,
      isFuture: key > todayKey,
      isAskedDay: key === askedKey,
      entries: [],
    };
  });
  const byKey = new Map(days.map((day) => [day.key, day]));

  for (const activity of activities) {
    const at = new Date(activity.startedAt);
    if (Number.isNaN(at.getTime())) continue;
    byKey.get(dayKey(at))?.entries.push({ kind: "activity", at, sportType: activity.sportType });
  }
  byKey.get(askedKey)?.entries.push({ kind: "asked", at: askedAt });

  for (const day of days) day.entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  return days;
}
