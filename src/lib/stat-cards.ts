// Defines the stat cards the user can assemble on the Statistics page.
// The cards' order/active set is stored by StatCardsGrid (localStorage), not here.

import {
  IconActivity,
  IconApple,
  IconAtom2,
  IconBeer,
  IconBolt,
  IconBone,
  IconBottle,
  IconCandy,
  IconCarrot,
  IconDroplet,
  IconEgg,
  IconFeather,
  IconFish,
  IconFlame,
  IconHeartbeat,
  IconLeaf,
  IconLemon2,
  IconMeat,
  IconPig,
  IconRoute,
  IconSalt,
  IconTargetArrow,
  IconToolsKitchen2,
  IconWalk,
  type Icon,
} from "@tabler/icons-react";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import type { DailyTotal } from "@/lib/daily-totals";
import { getSportMeta } from "@/lib/sport-icons";
import {
  alcoholTotals,
  formatAmount,
  formatGrams,
  formatVolume,
  meatTotals,
  sugaryDrinkKcal,
  type MeatType,
  type SourceRegistration,
} from "@/lib/food-classification";

export const STAT_WINDOW_DAYS = 30;

export type StatCardValue = {
  key: string;
  label: string;
  icon: Icon;
  // Public image path (periodic-table icon for minerals, vitamin icon for
  // vitamins). When set, StatCardIcon renders this instead of `icon`.
  iconSrc?: string;
  value: string;
  // True only when a separately validated, region/profile-aware recommendation
  // evaluator has determined the value is outside the applicable normal
  // range. This app does not ship such an evaluator yet, so no compute()
  // below ever sets this — it exists so StatCardsGrid's red-stroke rendering
  // (gated behind User.warnOnRecommendedLimits) has something real to read
  // once one exists, instead of inventing thresholds now.
  outsideRecommendedRange?: boolean;
};

export type ActivityTotals = {
  sportType: string;
  durationMinutes: number;
  caloriesBurned: number;
  startedAt: string;
};

// Loosely coupled to HealthMetricType (Prisma) — `type` is a free string here so
// this shared lib doesn't get a hard dependency on @prisma/client.
export type HealthMetricTotals = {
  type: string;
  value: number;
  recordedAt: string;
};

export type StatCardData = {
  days: DailyTotal[];
  // Only set when at least one real integration (Fitbit/Withings) is CONNECTED,
  // per docs/DECISIONS.md — see where computeStatCards() is called from.
  activities?: ActivityTotals[];
  // From a future HealthKit/Health Connect companion app (see
  // docs/HEALTHKIT_COMPANION.md) — empty/undefined until data exists.
  metrics?: HealthMetricTotals[];
  // G3: periodens registreringer med klassifikation (kødtype, alkohol,
  // sukkerholdig drik). Kortene nedenfor viser totaler for perioden, ikke
  // dagsgennemsnit. Udeladt = "—".
  sources?: SourceRegistration[];
};

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function average(days: DailyTotal[], pick: (d: DailyTotal) => number) {
  if (days.length === 0) return 0;
  return days.reduce((sum, d) => sum + pick(d), 0) / days.length;
}

/** Gennemsnit af én HealthMetricType's værdier (typisk én række pr. dag fra
 * companion-appen) — null hvis der slet ingen data findes for typen endnu. */
function averageMetric(metrics: HealthMetricTotals[] | undefined, type: string): number | null {
  const matching = (metrics ?? []).filter((m) => m.type === type);
  if (matching.length === 0) return null;
  return matching.reduce((sum, m) => sum + m.value, 0) / matching.length;
}

/** Formatteret gennemsnit af en HealthMetricType, eller "—" uden data — aldrig
 * et opdigtet eksempeltal. */
function metricValue(data: StatCardData, type: string, unit = "", maximumFractionDigits = 0): string {
  const avg = averageMetric(data.metrics, type);
  if (avg === null) return "—";
  const formatted = formatNumber(avg, maximumFractionDigits);
  return unit ? `${formatted} ${unit}` : formatted;
}

function meatCard(type: MeatType, field: "grams" | "kcal") {
  return (data: StatCardData) => {
    if (!data.sources) return "—";
    const value = meatTotals(data.sources)[type][field];
    return field === "grams" ? formatGrams(value) : `${formatAmount(value)} kcal`;
  };
}

function alcoholCard(field: "kcal" | "units" | "volume") {
  return (data: StatCardData) => {
    if (!data.sources) return "—";
    const totals = alcoholTotals(data.sources);
    if (field === "kcal") return `${formatAmount(totals.kcal)} kcal`;
    if (field === "units") return `${formatAmount(totals.units, 1)} genst.`;
    return formatVolume(totals.volumeMl);
  };
}

function metricHoursMinutes(data: StatCardData, type: string): string {
  const avg = averageMetric(data.metrics, type);
  if (avg === null) return "—";
  const minutes = Math.max(0, Math.round(avg));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours} t ${rest} min` : `${rest} min`;
}

/** Klokketid fra minut-i-døgnet (0-1439), fx sengetid/opvågningstidspunkt. */
function minuteOfDay(data: StatCardData, type: string): string {
  const avg = averageMetric(data.metrics, type);
  if (avg === null) return "—";
  const minutes = ((Math.round(avg) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export const STAT_CARD_DEFS: {
  key: string;
  label: string;
  icon: Icon;
  iconSrc?: string;
  compute: (data: StatCardData) => string;
}[] = [
  {
    key: "calories",
    label: "Kalorier",
    icon: IconFlame,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.kcal))} kcal`,
  },
  {
    key: "protein",
    label: "Protein",
    icon: IconEgg,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.protein))} g`,
  },
  {
    key: "carbs",
    label: "Kulhydrat",
    icon: IconToolsKitchen2,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.carbs))} g`,
  },
  {
    key: "fat",
    label: "Fedt",
    icon: IconDroplet,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.fat))} g`,
  },
  // sugar/fiber/salt/potassium/calcium/iron only have real values on days with
  // at least one HelloFresh-recipe registration (the only source that carries
  // Product.nutritionExtra, see docs/DECISIONS.md 2026-08-29) — days without
  // one contribute 0, same zero-fill approach as every other average here.
  {
    key: "sugar",
    label: "Sukker",
    icon: IconCandy,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.sugar), 1)} g`,
  },
  {
    key: "fiber",
    label: "Kostfibre",
    icon: IconLeaf,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.fiber), 1)} g`,
  },
  {
    key: "salt",
    label: "Salt",
    icon: IconSalt,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.salt), 1)} g`,
  },
  // Mineraler og vitaminer — billedikoner fra public/icons/minerals og
  // public/icons/vitamins (StatCardIcon.tsx renderer card.iconSrc i stedet
  // for card.icon).
  {
    key: "potassium",
    label: "Kalium",
    iconSrc: "/icons/minerals/potassium.png",
    icon: IconApple,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.potassium))} mg`,
  },
  {
    key: "calcium",
    label: "Calcium",
    iconSrc: "/icons/minerals/calcium.png",
    icon: IconBone,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.calcium))} mg`,
  },
  {
    key: "iron",
    label: "Jern",
    iconSrc: "/icons/minerals/iron.png",
    icon: IconAtom2,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.iron), 1)} mg`,
  },
  // The remaining minerals have no product-level data source yet (no snapshot
  // field on Registration, unlike potassium/calcium/iron above) — real once a
  // HealthKit/Health Connect companion app or a richer food database sends
  // them, "—" until then.
  { key: "sodium", label: "Natrium", iconSrc: "/icons/minerals/sodium.png", icon: IconAtom2, compute: (data) => metricValue(data, "SODIUM_MG", "mg") },
  { key: "magnesium", label: "Magnesium", iconSrc: "/icons/minerals/magnesium.png", icon: IconAtom2, compute: (data) => metricValue(data, "MAGNESIUM_MG", "mg") },
  { key: "zinc", label: "Zink", iconSrc: "/icons/minerals/zinc.png", icon: IconAtom2, compute: (data) => metricValue(data, "ZINC_MG", "mg", 1) },
  { key: "copper", label: "Kobber", iconSrc: "/icons/minerals/copper.png", icon: IconAtom2, compute: (data) => metricValue(data, "COPPER_MG", "mg", 1) },
  { key: "manganese", label: "Mangan", iconSrc: "/icons/minerals/manganese.png", icon: IconAtom2, compute: (data) => metricValue(data, "MANGANESE_MG", "mg", 1) },
  { key: "selenium", label: "Selen", iconSrc: "/icons/minerals/selenium.png", icon: IconAtom2, compute: (data) => metricValue(data, "SELENIUM_UG", "µg") },
  { key: "phosphorus", label: "Fosfor", iconSrc: "/icons/minerals/phosphorus.png", icon: IconAtom2, compute: (data) => metricValue(data, "PHOSPHORUS_MG", "mg") },
  { key: "iodine", label: "Jod", iconSrc: "/icons/minerals/iodine.png", icon: IconAtom2, compute: (data) => metricValue(data, "IODINE_UG", "µg") },
  { key: "chromium", label: "Krom", iconSrc: "/icons/minerals/chromium.png", icon: IconAtom2, compute: (data) => metricValue(data, "CHROMIUM_UG", "µg") },
  { key: "molybdenum", label: "Molybdæn", iconSrc: "/icons/minerals/molybdenum.png", icon: IconAtom2, compute: (data) => metricValue(data, "MOLYBDENUM_UG", "µg") },
  { key: "chloride", label: "Klorid", iconSrc: "/icons/minerals/chloride.png", icon: IconAtom2, compute: (data) => metricValue(data, "CHLORIDE_MG", "mg") },
  { key: "fluoride", label: "Fluorid", iconSrc: "/icons/minerals/fluoride.png", icon: IconAtom2, compute: (data) => metricValue(data, "FLUORIDE_MG", "mg", 1) },
  // MyFitnessPal-style extended panel (2026-09-11): only has real values on
  // products imported from Open Food Facts so far (see
  // src/lib/openFoodFacts.ts) — same zero-fill averaging as above otherwise.
  {
    key: "saturatedFat",
    label: "Mættet fedt",
    icon: IconDroplet,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.saturatedFat), 1)} g`,
  },
  {
    key: "unsaturatedFat",
    label: "Umættet fedt",
    icon: IconDroplet,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.unsaturatedFat), 1)} g`,
  },
  {
    key: "transFat",
    label: "Transfedt",
    icon: IconDroplet,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.transFat), 2)} g`,
  },
  {
    key: "cholesterol",
    label: "Kolesterol",
    icon: IconHeartbeat,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.cholesterol))} mg`,
  },
  {
    key: "vitaminA",
    label: "Vitamin A",
    iconSrc: "/icons/vitamins/vitamin-a.png",
    icon: IconCarrot,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.vitaminA))} µg`,
  },
  {
    key: "vitaminC",
    label: "Vitamin C",
    iconSrc: "/icons/vitamins/vitamin-c.png",
    icon: IconLemon2,
    compute: (data) => `${formatNumber(average(data.days, (d) => d.vitaminC))} mg`,
  },
  // The rest of the B/D/E/K vitamins have no product-level data source yet —
  // same "real once a companion app sends it" pattern as the trace minerals.
  { key: "vitaminD", label: "Vitamin D", iconSrc: "/icons/vitamins/vitamin-d.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_D_UG", "µg", 1) },
  { key: "vitaminE", label: "Vitamin E", iconSrc: "/icons/vitamins/vitamin-e.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_E_MG", "mg", 1) },
  { key: "vitaminK", label: "Vitamin K", iconSrc: "/icons/vitamins/vitamin-k.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_K_UG", "µg") },
  { key: "vitaminB1", label: "Vitamin B1", iconSrc: "/icons/vitamins/vitamin-b1.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B1_MG", "mg", 1) },
  { key: "vitaminB2", label: "Vitamin B2", iconSrc: "/icons/vitamins/vitamin-b2.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B2_MG", "mg", 1) },
  { key: "vitaminB3", label: "Vitamin B3", iconSrc: "/icons/vitamins/vitamin-b3.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B3_MG", "mg", 1) },
  { key: "vitaminB5", label: "Vitamin B5", iconSrc: "/icons/vitamins/vitamin-b5.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B5_MG", "mg", 1) },
  { key: "vitaminB6", label: "Vitamin B6", iconSrc: "/icons/vitamins/vitamin-b6.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B6_MG", "mg", 1) },
  { key: "vitaminB7", label: "Vitamin B7", iconSrc: "/icons/vitamins/vitamin-b7.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B7_UG", "µg") },
  { key: "vitaminB9", label: "Vitamin B9", iconSrc: "/icons/vitamins/vitamin-b9.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B9_UG", "µg") },
  { key: "vitaminB12", label: "Vitamin B12", iconSrc: "/icons/vitamins/vitamin-b12.png", icon: IconLemon2, compute: (data) => metricValue(data, "VITAMIN_B12_UG", "µg", 1) },
  // Allergener og E-numre: Product.allergens/additives (see prisma/schema.prisma)
  // exist per-product, but Registration has no allergen/additive snapshot
  // field yet (unlike the nutrition snapshot fields), so a real per-period
  // aggregate isn't wired up here — placeholder "—" rather than an
  // aggregate built on top of the *current* product record, which would
  // break registration snapshot semantics. See docs/DECISIONS.md.
  { key: "allergens", label: "Allergener", icon: IconActivity, compute: () => "—" },
  { key: "additives", label: "E-numre", icon: IconActivity, compute: () => "—" },
  // G3 (docs/DECISIONS.md 2026-09-24): totaler for perioden.
  { key: "beefGrams", label: "Oksekød", icon: IconMeat, compute: meatCard("BEEF", "grams") },
  { key: "beefKcal", label: "Oksekød (kcal)", icon: IconMeat, compute: meatCard("BEEF", "kcal") },
  { key: "porkGrams", label: "Grisekød", icon: IconPig, compute: meatCard("PORK", "grams") },
  { key: "porkKcal", label: "Grisekød (kcal)", icon: IconPig, compute: meatCard("PORK", "kcal") },
  { key: "poultryGrams", label: "Fjerkræ", icon: IconFeather, compute: meatCard("POULTRY", "grams") },
  { key: "poultryKcal", label: "Fjerkræ (kcal)", icon: IconFeather, compute: meatCard("POULTRY", "kcal") },
  { key: "fishGrams", label: "Fisk", icon: IconFish, compute: meatCard("FISH", "grams") },
  { key: "fishKcal", label: "Fisk (kcal)", icon: IconFish, compute: meatCard("FISH", "kcal") },
  {
    key: "sugaryDrinks",
    label: "Sukkerholdige drikke",
    icon: IconBottle,
    compute: (data) => (data.sources ? `${formatAmount(sugaryDrinkKcal(data.sources))} kcal` : "—"),
  },
  { key: "alcoholKcal", label: "Alkohol", icon: IconBeer, compute: alcoholCard("kcal") },
  { key: "alcoholUnits", label: "Alkohol (genstande)", icon: IconBeer, compute: alcoholCard("units") },
  { key: "alcoholVolume", label: "Alkohol (mængde)", icon: IconBeer, compute: alcoholCard("volume") },
  {
    key: "daysLogged",
    label: "Dage logget",
    icon: IconTargetArrow,
    compute: (data) => `${data.days.length}`,
  },
  {
    key: "goalsMet",
    label: "Mål nået",
    icon: IconTargetArrow,
    compute: (data) => `${data.days.filter((d) => d.kcal > 0 && d.kcal <= DAILY_KCAL_GOAL).length} dage`,
  },
  // Sport og aktivitet. Manglende integrationsdata vises som en streg — aldrig
  // som et opdigtet eksempeltal.
  {
    key: "steps",
    label: "Skridt",
    icon: IconWalk,
    compute: (data) => metricValue(data, "STEPS"),
  },
  {
    key: "water",
    label: "Vand",
    icon: IconDroplet,
    compute: (data) => {
      const avg = averageMetric(data.metrics, "WATER_ML");
      return avg !== null ? `${(avg / 1000).toFixed(1).replace(".", ",")} l` : "—";
    },
  },
  {
    key: "burned",
    label: "Forbrændt",
    icon: IconBolt,
    compute: (data) => metricValue(data, "ACTIVE_ENERGY_KCAL", "kcal"),
  },
  {
    key: "distanceKm",
    label: "Kilometer",
    icon: IconRoute,
    compute: (data) => metricValue(data, "DISTANCE_KM", "km", 1),
  },
  { key: "exerciseMinutes", label: "Aktive minutter", icon: IconActivity, compute: (data) => metricValue(data, "EXERCISE_MINUTES", "min") },
  { key: "standMinutes", label: "Aktive timer", icon: IconActivity, compute: (data) => metricHoursMinutes(data, "STAND_MINUTES") },
  { key: "floorsClimbed", label: "Etager", icon: IconActivity, compute: (data) => metricValue(data, "FLOORS_CLIMBED") },
  { key: "activeZoneMinutes", label: "Zoneminutter", icon: IconTargetArrow, compute: (data) => metricValue(data, "ACTIVE_ZONE_MINUTES", "min") },
  { key: "heartRate", label: "Puls", icon: IconHeartbeat, compute: (data) => metricValue(data, "HEART_RATE_BPM", "bpm") },
  { key: "restingHeartRate", label: "Hvilepuls", icon: IconHeartbeat, compute: (data) => metricValue(data, "RESTING_HEART_RATE_BPM", "bpm") },
  { key: "restingHeartRateMinutes", label: "Tid med hvilepuls", icon: IconHeartbeat, compute: (data) => metricValue(data, "RESTING_HEART_RATE_MINUTES", "min") },
  { key: "heartRateMin", label: "Laveste puls", icon: IconHeartbeat, compute: (data) => metricValue(data, "HEART_RATE_MIN_BPM", "bpm") },
  { key: "heartRateMax", label: "Højeste puls", icon: IconHeartbeat, compute: (data) => metricValue(data, "HEART_RATE_MAX_BPM", "bpm") },
  { key: "hrv", label: "HRV", icon: IconHeartbeat, compute: (data) => metricValue(data, "HEART_RATE_VARIABILITY_MS", "ms", 1) },
  { key: "vo2Max", label: "VO₂ max", icon: IconHeartbeat, compute: (data) => metricValue(data, "VO2_MAX", "ml/kg/min", 1) },
  { key: "heartRateRecovery", label: "Pulsrestitution", icon: IconHeartbeat, compute: (data) => metricValue(data, "HEART_RATE_RECOVERY_BPM", "bpm") },
  { key: "respiratoryRate", label: "Vejrtrækningsfrekvens", icon: IconActivity, compute: (data) => metricValue(data, "RESPIRATORY_RATE_BPM", "/min", 1) },
  { key: "spo2", label: "SpO₂", icon: IconActivity, compute: (data) => metricValue(data, "OXYGEN_SATURATION_PERCENT", "%", 1) },
  { key: "temperature", label: "Temperatur", icon: IconActivity, compute: (data) => metricValue(data, "TEMPERATURE_C", "°C", 1) },
  { key: "stress", label: "Stress", icon: IconActivity, compute: (data) => metricValue(data, "STRESS_SCORE") },
  { key: "edaResponses", label: "EDA-responser", icon: IconActivity, compute: (data) => metricValue(data, "EDA_RESPONSES") },
  { key: "cardioLoad", label: "Cardio load", icon: IconActivity, compute: (data) => metricValue(data, "CARDIO_LOAD", "", 1) },
  // Søvn. Klokketider er lagret som minut-i-døgnet fra en companion-app.
  { key: "sleepDuration", label: "Søvntid", icon: IconActivity, compute: (data) => metricHoursMinutes(data, "SLEEP_MINUTES") },
  { key: "sleepInBed", label: "Tid i seng", icon: IconActivity, compute: (data) => metricHoursMinutes(data, "SLEEP_IN_BED_MINUTES") },
  { key: "sleepBedtime", label: "Sengetid", icon: IconActivity, compute: (data) => minuteOfDay(data, "SLEEP_START_MINUTE_OF_DAY") },
  { key: "sleepWakeTime", label: "Opvågning", icon: IconActivity, compute: (data) => minuteOfDay(data, "SLEEP_END_MINUTE_OF_DAY") },
  { key: "sleepAwake", label: "Vågen", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_AWAKE_MINUTES", "min") },
  { key: "sleepRem", label: "REM-søvn", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_REM_MINUTES", "min") },
  { key: "sleepLight", label: "Let/Core-søvn", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_LIGHT_MINUTES", "min") },
  { key: "sleepDeep", label: "Dyb søvn", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_DEEP_MINUTES", "min") },
  { key: "sleepScore", label: "Søvnkvalitet", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_SCORE") },
  { key: "sleepEfficiency", label: "Søvneffektivitet", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_EFFICIENCY_PERCENT", "%", 1) },
  { key: "sleepAwakenings", label: "Opvågninger", icon: IconActivity, compute: (data) => metricValue(data, "SLEEP_AWAKENINGS") },
];

// The cards a fresh Statistik dashboard shows out of the box. Deliberately not
// "every STAT_CARD_DEFS key" — sugar/fiber/salt/potassium/calcium/iron only
// have data for HelloFresh-recipe registrations, so they start out available
// via "unused cards" (statistics/unused-cards) rather than cluttering the
// default view with mostly-zero cards for everyone else.
export const DEFAULT_ACTIVE_STAT_KEYS: string[] = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "beefGrams",
  "porkGrams",
  "poultryGrams",
  "fishGrams",
  "sugaryDrinks",
  "alcoholKcal",
  "daysLogged",
  "goalsMet",
  "steps",
  "water",
  "burned",
];

export const SPORT_STAT_KEY_PREFIX = "sport:";

// G3-kortene: vises under "Tilføj kort" i egen gruppe.
export const FOOD_SOURCE_STAT_KEYS: string[] = [
  "beefGrams", "beefKcal", "porkGrams", "porkKcal", "poultryGrams", "poultryKcal",
  "fishGrams", "fishKcal", "sugaryDrinks", "alcoholKcal", "alcoholUnits", "alcoholVolume",
];

// Always offered as sport cards (per the user's own request), even before any
// activity data exists for them — shown as an empty "—" placeholder until
// then. Additional sport types the user actually logs still appear
// dynamically alongside these.
const PINNED_SPORT_TYPES = ["running", "cycling", "swimming", "cardio", "ski"] as const;

// One card per sport type the user actually has activity data for (from a
// connected integration or their own manual logging), plus the pinned sport
// types above even with zero data — sports are otherwise open-ended/dynamic,
// so they can't be a fixed STAT_CARD_DEFS entry.
function computeSportStatCards(activities: ActivityTotals[]): StatCardValue[] {
  const bySport = new Map<string, { durationMinutes: number; caloriesBurned: number }>();
  for (const activity of activities) {
    const existing = bySport.get(activity.sportType) ?? { durationMinutes: 0, caloriesBurned: 0 };
    existing.durationMinutes += activity.durationMinutes;
    existing.caloriesBurned += activity.caloriesBurned;
    bySport.set(activity.sportType, existing);
  }

  const orderedTypes = [
    ...PINNED_SPORT_TYPES,
    ...Array.from(bySport.keys()).filter(
      (type) => !PINNED_SPORT_TYPES.includes(type as (typeof PINNED_SPORT_TYPES)[number]),
    ),
  ];

  return orderedTypes.map((sportType) => {
    const totals = bySport.get(sportType);
    const meta = getSportMeta(sportType);
    return {
      key: `${SPORT_STAT_KEY_PREFIX}${sportType}`,
      label: meta.label,
      icon: meta.icon,
      value: totals
        ? `${formatNumber(totals.durationMinutes)} min · ${formatNumber(totals.caloriesBurned)} kcal`
        : "—",
    };
  });
}

export function computeStatCards(data: StatCardData): StatCardValue[] {
  const staticCards = STAT_CARD_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    icon: def.icon,
    iconSrc: def.iconSrc,
    value: def.compute(data),
  }));
  const sportCards = data.activities ? computeSportStatCards(data.activities) : [];
  return [...staticCards, ...sportCards];
}

// Shared layout persistence for StatCardsGrid and the unused-cards page, so both
// read/write the same localStorage key without duplicating the logic.

export type StatLayoutItem = { type: "stat"; key: string };
export type StatHeaderLayoutItem = { type: "header"; id: string; text: string };
export type StatDividerLayoutItem = { type: "divider"; id: string };
/**
 * An explicitly empty half-width slot. The grid is two columns of physical
 * slots, so a gap the user leaves (e.g. a card moved to the right column) is
 * part of the saved layout and must never be compacted away.
 */
export type StatEmptyLayoutItem = { type: "empty"; id: string };
export type StatGridLayoutItem =
  | StatLayoutItem
  | StatHeaderLayoutItem
  | StatDividerLayoutItem
  | StatEmptyLayoutItem;

export const STAT_LAYOUT_STORAGE_KEY = "hellocal.statistik.layout";

function makeLayoutId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function makeEmptyStatSlot(): StatEmptyLayoutItem {
  return { type: "empty", id: makeLayoutId() };
}

/** Half-width items occupy one of the two column slots; headers/dividers span the full row. */
export function isHalfWidthStatItem(item: StatGridLayoutItem): item is StatLayoutItem | StatEmptyLayoutItem {
  return item.type === "stat" || item.type === "empty";
}

function trailingRunLength(layout: StatGridLayoutItem[]) {
  let count = 0;
  for (let i = layout.length - 1; i >= 0 && isHalfWidthStatItem(layout[i]); i -= 1) count += 1;
  return count;
}

/**
 * Makes every run of half-width slots between full-width items an even length
 * (so each row has exactly a left and a right slot) and drops completely empty
 * rows at the very end. Empty slots anywhere else are kept — they are the
 * user's layout. Older saved layouts without empty slots migrate through this.
 */
export function normalizeStatLayout(layout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const usedIds = new Set(layout.map((item) => ("id" in item ? item.id : item.key)));
  // Deterministic ids for filler slots, so the server render and the client's
  // first render of the same layout agree (no hydration mismatch).
  function filler(): StatEmptyLayoutItem {
    let n = next.length;
    while (usedIds.has(`pad-${n}`)) n += 1;
    usedIds.add(`pad-${n}`);
    return { type: "empty", id: `pad-${n}` };
  }
  const next: StatGridLayoutItem[] = [];
  let runLength = 0;
  for (const item of layout) {
    if (isHalfWidthStatItem(item)) {
      next.push(item);
      runLength += 1;
      continue;
    }
    if (runLength % 2 !== 0) next.push(filler());
    runLength = 0;
    next.push(item);
  }
  if (runLength % 2 !== 0) next.push(filler());

  while (
    trailingRunLength(next) >= 2 &&
    next[next.length - 1].type === "empty" &&
    next[next.length - 2].type === "empty"
  ) {
    next.splice(-2, 2);
  }
  return next;
}

export function loadStatLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  if (typeof window === "undefined") return normalizeStatLayout(defaultLayout);
  try {
    const raw = window.localStorage.getItem(STAT_LAYOUT_STORAGE_KEY);
    if (!raw) return normalizeStatLayout(defaultLayout);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return normalizeStatLayout(parsed);
    return normalizeStatLayout(defaultLayout);
  } catch {
    return normalizeStatLayout(defaultLayout);
  }
}

export function saveStatLayout(layout: StatGridLayoutItem[]) {
  try {
    window.localStorage.setItem(STAT_LAYOUT_STORAGE_KEY, JSON.stringify(normalizeStatLayout(layout)));
  } catch {
    // localStorage unavailable — ignore.
  }
}

/**
 * Adds a stat card at the bottom of the active layout if it isn't already
 * there — into the free right slot of the last row when there is one.
 */
export function addStatCardToLayout(defaultLayout: StatGridLayoutItem[], key: string): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const alreadyActive = current.some((item) => item.type === "stat" && item.key === key);
  if (alreadyActive) return current;
  const card = { type: "stat" as const, key };
  const last = current[current.length - 1];
  const next = last?.type === "empty" ? [...current.slice(0, -1), card] : [...current, card];
  saveStatLayout(next);
  return normalizeStatLayout(next);
}

/** Which card keys are active in the saved layout (or the default layout, if nothing is saved yet). */
export function activeStatKeys(defaultLayout: StatGridLayoutItem[]): Set<string> {
  const current = loadStatLayout(defaultLayout);
  return new Set(current.filter((item): item is StatLayoutItem => item.type === "stat").map((item) => item.key));
}

/** Tilføjer en ny "Overskrift"-sektionsskilledeler øverst i det aktive layout. */
export function addHeaderToLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}`;
  const next = [{ type: "header" as const, id, text: "Overskrift" }, ...current];
  saveStatLayout(next);
  return next;
}

/** Tilføjer en ny visuel skillelinje (divider) øverst i det aktive layout. */
export function addDividerToLayout(defaultLayout: StatGridLayoutItem[]): StatGridLayoutItem[] {
  const current = loadStatLayout(defaultLayout);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}`;
  const next = [{ type: "divider" as const, id }, ...current];
  saveStatLayout(next);
  return next;
}
