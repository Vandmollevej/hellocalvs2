// Omsætning af Polar AccessLinks søvn, Nightly Recharge, dagsaktivitet og
// cardio load til Hello Cals fælles poster (rene funktioner, testes i
// src/lib/integration-items.test.mjs). Feltnavne efter AccessLink v3; ikke
// prøvet mod live-API endnu.

import type { IntegrationItem } from "@/lib/integrations/store-items";

export type PolarNight = {
  date?: string;
  sleep_start_time?: string;
  sleep_end_time?: string;
  light_sleep?: number;
  deep_sleep?: number;
  rem_sleep?: number;
  unrecognized_sleep_stage?: number;
  total_interruption_duration?: number;
  sleep_score?: number;
};

export type PolarRecharge = {
  date?: string;
  heart_rate_avg?: number;
  heart_rate_variability_avg?: number;
  breathing_rate_avg?: number;
};

export type PolarDailyActivity = {
  start_time?: string;
  steps?: number;
  active_calories?: number;
  distance_from_steps?: number;
  active_duration?: string;
};

export type PolarCardioLoad = { date?: string; cardio_load?: number };

const SOURCE = "POLAR";
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const minutes = (seconds: number | undefined) => (positive(seconds) ? Math.round(seconds / 60) : null);
const dayKey = (date: string) => `${date.slice(0, 10)}T00:00:00.000Z`;

function metric(type: string, value: number | null | undefined, recordedAt: string): IntegrationItem[] {
  return positive(value) ? [{ kind: "metric", payload: { source: SOURCE, type, value, recordedAt } }] : [];
}

// "PT1H2M3S" → minutter.
export function isoDurationMinutes(value: string | undefined) {
  const m = value?.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  return Math.round(Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60);
}

// Klokkeslæt i tidsstemplets egen lokaltid, fx "2026-10-02T23:14:00+02:00" → 1394.
function localMinuteOfDay(iso: string | undefined) {
  const m = iso?.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function polarSleepItems(nights: PolarNight[]): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const n of nights) {
    if (!n.date) continue;
    const at = dayKey(n.date);
    const asleep = (n.light_sleep ?? 0) + (n.deep_sleep ?? 0) + (n.rem_sleep ?? 0) + (n.unrecognized_sleep_stage ?? 0);
    const inBed = n.sleep_start_time && n.sleep_end_time ? (Date.parse(n.sleep_end_time) - Date.parse(n.sleep_start_time)) / 1000 : NaN;
    items.push(
      ...metric("SLEEP_MINUTES", minutes(asleep), at),
      ...metric("SLEEP_IN_BED_MINUTES", Number.isFinite(inBed) ? minutes(inBed) : null, at),
      ...metric("SLEEP_LIGHT_MINUTES", minutes(n.light_sleep), at),
      ...metric("SLEEP_DEEP_MINUTES", minutes(n.deep_sleep), at),
      ...metric("SLEEP_REM_MINUTES", minutes(n.rem_sleep), at),
      ...metric("SLEEP_AWAKE_MINUTES", minutes(n.total_interruption_duration), at),
      ...metric("SLEEP_SCORE", n.sleep_score, at),
      ...metric("SLEEP_START_MINUTE_OF_DAY", localMinuteOfDay(n.sleep_start_time), at),
      ...metric("SLEEP_END_MINUTE_OF_DAY", localMinuteOfDay(n.sleep_end_time), at)
    );
  }
  return items;
}

export function polarRechargeItems(recharges: PolarRecharge[]): IntegrationItem[] {
  return recharges.flatMap((r) =>
    r.date
      ? [
          ...metric("RESTING_HEART_RATE_BPM", r.heart_rate_avg, dayKey(r.date)),
          ...metric("HEART_RATE_VARIABILITY_MS", r.heart_rate_variability_avg, dayKey(r.date)),
          ...metric("RESPIRATORY_RATE_BPM", r.breathing_rate_avg, dayKey(r.date)),
        ]
      : []
  );
}

export function polarDailyActivityItems(days: PolarDailyActivity[]): IntegrationItem[] {
  return days.flatMap((d) => {
    if (!d.start_time) return [];
    const at = dayKey(d.start_time);
    return [
      ...metric("STEPS", d.steps, at),
      ...metric("ACTIVE_ENERGY_KCAL", positive(d.active_calories) ? Math.round(d.active_calories) : null, at),
      ...metric("DISTANCE_KM", positive(d.distance_from_steps) ? Math.round(d.distance_from_steps / 10) / 100 : null, at),
      ...metric("EXERCISE_MINUTES", isoDurationMinutes(d.active_duration), at),
    ];
  });
}

export function polarCardioLoadItems(loads: PolarCardioLoad[]): IntegrationItem[] {
  return loads.flatMap((l) => (l.date ? metric("CARDIO_LOAD", l.cardio_load, dayKey(l.date)) : []));
}
