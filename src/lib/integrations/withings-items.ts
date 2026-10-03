// Omsætning af Withings' målinger, dagsaktivitet, søvn og træning til Hello
// Cals fælles poster (rene funktioner, testes i src/lib/integration-items.test.mjs).
// Alt, Withings kan måle, kommer med (brugerens krav 2026-10-03).

import type { IntegrationItem } from "@/lib/integrations/store-items";

// Withings' måletyper (meastype) → Hello Cal. Værdi = value * 10^unit.
// Kropsvand (77) gemmes som % af vægten i samme måling; højde (4) i cm.
export const WITHINGS_WEIGHT = 1;
const HEIGHT_M = 4;
const HYDRATION_KG = 77;
const MEASURE_METRIC: Record<number, string> = {
  5: "FAT_FREE_MASS_KG",
  6: "BODY_FAT_PERCENT",
  8: "FAT_MASS_KG",
  9: "BLOOD_PRESSURE_DIASTOLIC_MMHG",
  10: "BLOOD_PRESSURE_SYSTOLIC_MMHG",
  11: "HEART_RATE_BPM",
  12: "TEMPERATURE_C",
  54: "OXYGEN_SATURATION_PERCENT",
  71: "TEMPERATURE_C",
  73: "SKIN_TEMPERATURE_C",
  76: "MUSCLE_MASS_KG",
  88: "BONE_MASS_KG",
  91: "PULSE_WAVE_VELOCITY_M_S",
  123: "VO2_MAX",
  135: "QRS_INTERVAL_MS",
  136: "PR_INTERVAL_MS",
  137: "QT_INTERVAL_MS",
  138: "QTC_INTERVAL_MS",
  155: "VASCULAR_AGE_YEARS",
  167: "NERVE_HEALTH_SCORE",
  168: "EXTRACELLULAR_WATER_KG",
  169: "INTRACELLULAR_WATER_KG",
  170: "VISCERAL_FAT_INDEX",
  226: "BASAL_METABOLIC_RATE_KCAL",
  227: "METABOLIC_AGE_YEARS",
  229: "SKIN_CONDUCTANCE_US",
};

// Alle måletyper, der hentes. Ikke med: AFib-resultater (130/139, en
// klassifikation, ikke et tal) og segmentmålinger pr. arm/ben (173-175).
export const WITHINGS_MEASURE_TYPES = [WITHINGS_WEIGHT, HEIGHT_M, HYDRATION_KG, ...Object.keys(MEASURE_METRIC).map(Number)];

export type WithingsMeasureGroup = { date: number; measures: { value: number; type: number; unit: number }[] };

export type WithingsActivity = {
  date?: string;
  steps?: number;
  distance?: number;
  elevation?: number;
  soft?: number;
  moderate?: number;
  intense?: number;
  calories?: number;
  hr_average?: number;
  hr_min?: number;
  hr_max?: number;
};

export type WithingsSleep = {
  date?: string;
  startdate?: number;
  enddate?: number;
  timezone?: string;
  data?: {
    total_sleep_time?: number;
    total_timeinbed?: number;
    deepsleepduration?: number;
    lightsleepduration?: number;
    remsleepduration?: number;
    wakeupduration?: number;
    wakeupcount?: number;
    sleep_efficiency?: number;
    sleep_score?: number;
    rr_average?: number;
  };
};

export type WithingsWorkout = { category?: number; startdate?: number; enddate?: number; data?: { calories?: number } };

// Withings' træningskategorier → Hello Cals sportstyper (src/lib/sport-icons.ts).
const WORKOUT_CATEGORY: Record<number, string> = {
  1: "walking", 2: "running", 3: "hiking", 4: "skating", 6: "cycling", 7: "swimming", 8: "surfing",
  10: "windsurfing", 12: "tennis", 13: "table tennis", 14: "squash", 15: "badminton", 16: "strength",
  17: "bodyweight", 18: "elliptical", 19: "pilates", 20: "basketball", 21: "football", 23: "rugby",
  24: "volleyball", 25: "water_polo", 26: "horse riding", 27: "golf", 28: "yoga", 29: "dance", 30: "boxing",
  31: "fencing", 32: "wrestling", 33: "martial_arts", 34: "skiing", 35: "snowboarding", 187: "rowing",
  188: "zumba", 191: "baseball", 192: "handball", 193: "hockey", 194: "ice_hockey", 195: "climbing",
  196: "ice skating", 306: "walking", 307: "treadmill", 308: "spinning",
};

const SOURCE = "WITHINGS";
const round = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const minutes = (seconds: number | undefined) => (positive(seconds) ? Math.round(seconds / 60) : null);
const dayKey = (date: string) => `${date}T00:00:00.000Z`;

function metric(type: string, value: number | null | undefined, recordedAt: string): IntegrationItem[] {
  return typeof value === "number" && Number.isFinite(value) ? [{ kind: "metric", payload: { source: SOURCE, type, value, recordedAt } }] : [];
}

export function withingsMeasureItems(groups: WithingsMeasureGroup[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const group of groups) {
    const at = new Date(group.date * 1000).toISOString();
    const valueOf = (type: number) => {
      const found = group.measures.find((measure) => measure.type === type);
      return found ? found.value * Math.pow(10, found.unit) : null;
    };
    for (const m of group.measures) {
      const value = m.value * Math.pow(10, m.unit);
      if (m.type === WITHINGS_WEIGHT) {
        items.push({ kind: "weight", payload: { source: SOURCE, weightKg: value, weighedAt: at } });
      } else if (m.type === HEIGHT_M) {
        items.push(...metric("HEIGHT_CM", positive(value) ? round(value * 100) : null, at));
      } else if (m.type === HYDRATION_KG) {
        const weight = valueOf(WITHINGS_WEIGHT);
        if (weight && weight > 0) items.push(...metric("BODY_WATER_PERCENT", round((value / weight) * 100), at));
      } else if (MEASURE_METRIC[m.type]) {
        items.push(...metric(MEASURE_METRIC[m.type], round(value, 2), at));
      }
    }
  }
  return items;
}

// Én række pr. dag fra ur/aktivitetsmåler (ScanWatch, Pulse …).
export function withingsActivityItems(days: WithingsActivity[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const d of days) {
    if (!d.date) continue;
    const at = dayKey(d.date);
    const active = (d.moderate ?? 0) + (d.intense ?? 0);
    // Zoneminutter tæller hård aktivitet dobbelt (samme regel som Garmin).
    const zone = (d.moderate ?? 0) + 2 * (d.intense ?? 0);
    items.push(
      ...metric("STEPS", positive(d.steps) ? d.steps : null, at),
      ...metric("DISTANCE_KM", positive(d.distance) ? round(d.distance / 1000, 2) : null, at),
      // Withings' "elevation" er antal etager.
      ...metric("FLOORS_CLIMBED", positive(d.elevation) ? d.elevation : null, at),
      ...metric("ACTIVE_ENERGY_KCAL", positive(d.calories) ? Math.round(d.calories) : null, at),
      ...metric("EXERCISE_MINUTES", active > 0 ? Math.round(active / 60) : null, at),
      ...metric("ACTIVE_ZONE_MINUTES", zone > 0 ? Math.round(zone / 60) : null, at),
      ...metric("HEART_RATE_BPM", positive(d.hr_average) ? d.hr_average : null, at),
      ...metric("HEART_RATE_MIN_BPM", positive(d.hr_min) ? d.hr_min : null, at),
      ...metric("HEART_RATE_MAX_BPM", positive(d.hr_max) ? d.hr_max : null, at)
    );
  }
  return items;
}

// Minut i døgnet i søvnens egen tidszone (fx "Europe/Copenhagen").
function minuteOfDay(unixSeconds: number, timeZone: string | undefined) {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "Europe/Copenhagen", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(unixSeconds * 1000));
    const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return part("hour") * 60 + part("minute");
  } catch {
    return null;
  }
}

// Én nat pr. dato (Withings' "date" = dagen, natten sluttede).
export function withingsSleepItems(nights: WithingsSleep[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const n of nights) {
    const s = n.data;
    if (!n.date || !s) continue;
    const at = dayKey(n.date);
    // sleep_efficiency kommer som 0-1.
    const efficiency = positive(s.sleep_efficiency) ? round(s.sleep_efficiency <= 1 ? s.sleep_efficiency * 100 : s.sleep_efficiency) : null;
    items.push(
      ...metric("SLEEP_MINUTES", minutes(s.total_sleep_time), at),
      ...metric("SLEEP_IN_BED_MINUTES", minutes(s.total_timeinbed), at),
      ...metric("SLEEP_DEEP_MINUTES", minutes(s.deepsleepduration), at),
      ...metric("SLEEP_LIGHT_MINUTES", minutes(s.lightsleepduration), at),
      ...metric("SLEEP_REM_MINUTES", minutes(s.remsleepduration), at),
      ...metric("SLEEP_AWAKE_MINUTES", minutes(s.wakeupduration), at),
      ...metric("SLEEP_AWAKENINGS", typeof s.wakeupcount === "number" && s.wakeupcount >= 0 ? s.wakeupcount : null, at),
      ...metric("SLEEP_SCORE", positive(s.sleep_score) ? s.sleep_score : null, at),
      ...metric("SLEEP_EFFICIENCY_PERCENT", efficiency, at),
      ...metric("RESPIRATORY_RATE_BPM", positive(s.rr_average) ? s.rr_average : null, at),
      ...metric("SLEEP_START_MINUTE_OF_DAY", positive(n.startdate) ? minuteOfDay(n.startdate, n.timezone) : null, at),
      ...metric("SLEEP_END_MINUTE_OF_DAY", positive(n.enddate) ? minuteOfDay(n.enddate, n.timezone) : null, at)
    );
  }
  return items;
}

export function withingsWorkoutItems(workouts: WithingsWorkout[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const w of workouts) {
    if (!positive(w.startdate) || !positive(w.enddate) || w.enddate <= w.startdate) continue;
    items.push({
      kind: "activity",
      payload: {
        source: SOURCE,
        sportType: WORKOUT_CATEGORY[w.category ?? 0] ?? "other",
        startedAt: new Date(w.startdate * 1000).toISOString(),
        durationMinutes: Math.round((w.enddate - w.startdate) / 60),
        caloriesBurned: Math.round(w.data?.calories ?? 0),
      },
    });
  }
  return items;
}
