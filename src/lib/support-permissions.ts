// Support-side (docs/DECISIONS.md 2026-09-23): the ONE list of personal data
// categories a user can let Hello Cal Support see for a limited period. Used
// by the settings page, the API validation and the admin support view, so
// the keys can never drift apart. Client-safe (no Prisma/server imports) —
// the server-side access check lives in src/lib/support-access.ts.
//
// Deliberately NOT here: the shared product database (Support never needs a
// user's permission to see shared product data) and anything security-related
// (password hash, TOTP secret, passkeys, session/device tokens, integration
// access/refresh tokens, payment-provider ids/card details). None of those
// can ever be selected or returned.

export const SUPPORT_PERMISSION_KEYS = [
  "profile",
  "calendar",
  "foodIntake",
  "calories",
  "energyDistribution",
  "nutrients",
  "favorites",
  "recipes",
  "productSubmissions",
  "searchHistory",
  "weight",
  "bodyMeasurements",
  "activity",
  "steps",
  "heartAndHealthMetrics",
  "stress",
  "sleep",
  "water",
  "menstrualCycle",
  "goals",
  "statistics",
  "integrations",
  "messages",
  "subscription",
  "helloDoc",
] as const;

export type SupportPermissionKey = (typeof SUPPORT_PERMISSION_KEYS)[number];

export type SupportPermissions = Record<SupportPermissionKey, boolean>;

// i18n key per category — "settings.support.permissions.<key>".
export function supportPermissionLabelKey(key: SupportPermissionKey) {
  return `settings.support.permissions.${key}`;
}

export function isSupportPermissionKey(value: unknown): value is SupportPermissionKey {
  return typeof value === "string" && (SUPPORT_PERMISSION_KEYS as readonly string[]).includes(value);
}

export function emptySupportPermissions(): SupportPermissions {
  return Object.fromEntries(SUPPORT_PERMISSION_KEYS.map((key) => [key, false])) as SupportPermissions;
}

// Reads a stored/received permissions object. Unknown keys are dropped and
// anything that isn't literally `true` counts as off.
export function readSupportPermissions(value: unknown): SupportPermissions {
  const out = emptySupportPermissions();
  if (!value || typeof value !== "object" || Array.isArray(value)) return out;
  for (const key of SUPPORT_PERMISSION_KEYS) {
    out[key] = (value as Record<string, unknown>)[key] === true;
  }
  return out;
}

// Calendar dates as chosen in <input type="date"> — kept as "YYYY-MM-DD"
// strings end to end so no timezone can shift the day.
export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const SUPPORT_REQUEST_CATEGORIES = ["ACCOUNT", "DATA", "PRODUCTS", "PAYMENT", "BUG", "OTHER"] as const;

export type SupportRequestCategoryKey = (typeof SUPPORT_REQUEST_CATEGORIES)[number];

export function isSupportRequestCategory(value: unknown): value is SupportRequestCategoryKey {
  return typeof value === "string" && (SUPPORT_REQUEST_CATEGORIES as readonly string[]).includes(value);
}
