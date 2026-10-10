// Hello Doc: shared constants for "Del din fremgang med din læge eller
// diætist" (docs/DECISIONS.md 2026-09-12). Central list of data categories a
// user can opt to share, so the invite/edit form, the API validation, and the
// preview page all agree on the same keys.

export const DOCTOR_SHARE_CATEGORIES = [
  "profile",
  "weight",
  "goals",
  "menstrualCycle",
  "digestion",
  "sleep",
  "foodAndCalories",
  "vitaminsMinerals",
  "fluid",
] as const;

export type DoctorShareCategory = (typeof DOCTOR_SHARE_CATEGORIES)[number];

// Categories with no underlying data source anywhere in Hello Cal yet — shown
// in the UI as informational/disabled rather than a real toggle, same
// "unimplemented, not silently faked" convention as the rest of the app.
// - menstrualCycle: no cycle-tracking model exists (flagged when this feature
//   was built, see docs/DECISIONS.md).
// - digestion: explicitly deferred by the user themselves ("kommer senere").
export const DOCTOR_SHARE_UNAVAILABLE_CATEGORIES: DoctorShareCategory[] = ["menstrualCycle", "digestion"];

export const DEFAULT_DOCTOR_SHARE_CATEGORIES: DoctorShareCategory[] = DOCTOR_SHARE_CATEGORIES.filter(
  (category) => !DOCTOR_SHARE_UNAVAILABLE_CATEGORIES.includes(category)
);

export function isDoctorShareCategory(value: unknown): value is DoctorShareCategory {
  return typeof value === "string" && (DOCTOR_SHARE_CATEGORIES as readonly string[]).includes(value);
}

export function sanitizeDoctorShareCategories(value: unknown): DoctorShareCategory[] {
  if (!Array.isArray(value)) return [...DEFAULT_DOCTOR_SHARE_CATEGORIES];
  const filtered = value.filter(isDoctorShareCategory);
  return filtered.length > 0 ? filtered : [...DEFAULT_DOCTOR_SHARE_CATEGORIES];
}

export const DOCTOR_SHARE_HISTORY_RANGES = ["LAST_7_DAYS", "LAST_MONTH", "LAST_YEAR", "ALL"] as const;

export type DoctorShareHistoryRange = (typeof DOCTOR_SHARE_HISTORY_RANGES)[number];

export function isDoctorShareHistoryRange(value: unknown): value is DoctorShareHistoryRange {
  return typeof value === "string" && (DOCTOR_SHARE_HISTORY_RANGES as readonly string[]).includes(value);
}

export function historyRangeToDays(range: DoctorShareHistoryRange): number | null {
  switch (range) {
    case "LAST_7_DAYS":
      return 7;
    case "LAST_MONTH":
      return 30;
    case "LAST_YEAR":
      return 365;
    case "ALL":
      return null;
  }
}

// Udløbsdatoen vælges af ejeren med en datepicker ("YYYY-MM-DD") — tom/null
// betyder intet udløb. Adgangen gælder til og med den valgte dag.
export function parseDoctorShareExpiry(value: unknown): Date | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// True når den valgte udløbsdato er passeret — gælder både en ventende
// invitation og en aktiv adgang. Uden udløbsdato udløber intet.
export function isDoctorShareExpired(share: { status: string; expiresAt: Date | string | null }) {
  if ((share.status !== "PENDING" && share.status !== "ACTIVE") || !share.expiresAt) return false;
  return new Date(share.expiresAt).getTime() <= Date.now();
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

// Varighed/udløb som vist i oversigten og øverst på brugerens egen side.
export function doctorShareDurationLabel(
  share: { status: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED"; expiresAt: string | null },
  t: Translate
): string {
  if (share.status === "REVOKED") return t("helloDoc.statusRevoked");
  if (share.status === "EXPIRED") return t("helloDoc.expired");
  if (share.status === "ACTIVE" && !share.expiresAt) return t("helloDoc.permanent");
  if (!share.expiresAt) return t("helloDoc.pending");

  const msLeft = new Date(share.expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return t("helloDoc.expired");
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  return daysLeft <= 1 ? t("helloDoc.expiresToday") : t("helloDoc.expiresIn", { days: daysLeft });
}
