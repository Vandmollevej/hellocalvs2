// Omsætning af Garmins Health API-opsummeringer til Hello Cals fælles poster
// (ren funktion, testes i src/lib/integration-items.test.mjs).

import type { IntegrationItem } from "@/lib/integrations/store-items";

export type GarminSummaryKind =
  | "dailies"
  | "activities"
  | "sleeps"
  | "bodyComps"
  | "bloodPressures"
  | "userMetrics"
  | "hrv"
  | "pulseox"
  | "respiration";
export const GARMIN_SUMMARY_KINDS: GarminSummaryKind[] = [
  "dailies",
  "activities",
  "sleeps",
  "bodyComps",
  "bloodPressures",
  "userMetrics",
  "hrv",
  "pulseox",
  "respiration",
];

type Daily = {
  calendarDate?: string;
  steps?: number;
  distanceInMeters?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  floorsClimbed?: number;
  restingHeartRateInBeatsPerMinute?: number;
  averageHeartRateInBeatsPerMinute?: number;
  minHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;
  averageStressLevel?: number;
  moderateIntensityDurationInSeconds?: number;
  vigorousIntensityDurationInSeconds?: number;
};

type GarminActivity = {
  activityType?: string;
  startTimeInSeconds?: number;
  durationInSeconds?: number;
  activeKilocalories?: number;
};

type Sleep = {
  calendarDate?: string;
  durationInSeconds?: number;
  deepSleepDurationInSeconds?: number;
  lightSleepDurationInSeconds?: number;
  remSleepInSeconds?: number;
  awakeDurationInSeconds?: number;
  overallSleepScore?: { value?: number };
};

type BodyComp = {
  measurementTimeInSeconds?: number;
  weightInGrams?: number;
  bodyFatInPercent?: number;
  muscleMassInGrams?: number;
  boneMassInGrams?: number;
  bodyWaterInPercent?: number;
  bodyMassIndex?: number;
};

type BloodPressure = { measurementTimeInSeconds?: number; systolic?: number; diastolic?: number; pulse?: number };
type UserMetrics = { calendarDate?: string; vo2Max?: number; fitnessAge?: number };
type Hrv = { calendarDate?: string; lastNightAvg?: number };
// Målinger pr. tidsrum: værdi pr. sekund-offset fra startTimeInSeconds.
type Pulseox = { startTimeInSeconds?: number; timeOffsetSpo2Values?: Record<string, number> };
type Respiration = { startTimeInSeconds?: number; timeOffsetEpochToBreaths?: Record<string, number> };

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const minutes = (seconds: number | undefined) => (positive(seconds) ? Math.round(seconds / 60) : null);
const dayKey = (calendarDate: string) => `${calendarDate}T00:00:00.000Z`;

// Gennemsnit af et tidsrums målinger, gemt på tidsrummets start (så flere
// tidsrum samme dag ikke overskriver hinanden).
function averageOf(values: Record<string, number> | undefined) {
  const list = Object.values(values ?? {}).filter(positive);
  return list.length ? Math.round((list.reduce((sum, v) => sum + v, 0) / list.length) * 10) / 10 : null;
}

function metric(type: string, value: number | null | undefined, recordedAt: string): IntegrationItem[] {
  return value === null || value === undefined || !Number.isFinite(value)
    ? []
    : [{ kind: "metric", payload: { source: "GARMIN", type, value, recordedAt } }];
}

// Omsætter Garmins opsummeringer til Hello Cals fælles poster.
export function garminItems(kind: GarminSummaryKind, records: unknown[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const raw of records) {
    if (kind === "dailies") {
      const d = raw as Daily;
      if (!d.calendarDate) continue;
      const at = dayKey(d.calendarDate);
      const active = (d.moderateIntensityDurationInSeconds ?? 0) + (d.vigorousIntensityDurationInSeconds ?? 0);
      const intense = (d.moderateIntensityDurationInSeconds ?? 0) + 2 * (d.vigorousIntensityDurationInSeconds ?? 0);
      items.push(
        ...metric("STEPS", d.steps, at),
        ...metric("DISTANCE_KM", positive(d.distanceInMeters) ? Math.round(d.distanceInMeters / 10) / 100 : null, at),
        ...metric("ACTIVE_ENERGY_KCAL", d.activeKilocalories, at),
        ...metric("RESTING_ENERGY_KCAL", positive(d.bmrKilocalories) ? d.bmrKilocalories : null, at),
        ...metric("FLOORS_CLIMBED", d.floorsClimbed, at),
        ...metric("RESTING_HEART_RATE_BPM", positive(d.restingHeartRateInBeatsPerMinute) ? d.restingHeartRateInBeatsPerMinute : null, at),
        ...metric("HEART_RATE_BPM", positive(d.averageHeartRateInBeatsPerMinute) ? d.averageHeartRateInBeatsPerMinute : null, at),
        ...metric("HEART_RATE_MIN_BPM", positive(d.minHeartRateInBeatsPerMinute) ? d.minHeartRateInBeatsPerMinute : null, at),
        ...metric("HEART_RATE_MAX_BPM", positive(d.maxHeartRateInBeatsPerMinute) ? d.maxHeartRateInBeatsPerMinute : null, at),
        // Garmin bruger -1 for "ikke målt".
        ...metric("STRESS_SCORE", positive(d.averageStressLevel) ? d.averageStressLevel : null, at),
        ...metric("EXERCISE_MINUTES", active > 0 ? Math.round(active / 60) : null, at),
        // Intensitetsminutter tæller kraftig aktivitet dobbelt (WHO-reglen).
        ...metric("ACTIVE_ZONE_MINUTES", intense > 0 ? Math.round(intense / 60) : null, at)
      );
    } else if (kind === "activities") {
      const a = raw as GarminActivity;
      if (!positive(a.startTimeInSeconds) || !positive(a.durationInSeconds)) continue;
      items.push({
        kind: "activity",
        payload: {
          source: "GARMIN",
          sportType: (a.activityType ?? "workout").toLowerCase(),
          startedAt: new Date(a.startTimeInSeconds * 1000).toISOString(),
          durationMinutes: Math.round(a.durationInSeconds / 60),
          caloriesBurned: Math.round(a.activeKilocalories ?? 0),
        },
      });
    } else if (kind === "sleeps") {
      const s = raw as Sleep;
      if (!s.calendarDate || !positive(s.durationInSeconds)) continue;
      const at = dayKey(s.calendarDate);
      items.push(
        ...metric("SLEEP_MINUTES", minutes(s.durationInSeconds), at),
        ...metric("SLEEP_DEEP_MINUTES", minutes(s.deepSleepDurationInSeconds), at),
        ...metric("SLEEP_LIGHT_MINUTES", minutes(s.lightSleepDurationInSeconds), at),
        ...metric("SLEEP_REM_MINUTES", minutes(s.remSleepInSeconds), at),
        ...metric("SLEEP_AWAKE_MINUTES", minutes(s.awakeDurationInSeconds), at),
        ...metric("SLEEP_SCORE", positive(s.overallSleepScore?.value) ? s.overallSleepScore.value : null, at)
      );
    } else if (kind === "bodyComps") {
      const b = raw as BodyComp;
      if (!positive(b.measurementTimeInSeconds)) continue;
      const at = new Date(b.measurementTimeInSeconds * 1000).toISOString();
      if (positive(b.weightInGrams)) {
        items.push({ kind: "weight", payload: { source: "GARMIN", weightKg: b.weightInGrams / 1000, weighedAt: at } });
      }
      items.push(
        ...metric("BODY_FAT_PERCENT", positive(b.bodyFatInPercent) ? b.bodyFatInPercent : null, at),
        ...metric("MUSCLE_MASS_KG", positive(b.muscleMassInGrams) ? b.muscleMassInGrams / 1000 : null, at),
        ...metric("BONE_MASS_KG", positive(b.boneMassInGrams) ? b.boneMassInGrams / 1000 : null, at),
        ...metric("BODY_WATER_PERCENT", positive(b.bodyWaterInPercent) ? b.bodyWaterInPercent : null, at),
        ...metric("BONE_MASS_KG", positive(b.boneMassInGrams) ? b.boneMassInGrams / 1000 : null, at),
        ...metric("BMI", positive(b.bodyMassIndex) ? b.bodyMassIndex : null, at)
      );
    } else if (kind === "bloodPressures") {
      const b = raw as BloodPressure;
      if (!positive(b.measurementTimeInSeconds)) continue;
      const at = new Date(b.measurementTimeInSeconds * 1000).toISOString();
      items.push(
        ...metric("BLOOD_PRESSURE_SYSTOLIC_MMHG", positive(b.systolic) ? b.systolic : null, at),
        ...metric("BLOOD_PRESSURE_DIASTOLIC_MMHG", positive(b.diastolic) ? b.diastolic : null, at),
        ...metric("HEART_RATE_BPM", positive(b.pulse) ? b.pulse : null, at)
      );
    } else if (kind === "userMetrics") {
      const u = raw as UserMetrics;
      if (!u.calendarDate) continue;
      const at = dayKey(u.calendarDate);
      items.push(
        ...metric("VO2_MAX", positive(u.vo2Max) ? u.vo2Max : null, at),
        ...metric("FITNESS_AGE_YEARS", positive(u.fitnessAge) ? u.fitnessAge : null, at)
      );
    } else if (kind === "hrv") {
      const h = raw as Hrv;
      if (!h.calendarDate) continue;
      items.push(...metric("HEART_RATE_VARIABILITY_MS", positive(h.lastNightAvg) ? h.lastNightAvg : null, dayKey(h.calendarDate)));
    } else if (kind === "pulseox") {
      const o = raw as Pulseox;
      if (!positive(o.startTimeInSeconds)) continue;
      items.push(...metric("OXYGEN_SATURATION_PERCENT", averageOf(o.timeOffsetSpo2Values), new Date(o.startTimeInSeconds * 1000).toISOString()));
    } else if (kind === "respiration") {
      const r = raw as Respiration;
      if (!positive(r.startTimeInSeconds)) continue;
      items.push(...metric("RESPIRATORY_RATE_BPM", averageOf(r.timeOffsetEpochToBreaths), new Date(r.startTimeInSeconds * 1000).toISOString()));
    }
  }
  return items;
}
