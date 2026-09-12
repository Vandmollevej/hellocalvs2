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

export const DOCTOR_SHARE_INVITATION_VALID_DAYS = 14;

// A PENDING invitation whose 14-day acceptance window has passed — used by
// both the token-authenticated external view (/hello-doc/[token]) and its
// accept action to decide whether to flip the share to EXPIRED instead of
// ACTIVE. Only meaningful for PENDING shares; ACTIVE access has no
// expiry (see docs/DECISIONS.md 2026-09-12).
export function isDoctorSharePendingExpired(share: { status: string; expiresAt: Date | string | null }) {
  if (share.status !== "PENDING" || !share.expiresAt) return false;
  return new Date(share.expiresAt).getTime() <= Date.now();
}
