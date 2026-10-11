// Omsætning af Google Health API v4's datapunkter (søvn, dagsværdier,
// intervaldata) til Hello Cals fælles poster. Rene funktioner, testes i
// src/lib/integration-items.test.mjs. Feltnavne: developers.google.com/health/reference.

import type { IntegrationItem } from "@/lib/integrations/store-items";

export type GooglePoint = Record<string, unknown>;
type Obj = Record<string, unknown>;

const SOURCE = "GOOGLE_HEALTH";
const dayKey = (day: string) => `${day}T00:00:00.000Z`;

const obj = (value: unknown): Obj | null => (value && typeof value === "object" ? (value as Obj) : null);

// int64 kommer som streng, doubles som tal.
export function googleNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

// "-14400s" → sekunder.
function offsetSeconds(value: unknown): number {
  const m = typeof value === "string" ? value.match(/^(-?\d+(?:\.\d+)?)s$/) : null;
  return m ? Number(m[1]) : 0;
}

// Lokal dato (ÅÅÅÅ-MM-DD) og minut i døgnet for et tidspunkt + UTC-forskydning.
function localParts(time: unknown, utcOffset: unknown): { day: string; minuteOfDay: number } | null {
  const at = typeof time === "string" ? new Date(time) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  const local = new Date(at.getTime() + offsetSeconds(utcOffset) * 1000);
  return { day: local.toISOString().slice(0, 10), minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

// Googles Date-objekt {year, month, day} → "ÅÅÅÅ-MM-DD".
export function googleDate(value: unknown): string | null {
  const d = obj(value);
  if (!d) return null;
  const year = googleNumber(d.year);
  const month = googleNumber(d.month);
  const day = googleNumber(d.day);
  if (year === null || month === null || day === null) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function metric(type: string, value: number | null, recordedAt: string): IntegrationItem[] {
  return value !== null && Number.isFinite(value) && value > 0
    ? [{ kind: "metric", payload: { source: SOURCE, type, value: Math.round(value * 100) / 100, recordedAt } }]
    : [];
}

const minutesBetween = (a: unknown, b: unknown) => {
  const start = typeof a === "string" ? Date.parse(a) : NaN;
  const end = typeof b === "string" ? Date.parse(b) : NaN;
  return Number.isNaN(start) || Number.isNaN(end) ? 0 : Math.max(0, (end - start) / 60000);
};

// Én nat pr. dato (slutdatoen): hovedsøvnen, ellers den længste. Lure tælles ikke.
export function googleSleepItems(points: GooglePoint[]): IntegrationItem[] {
  type Night = { day: string; minutes: number; sleep: Obj; start: ReturnType<typeof localParts>; end: ReturnType<typeof localParts> };
  const best = new Map<string, Night>();
  for (const point of points) {
    const sleep = obj(point.sleep);
    const interval = obj(sleep?.interval);
    if (!sleep || !interval) continue;
    const metadata = obj(sleep.metadata);
    if (metadata?.nap === true) continue;
    const end = localParts(interval.endTime, interval.endUtcOffset);
    const start = localParts(interval.startTime, interval.startUtcOffset);
    if (!end) continue;
    const minutes = minutesBetween(interval.startTime, interval.endTime);
    const main = metadata?.mainSleep === true;
    const current = best.get(end.day);
    const currentMain = current ? obj(current.sleep.metadata)?.mainSleep === true : false;
    if (!current || (main && !currentMain) || (main === currentMain && minutes > current.minutes)) {
      best.set(end.day, { day: end.day, minutes, sleep, start, end });
    }
  }

  const items: IntegrationItem[] = [];
  for (const { day, sleep, start, end, minutes: periodMinutes } of best.values()) {
    const at = dayKey(day);
    const summary = obj(sleep.summary);
    const stages = Array.isArray(sleep.stages) ? (sleep.stages as Obj[]) : [];
    // Minutter pr. fase: fra summary, ellers lagt sammen fra faserne.
    const stageMinutes: Record<string, number> = {};
    for (const s of Array.isArray(summary?.stagesSummary) ? (summary.stagesSummary as Obj[]) : []) {
      const minutes = googleNumber(s.minutes);
      if (typeof s.type === "string" && minutes !== null) stageMinutes[s.type] = minutes;
    }
    if (Object.keys(stageMinutes).length === 0) {
      for (const s of stages) {
        if (typeof s.type !== "string") continue;
        stageMinutes[s.type] = (stageMinutes[s.type] ?? 0) + minutesBetween(s.startTime, s.endTime);
      }
    }
    const light = stageMinutes.LIGHT ?? 0;
    const deep = stageMinutes.DEEP ?? 0;
    const rem = stageMinutes.REM ?? 0;
    const asleepFromStages = light + deep + rem + (stageMinutes.ASLEEP ?? 0);
    const asleep = googleNumber(summary?.minutesAsleep) ?? (asleepFromStages > 0 ? asleepFromStages : null);
    const inBed = googleNumber(summary?.minutesInSleepPeriod) ?? periodMinutes;
    const awake = googleNumber(summary?.minutesAwake) ?? stageMinutes.AWAKE ?? null;
    const awakenings = Array.isArray(sleep.shortAwakenings)
      ? (sleep.shortAwakenings as unknown[]).length
      : stages.filter((s) => s.type === "AWAKE").length;
    items.push(
      ...metric("SLEEP_MINUTES", asleep, at),
      ...metric("SLEEP_IN_BED_MINUTES", inBed, at),
      ...metric("SLEEP_DEEP_MINUTES", deep, at),
      ...metric("SLEEP_LIGHT_MINUTES", light, at),
      ...metric("SLEEP_REM_MINUTES", rem, at),
      ...metric("SLEEP_AWAKE_MINUTES", awake, at),
      ...metric("SLEEP_AWAKENINGS", awakenings, at),
      ...metric("SLEEP_EFFICIENCY_PERCENT", asleep && inBed > 0 ? Math.min(100, (asleep / inBed) * 100) : null, at),
      ...metric("SLEEP_START_MINUTE_OF_DAY", start && start.minuteOfDay > 0 ? start.minuteOfDay : null, at),
      ...metric("SLEEP_END_MINUTE_OF_DAY", end && end.minuteOfDay > 0 ? end.minuteOfDay : null, at)
    );
  }
  return items;
}

// Dagsværdier ("daily-…"): datapunktet har en date og ét eller flere tal.
// `pick` finder tallet i det indre objekt (under typens camelCase-navn).
export type DailySpec = {
  dataType: string;
  type: string;
  pick: (inner: Obj) => number | null;
};

export const camelCase = (dataType: string) => dataType.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

export const GOOGLE_DAILY_SPECS: DailySpec[] = [
  { dataType: "daily-resting-heart-rate", type: "RESTING_HEART_RATE_BPM", pick: (d) => googleNumber(d.beatsPerMinute) },
  { dataType: "daily-heart-rate-variability", type: "HEART_RATE_VARIABILITY_MS", pick: (d) => googleNumber(d.averageHeartRateVariabilityMilliseconds) },
  { dataType: "daily-oxygen-saturation", type: "OXYGEN_SATURATION_PERCENT", pick: (d) => googleNumber(d.averagePercentage) },
  { dataType: "daily-respiratory-rate", type: "RESPIRATORY_RATE_BPM", pick: (d) => googleNumber(d.breathsPerMinute) },
  { dataType: "daily-vo2-max", type: "VO2_MAX", pick: (d) => googleNumber(d.vo2Max) },
  { dataType: "daily-sleep-temperature-derivations", type: "SKIN_TEMPERATURE_C", pick: (d) => googleNumber(d.nightlyTemperatureCelsius) },
];

export function googleDailyItems(spec: DailySpec, points: GooglePoint[]): IntegrationItem[] {
  return points.flatMap((point) => {
    const inner = obj(point[camelCase(spec.dataType)]);
    const day = inner ? googleDate(inner.date) : null;
    return inner && day ? metric(spec.type, spec.pick(inner), dayKey(day)) : [];
  });
}

// Intervaldata, der lægges sammen pr. lokal dag (distance, etager, zoneminutter,
// aktive minutter, vand). Første (muligvis ufuldstændige) dag springes over,
// så en senere synkronisering aldrig overskriver en hel dag med en delsum.
export type IntervalSpec = {
  dataType: string;
  type: string;
  value: (inner: Obj) => number | null;
  scale?: number;
  filterField?: string;
};

export const GOOGLE_INTERVAL_SPECS: IntervalSpec[] = [
  { dataType: "distance", type: "DISTANCE_KM", value: (d) => googleNumber(d.millimeters), scale: 1 / 1_000_000 },
  { dataType: "floors", type: "FLOORS_CLIMBED", value: (d) => googleNumber(d.count) },
  { dataType: "active-zone-minutes", type: "ACTIVE_ZONE_MINUTES", value: (d) => googleNumber(d.activeZoneMinutes) },
  {
    dataType: "active-minutes",
    type: "EXERCISE_MINUTES",
    // Let aktivitet er almindelig bevægelse; træningsminutter = moderat + hård.
    value: (d) => {
      const levels = Array.isArray(d.activeMinutesByActivityLevel) ? (d.activeMinutesByActivityLevel as Obj[]) : [];
      return levels.reduce((sum, l) => (l.activityLevel === "LIGHT" ? sum : sum + (googleNumber(l.activeMinutes) ?? 0)), 0);
    },
  },
  {
    dataType: "hydration-log",
    type: "WATER_ML",
    value: (d) => googleNumber(obj(d.amountConsumed)?.milliliters),
  },
];

export function googleIntervalDayItems(spec: IntervalSpec, points: GooglePoint[]): IntegrationItem[] {
  const byDay = new Map<string, number>();
  for (const point of points) {
    const inner = obj(point[camelCase(spec.dataType)]);
    const interval = obj(inner?.interval);
    if (!inner || !interval) continue;
    const value = spec.value(inner);
    const local = localParts(interval.startTime, interval.startUtcOffset);
    if (value === null || !local) continue;
    byDay.set(local.day, (byDay.get(local.day) ?? 0) + value * (spec.scale ?? 1));
  }
  return [...byDay.keys()]
    .sort()
    .slice(1)
    .flatMap((day) => metric(spec.type, byDay.get(day)!, dayKey(day)));
}

// Pulsmålinger kommer ofte; de samles til timegennemsnit (kalenderen) og
// dagens laveste og højeste puls.
export function googleHeartRateItems(points: GooglePoint[]): IntegrationItem[] {
  const hourly = new Map<string, { sum: number; count: number; at: string }>();
  const daily = new Map<string, { min: number; max: number }>();
  for (const point of points) {
    const inner = obj(point.heartRate);
    const sample = obj(inner?.sampleTime);
    const bpm = googleNumber(inner?.beatsPerMinute);
    const time = typeof sample?.physicalTime === "string" ? new Date(sample.physicalTime) : null;
    if (!inner || bpm === null || bpm <= 0 || !time || Number.isNaN(time.getTime())) continue;
    // 5-minutters spande (ikke timer): et træningspas på 30–45 min forsvinder ellers i timegennemsnittet.
    const bucket = new Date(Math.floor(time.getTime() / 300_000) * 300_000).toISOString();
    const hour = bucket;
    const h = hourly.get(hour) ?? { sum: 0, count: 0, at: bucket };
    h.sum += bpm;
    h.count += 1;
    hourly.set(hour, h);
    const local = localParts(sample?.physicalTime, sample?.utcOffset);
    if (local) {
      const d = daily.get(local.day) ?? { min: bpm, max: bpm };
      d.min = Math.min(d.min, bpm);
      d.max = Math.max(d.max, bpm);
      daily.set(local.day, d);
    }
  }
  return [
    ...[...hourly.values()].flatMap((h) => metric("HEART_RATE_BPM", h.sum / h.count, h.at)),
    ...[...daily.entries()].flatMap(([day, d]) => [
      ...metric("HEART_RATE_MIN_BPM", d.min, dayKey(day)),
      ...metric("HEART_RATE_MAX_BPM", d.max, dayKey(day)),
    ]),
  ];
}

// mg/dL → mmol/L (som HealthMetricType BLOOD_GLUCOSE_MMOL_L).
export const MG_DL_PER_MMOL_L = 18.016;
