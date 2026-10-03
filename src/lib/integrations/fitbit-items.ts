// Omsætning af Fitbit Web API's tidsserier og søvn til Hello Cals fælles
// poster (rene funktioner, testes i src/lib/integration-items.test.mjs).

import type { IntegrationItem } from "@/lib/integrations/store-items";

export type FitbitSeriesPoint = { dateTime?: string; value?: unknown };
export type FitbitSleep = {
  dateOfSleep?: string;
  isMainSleep?: boolean;
  minutesAsleep?: number;
  timeInBed?: number;
  efficiency?: number;
  startTime?: string;
  endTime?: string;
  levels?: { summary?: Record<string, { minutes?: number; count?: number }> };
};

const SOURCE = "FITBIT";
const dayKey = (date: string) => `${date.slice(0, 10)}T00:00:00.000Z`;

function metric(type: string, value: number | null, recordedAt: string): IntegrationItem[] {
  return value !== null && Number.isFinite(value) && value > 0 ? [{ kind: "metric", payload: { source: SOURCE, type, value, recordedAt } }] : [];
}

// Tal eller talstreng; et interval som "44-48" (VO2 max) giver midten.
export function fitbitNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const range = value.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// En dagsserie, hvor `pick` finder tallet i punktets value.
export function fitbitSeriesItems(
  type: string,
  points: FitbitSeriesPoint[] | undefined,
  pick: (value: unknown) => unknown = (value) => value,
  scale = 1
): IntegrationItem[] {
  return (points ?? []).flatMap((p) => {
    const n = p.dateTime ? fitbitNumber(pick(p.value)) : null;
    return metric(type, n === null ? null : Math.round(n * scale * 100) / 100, dayKey(p.dateTime ?? ""));
  });
}

const minuteOfDay = (local: string | undefined) => {
  const m = local?.match(/T(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// Kun hovedsøvnen pr. nat (lure tælles ikke som nattens søvn).
export function fitbitSleepItems(sleeps: FitbitSleep[] | undefined): IntegrationItem[] {
  const items: IntegrationItem[] = [];
  for (const s of sleeps ?? []) {
    if (!s.dateOfSleep || s.isMainSleep === false) continue;
    const at = dayKey(s.dateOfSleep);
    const stage = (name: string) => s.levels?.summary?.[name]?.minutes ?? null;
    items.push(
      ...metric("SLEEP_MINUTES", s.minutesAsleep ?? null, at),
      ...metric("SLEEP_IN_BED_MINUTES", s.timeInBed ?? null, at),
      ...metric("SLEEP_DEEP_MINUTES", stage("deep"), at),
      ...metric("SLEEP_LIGHT_MINUTES", stage("light"), at),
      ...metric("SLEEP_REM_MINUTES", stage("rem"), at),
      ...metric("SLEEP_AWAKE_MINUTES", stage("wake") ?? stage("awake"), at),
      ...metric("SLEEP_AWAKENINGS", s.levels?.summary?.wake?.count ?? null, at),
      ...metric("SLEEP_EFFICIENCY_PERCENT", s.efficiency ?? null, at),
      ...metric("SLEEP_START_MINUTE_OF_DAY", minuteOfDay(s.startTime), at),
      ...metric("SLEEP_END_MINUTE_OF_DAY", minuteOfDay(s.endTime), at)
    );
  }
  return items;
}
