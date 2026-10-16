// Graviditet og amning (docs/DECISIONS.md 2026-10-14): officielle tillæg til
// energibehovet fra EFSA's Dietary Reference Values for energy (2013), som
// NNR 2023 også bygger på. Kun rene funktioner; felterne ligger på User
// (pregnancyStatus, pregnancyWeek, breastfeedingWeeks, pregnancyStatusUpdatedAt)
// og regnes frem i tid, så brugeren ikke selv skal opdatere ugen hver uge.

export const PREGNANCY_STATUSES = ["PREGNANT", "BREASTFEEDING"] as const;
export type PregnancyStatus = (typeof PREGNANCY_STATUSES)[number];

/** Ekstra kcal/dag pr. trimester (EFSA 2013, ved ca. 12 kg vægtøgning). */
export const PREGNANCY_EXTRA_KCAL: Record<1 | 2 | 3, number> = { 1: 70, 2: 260, 3: 500 };
/** Fuld amning de første 6 måneder (EFSA 2013). */
export const BREASTFEEDING_EXTRA_KCAL = 500;
/** Efter 6 måneder ammes der typisk delvist (fast føde indføres); appen
 * regner med ca. 60 % af det fulde tillæg. EFSA sætter intet fast tal her. */
export const BREASTFEEDING_PARTIAL_EXTRA_KCAL = 300;
export const BREASTFEEDING_FULL_WEEKS = 26;

export const MIN_PREGNANCY_WEEK = 1;
export const MAX_PREGNANCY_WEEK = 42;
export const MAX_BREASTFEEDING_WEEKS = 156;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type PregnancyFields = {
  pregnancyStatus: PregnancyStatus | null;
  pregnancyWeek: number | null;
  breastfeedingWeeks: number | null;
  pregnancyStatusUpdatedAt: Date | string | null;
};

export type PregnancyInfo = {
  status: PregnancyStatus;
  /** Aktuel graviditetsuge (kun PREGNANT). */
  week: number | null;
  trimester: 1 | 2 | 3 | null;
  /** Uger ammet indtil nu (kun BREASTFEEDING). */
  breastfeedingWeeks: number | null;
  extraKcal: number;
};

export function isPregnancyStatus(value: unknown): value is PregnancyStatus {
  return typeof value === "string" && (PREGNANCY_STATUSES as readonly string[]).includes(value);
}

export function trimesterForWeek(week: number): 1 | 2 | 3 {
  if (week <= 13) return 1;
  if (week <= 27) return 2;
  return 3;
}

/** Hele uger gået siden tallet blev gemt (aldrig negativt). */
export function weeksSince(updatedAt: Date | string | null | undefined, now: Date): number {
  if (!updatedAt) return 0;
  const at = typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
  if (Number.isNaN(at.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / WEEK_MS));
}

export function currentPregnancyWeek(storedWeek: number | null, updatedAt: PregnancyFields["pregnancyStatusUpdatedAt"], now: Date): number | null {
  if (storedWeek === null || !Number.isFinite(storedWeek)) return null;
  return Math.min(MAX_PREGNANCY_WEEK, Math.max(MIN_PREGNANCY_WEEK, Math.round(storedWeek) + weeksSince(updatedAt, now)));
}

export function currentBreastfeedingWeeks(storedWeeks: number | null, updatedAt: PregnancyFields["pregnancyStatusUpdatedAt"], now: Date): number {
  const base = storedWeeks !== null && Number.isFinite(storedWeeks) ? Math.max(0, Math.round(storedWeeks)) : 0;
  return Math.min(MAX_BREASTFEEDING_WEEKS, base + weeksSince(updatedAt, now));
}

export function pregnancyExtraKcal(info: Pick<PregnancyInfo, "status" | "trimester" | "breastfeedingWeeks">): number {
  if (info.status === "PREGNANT") return PREGNANCY_EXTRA_KCAL[info.trimester ?? 3];
  const weeks = info.breastfeedingWeeks ?? 0;
  return weeks < BREASTFEEDING_FULL_WEEKS ? BREASTFEEDING_EXTRA_KCAL : BREASTFEEDING_PARTIAL_EXTRA_KCAL;
}

/** Status, uge/trimester og tillæg lige nu; null når hverken gravid eller ammende. */
export function pregnancyInfo(user: Partial<PregnancyFields> | null | undefined, now = new Date()): PregnancyInfo | null {
  const status = user?.pregnancyStatus ?? null;
  if (!isPregnancyStatus(status)) return null;
  const updatedAt = user?.pregnancyStatusUpdatedAt ?? null;
  if (status === "PREGNANT") {
    // Ukendt uge: regn med 3. trimester (højeste tillæg), så vi aldrig sætter et for lavt mål.
    const week = currentPregnancyWeek(user?.pregnancyWeek ?? null, updatedAt, now);
    const trimester = week === null ? 3 : trimesterForWeek(week);
    return { status, week, trimester, breastfeedingWeeks: null, extraKcal: pregnancyExtraKcal({ status, trimester, breastfeedingWeeks: null }) };
  }
  const breastfeedingWeeks = currentBreastfeedingWeeks(user?.breastfeedingWeeks ?? null, updatedAt, now);
  return { status, week: null, trimester: null, breastfeedingWeeks, extraKcal: pregnancyExtraKcal({ status, trimester: null, breastfeedingWeeks }) };
}
