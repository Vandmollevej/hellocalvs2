// Heuristisk måltidstype-klassificering til analytisk brug (docs/AI.md
// "Klassificering af måltidstype"). Dette er en forenklet v1: faste
// tidsvinduer på døgnet, IKKE den fulde hverdags-/weekend- og
// fødevaretype-profilering som docs/AI.md beskriver — det kræver en
// produkt-taxonomi der ikke findes endnu. Ingen registreringer tagges
// automatisk her; det er kun et statistik-resumé.

export type MealWindowType = "BREAKFAST" | "LUNCH" | "DINNER" | "OTHER";

export type MealSummary = {
  type: MealWindowType;
  label: string;
  count: number;
  averageMinutes: number | null;
  averageKcal: number;
};

type MealRegistration = {
  createdAt: string;
  kcalSnapshot: number;
};

const MEAL_WINDOWS: { type: MealWindowType; label: string; startMinute: number; endMinute: number }[] = [
  { type: "BREAKFAST", label: "Morgenmad", startMinute: 5 * 60, endMinute: 10 * 60 },
  { type: "LUNCH", label: "Frokost", startMinute: 10 * 60, endMinute: 15 * 60 },
  { type: "DINNER", label: "Aftensmad", startMinute: 15 * 60, endMinute: 22 * 60 },
];

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function windowFor(minutes: number): MealWindowType {
  return MEAL_WINDOWS.find((w) => minutes >= w.startMinute && minutes < w.endMinute)?.type ?? "OTHER";
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function classifyMeals(registrations: MealRegistration[]): MealSummary[] {
  const buckets = new Map<MealWindowType, { minutes: number[]; kcal: number }>();

  for (const registration of registrations) {
    const minutes = minutesFromMidnight(new Date(registration.createdAt));
    const type = windowFor(minutes);
    const bucket = buckets.get(type) ?? { minutes: [], kcal: 0 };
    bucket.minutes.push(minutes);
    bucket.kcal += registration.kcalSnapshot;
    buckets.set(type, bucket);
  }

  return MEAL_WINDOWS.map(({ type, label }) => {
    const bucket = buckets.get(type);
    if (!bucket || bucket.minutes.length === 0) {
      return { type, label, count: 0, averageMinutes: null, averageKcal: 0 };
    }
    const averageMinutes = bucket.minutes.reduce((sum, m) => sum + m, 0) / bucket.minutes.length;
    return {
      type,
      label,
      count: bucket.minutes.length,
      averageMinutes,
      averageKcal: bucket.kcal / bucket.minutes.length,
    };
  });
}

export function formatMealTime(averageMinutes: number | null) {
  return averageMinutes === null ? null : formatMinutes(averageMinutes);
}
