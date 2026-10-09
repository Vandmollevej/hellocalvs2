// "Udregn": indsigter i hvornår brugeren spiser på dagen i snit vs. hvad der
// typisk anbefales (docs/DECISIONS.md 2026-10-07). Ren logik uden database.
// Tidspunkt = registreringens tidspunkt i dansk tid (minutter siden midnat).

export type MealKey = "breakfast" | "lunch" | "dinner" | "snack";
export type TimedKcal = { minutes: number; weekday: number; day: string; kcal: number };

export const MEAL_LABELS: Record<MealKey, string> = {
  breakfast: "Morgenmad",
  lunch: "Frokost",
  dinner: "Aftensmad",
  snack: "Mellemmåltider",
};
// Typiske anbefalinger: tidsrum (minutter siden midnat) og andel af dagens energi.
export const RECOMMENDED: Record<MealKey, { from: number; to: number; share: number }> = {
  breakfast: { from: 7 * 60, to: 9 * 60, share: 0.25 },
  lunch: { from: 11 * 60 + 30, to: 13 * 60 + 30, share: 0.3 },
  dinner: { from: 17 * 60 + 30, to: 19 * 60 + 30, share: 0.3 },
  snack: { from: 0, to: 0, share: 0.15 },
};
export const MIN_INSIGHT_DAYS = 3;

export function mealOf(minutes: number): MealKey {
  if (minutes >= 5 * 60 && minutes < 11 * 60) return "breakfast";
  if (minutes >= 11 * 60 && minutes < 15 * 60) return "lunch";
  if (minutes >= 17 * 60 && minutes < 21 * 60 + 30) return "dinner";
  return "snack";
}

export function clock(minutes: number) {
  const m = Math.round(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type MealTimeRow = {
  meal: MealKey;
  label: string;
  avgClock: string;
  recommended: string;
  verdict: string;
  kcalShare: number;
  recommendedShare: number;
};
export type MealInsights = {
  days: number;
  meals: MealTimeRow[];
  window: { firstClock: string; lastClock: string; hours: number; lastBeforeBedHours: number | null; verdict: string };
  weekdayVsWeekend: { weekdayFirst: string; weekendFirst: string; weekdayKcal: number; weekendKcal: number; verdict: string } | null;
};

const avg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

function firstMinutesPerDay(rows: TimedKcal[]) {
  const first = new Map<string, number>();
  for (const e of rows) first.set(e.day, Math.min(first.get(e.day) ?? 1e9, e.minutes));
  return [...first.values()];
}

export function computeMealInsights(entries: TimedKcal[], bedtimeMinutes: number | null): MealInsights | null {
  const days = new Set(entries.map((e) => e.day));
  if (days.size < MIN_INSIGHT_DAYS) return null;

  const totalKcal = entries.reduce((s, e) => s + e.kcal, 0) || 1;
  const meals: MealTimeRow[] = [];
  for (const meal of ["breakfast", "lunch", "dinner", "snack"] as MealKey[]) {
    const rows = entries.filter((e) => mealOf(e.minutes) === meal);
    const rec = RECOMMENDED[meal];
    const range = meal === "snack" ? "ca. 15 % af dagens energi" : `${clock(rec.from)}–${clock(rec.to)}`;
    const share = rows.reduce((s, e) => s + e.kcal, 0) / totalKcal;
    if (!rows.length) {
      if (meal !== "snack") {
        meals.push({ meal, label: MEAL_LABELS[meal], avgClock: "—", recommended: range, verdict: "Du registrerer sjældent dette måltid.", kcalShare: 0, recommendedShare: rec.share });
      }
      continue;
    }
    const avgMinutes = avg(firstMinutesPerDay(rows));
    let verdict = `Mellemmåltider fylder ${Math.round(share * 100)} % af dit indtag (typisk ca. 15 %).`;
    if (meal !== "snack") {
      verdict =
        avgMinutes < rec.from - 20 ? "Tidligere end anbefalet." : avgMinutes > rec.to + 20 ? "Senere end anbefalet." : "Inden for det anbefalede tidsrum.";
    }
    meals.push({ meal, label: MEAL_LABELS[meal], avgClock: meal === "snack" ? "—" : clock(avgMinutes), recommended: range, verdict, kcalShare: share, recommendedShare: rec.share });
  }

  const byDay = new Map<string, number[]>();
  for (const e of entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e.minutes]);
  const first = avg([...byDay.values()].map((m) => Math.min(...m)));
  const last = avg([...byDay.values()].map((m) => Math.max(...m)));
  const lastBeforeBed = bedtimeMinutes === null ? null : ((bedtimeMinutes - last + 1440) % 1440) / 60;
  const windowHours = (last - first) / 60;
  const verdict =
    lastBeforeBed !== null && lastBeforeBed < 3
      ? "Du spiser typisk mindre end 3 timer før sengetid. Anbefalingen er mindst 3 timer."
      : windowHours > 13
        ? "Dit spisevindue er langt (over 13 timer). Mange har gavn af 10–12 timer."
        : "Dit spisevindue ser fornuftigt ud.";

  const isWeekend = (e: TimedKcal) => e.weekday === 0 || e.weekday === 6;
  const weekendRows = entries.filter(isWeekend);
  const weekdayRows = entries.filter((e) => !isWeekend(e));
  const weekendDays = new Set(weekendRows.map((e) => e.day));
  const weekdayDays = new Set(weekdayRows.map((e) => e.day));
  let weekdayVsWeekend: MealInsights["weekdayVsWeekend"] = null;
  if (weekendDays.size && weekdayDays.size) {
    const weekdayKcal = Math.round(weekdayRows.reduce((s, e) => s + e.kcal, 0) / weekdayDays.size);
    const weekendKcal = Math.round(weekendRows.reduce((s, e) => s + e.kcal, 0) / weekendDays.size);
    weekdayVsWeekend = {
      weekdayFirst: clock(avg(firstMinutesPerDay(weekdayRows))),
      weekendFirst: clock(avg(firstMinutesPerDay(weekendRows))),
      weekdayKcal,
      weekendKcal,
      verdict:
        weekendKcal > weekdayKcal * 1.1
          ? "Du spiser mere i weekenden end på hverdage."
          : weekendKcal < weekdayKcal * 0.9
            ? "Du spiser mindre i weekenden end på hverdage."
            : "Dit indtag er ens på hverdage og i weekenden.",
    };
  }

  return {
    days: days.size,
    meals,
    window: {
      firstClock: clock(first),
      lastClock: clock(last),
      hours: Math.round(windowHours * 10) / 10,
      lastBeforeBedHours: lastBeforeBed === null ? null : Math.round(lastBeforeBed * 10) / 10,
      verdict,
    },
    weekdayVsWeekend,
  };
}
