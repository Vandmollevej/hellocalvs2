// Aggregerer registreringer til dagstotaler, delt af Statistik og nøgletalshjulet.

export type RegistrationTotals = {
  kcalSnapshot: number;
  proteinSnapshot: number;
  createdAt: string;
};

export type DailyTotal = {
  dateKey: string;
  kcal: number;
  protein: number;
};

function dateKey(dateString: string) {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function groupByDay(registrations: RegistrationTotals[]): DailyTotal[] {
  const byDay = new Map<string, DailyTotal>();

  for (const registration of registrations) {
    const key = dateKey(registration.createdAt);
    const existing = byDay.get(key);
    if (existing) {
      existing.kcal += registration.kcalSnapshot;
      existing.protein += registration.proteinSnapshot;
    } else {
      byDay.set(key, {
        dateKey: key,
        kcal: registration.kcalSnapshot,
        protein: registration.proteinSnapshot,
      });
    }
  }

  return Array.from(byDay.values());
}

export function withinLastDays(registrations: RegistrationTotals[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return registrations.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
}
