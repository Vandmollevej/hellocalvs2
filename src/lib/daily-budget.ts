// Dagligt kaloriebudget pr. dato (docs/ACTIVITY-PAL.md "Kaloriemål",
// brugerens valg 2026-09-29: kun fremadrettet). Budgettet gemmes som en
// snapshot pr. dag (DailyBudgetSnapshot), første gang det regnes den dag.
// En dato bruger sin egen snapshot; findes den ikke, den seneste tidligere
// snapshot (budgettet "bæres frem"); og dage før den første snapshot beholder
// det gamle faste mål (fallback) — historikken regnes aldrig om.

export type BudgetSnapshot = {
  /** Kalenderdato "YYYY-MM-DD". */
  date: string;
  budgetKcal: number;
};

export function isoDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Budgettet for en dato: egen snapshot → seneste tidligere → fallback. */
export function budgetForDate(snapshots: BudgetSnapshot[], date: Date, fallbackKcal: number): number {
  const key = isoDayKey(date);
  let best: BudgetSnapshot | null = null;
  for (const snapshot of snapshots) {
    if (snapshot.date > key) continue;
    if (!best || snapshot.date > best.date) best = snapshot;
  }
  return best?.budgetKcal ?? fallbackKcal;
}

/** Sorteret opslag til mange datoer (kalender, statistik). */
export function makeBudgetLookup(snapshots: BudgetSnapshot[], fallbackKcal: number): (date: Date) => number {
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return (date) => {
    const key = isoDayKey(date);
    let best: BudgetSnapshot | null = null;
    for (const snapshot of sorted) {
      if (snapshot.date > key) break;
      best = snapshot;
    }
    return best?.budgetKcal ?? fallbackKcal;
  };
}

/**
 * Brugerens kalenderdato som UTC-midnat ud fra telefonens tidszone (minutter
 * øst for UTC, samme fortegn som widget-data.ts). Serveren kører i UTC, så
 * uden dette ville en snapshot omkring midnat dansk tid lande på "i går".
 */
export function localDayAsUtc(now: Date, tzOffsetMinutesEast: number) {
  const shifted = new Date(now.getTime() + tzOffsetMinutesEast * 60_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** Klientens tidszone som minutter øst for UTC (browserens fortegn er omvendt). */
export function clientTzOffsetMinutesEast() {
  return -new Date().getTimezoneOffset();
}

/** URL til regnestykket med telefonens tidszone, så dagens snapshot får rigtig dato. */
export function activitySummaryUrl() {
  return `/api/profile/activity?tz=${clientTzOffsetMinutesEast()}`;
}
