// Omsætning af WHOOP's træning, søvn og restitution til Hello Cals fælles
// poster (ren funktion, testes i src/lib/integration-items.test.mjs).

import type { IntegrationItem } from "@/lib/integrations/store-items";

const KJ_PER_KCAL = 4.184;

export type Workout = {
  start: string;
  end: string;
  sport_name?: string;
  score_state?: string;
  score?: { kilojoule?: number };
};

export type Sleep = {
  id: string;
  end: string;
  timezone_offset?: string;
  nap?: boolean;
  score_state?: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      disturbance_count?: number;
    };
    respiratory_rate?: number;
    sleep_performance_percentage?: number;
    sleep_efficiency_percentage?: number;
  };
};

export type Recovery = {
  sleep_id?: string;
  created_at: string;
  score_state?: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
};

// Et døgn ("cycle") med belastning (strain) og puls.
export type Cycle = {
  start: string;
  timezone_offset?: string;
  score_state?: string;
  score?: { strain?: number; average_heart_rate?: number; max_heart_rate?: number };
};

// Lokal dato (YYYY-MM-DD) for et tidspunkt med WHOOP's tidszone, fx "+02:00".
export function whoopLocalDay(iso: string, offset: string | undefined) {
  const m = offset?.match(/^([+-])(\d{2}):?(\d{2})$/);
  const shiftMs = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) * 60_000 : 0;
  return new Date(new Date(iso).getTime() + shiftMs).toISOString().slice(0, 10);
}

const minutes = (ms: number | undefined) => (typeof ms === "number" && ms > 0 ? Math.round(ms / 60_000) : null);

function metric(type: string, value: number | null | undefined, recordedAt: string): IntegrationItem[] {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? [{ kind: "metric", payload: { source: "WHOOP", type, value, recordedAt } }]
    : [];
}

export function whoopItems(workouts: Workout[], sleeps: Sleep[], recoveries: Recovery[], cycles: Cycle[] = []): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const w of workouts) {
    if (w.score_state && w.score_state !== "SCORED") continue;
    const durationMinutes = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 60_000);
    if (!(durationMinutes > 0)) continue;
    items.push({
      kind: "activity",
      payload: {
        source: "WHOOP",
        sportType: (w.sport_name ?? "workout").toLowerCase(),
        startedAt: new Date(w.start).toISOString(),
        durationMinutes,
        caloriesBurned: Math.round((w.score?.kilojoule ?? 0) / KJ_PER_KCAL),
      },
    });
  }

  // Restitution hører til nattens søvn; dagen er den lokale dato, søvnen sluttede.
  const nightOf = new Map<string, string>();
  for (const s of sleeps) {
    if (s.nap || s.score_state !== "SCORED" || !s.score) continue;
    const day = whoopLocalDay(s.end, s.timezone_offset);
    nightOf.set(s.id, day);
    const at = `${day}T00:00:00.000Z`;
    const stages = s.score.stage_summary ?? {};
    const inBed = stages.total_in_bed_time_milli ?? 0;
    const asleep = inBed - (stages.total_awake_time_milli ?? 0);
    items.push(
      ...metric("SLEEP_MINUTES", minutes(asleep), at),
      ...metric("SLEEP_IN_BED_MINUTES", minutes(inBed), at),
      ...metric("SLEEP_AWAKE_MINUTES", minutes(stages.total_awake_time_milli), at),
      ...metric("SLEEP_LIGHT_MINUTES", minutes(stages.total_light_sleep_time_milli), at),
      ...metric("SLEEP_DEEP_MINUTES", minutes(stages.total_slow_wave_sleep_time_milli), at),
      ...metric("SLEEP_REM_MINUTES", minutes(stages.total_rem_sleep_time_milli), at),
      ...metric("SLEEP_AWAKENINGS", stages.disturbance_count, at),
      ...metric("SLEEP_SCORE", s.score.sleep_performance_percentage, at),
      ...metric("SLEEP_EFFICIENCY_PERCENT", s.score.sleep_efficiency_percentage, at),
      ...metric("RESPIRATORY_RATE_BPM", s.score.respiratory_rate, at)
    );
  }

  for (const r of recoveries) {
    if (r.score_state !== "SCORED" || !r.score) continue;
    const day = (r.sleep_id && nightOf.get(r.sleep_id)) || r.created_at.slice(0, 10);
    const at = `${day}T00:00:00.000Z`;
    items.push(
      ...metric("RESTING_HEART_RATE_BPM", r.score.resting_heart_rate, at),
      ...metric("HEART_RATE_VARIABILITY_MS", r.score.hrv_rmssd_milli, at),
      ...metric("OXYGEN_SATURATION_PERCENT", r.score.spo2_percentage, at),
      ...metric("RECOVERY_SCORE", r.score.recovery_score, at),
      ...metric("SKIN_TEMPERATURE_C", r.score.skin_temp_celsius, at)
    );
  }

  for (const c of cycles) {
    if (c.score_state !== "SCORED" || !c.score) continue;
    const at = `${whoopLocalDay(c.start, c.timezone_offset)}T00:00:00.000Z`;
    items.push(
      ...metric("STRAIN_SCORE", c.score.strain, at),
      ...metric("HEART_RATE_BPM", c.score.average_heart_rate, at),
      ...metric("HEART_RATE_MAX_BPM", c.score.max_heart_rate, at)
    );
  }
  return items;
}
