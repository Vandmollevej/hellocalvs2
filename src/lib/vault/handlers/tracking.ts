"use client";

// Vand, menstruation, kropsmål, søvnmønster, vagter, aktiviteter og
// sundhedsmålinger i boksen. Erstatter de tilsvarende /api-ruter med samme
// JSON-form (Prisma-modellerne uden userId).

import { newRecordId, type VaultClient } from "@/lib/vault/client";
import { json, route } from "@/lib/vault/local-api";

type Vault = Pick<VaultClient, "list" | "get" | "put" | "remove">;

function all<T extends object>(vault: Vault, collection: string): (T & { id: string })[] {
  return vault.list<T>(collection).map(({ id, value }) => ({ ...value, id }));
}

function byDesc<T>(key: keyof T) {
  return (a: T, b: T) => String(b[key]).localeCompare(String(a[key]));
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function save<T extends { id: string }>(vault: Vault, collection: string, entry: T) {
  const { id, ...rest } = entry;
  await vault.put(collection, id, rest);
  return entry;
}

// ---------- vand ----------

export const WATER = "water";
export type WaterEntry = { id: string; amountMl: number; loggedAt: string };

export const listWater = (vault: Vault) => all<Omit<WaterEntry, "id">>(vault, WATER).sort(byDesc("loggedAt"));

route("GET", "/api/water-entries", ({ vault }) => json({ entries: listWater(vault).slice(0, 200) }));

route("POST", "/api/water-entries", async ({ vault, body }) => {
  const { amountMl, loggedAt } = (await body()) as { amountMl?: number; loggedAt?: string };
  if (!amountMl || amountMl <= 0) return json({ message: "amountMl (> 0) er påkrævet" }, 400);
  const at = parseDate(loggedAt);
  if (at === null) return json({ message: "loggedAt er ugyldig" }, 400);
  const entry = await save<WaterEntry>(vault, WATER, {
    id: newRecordId(),
    amountMl,
    loggedAt: (at ?? new Date()).toISOString(),
  });
  return json({ entry });
});

route("DELETE", "/api/water-entries/:id", async ({ vault, params }) => {
  if (!vault.get(WATER, params.id)) return json({ message: "Registreringen findes ikke" }, 404);
  await vault.remove(WATER, params.id);
  return json({ deleted: true });
});

// ---------- menstruation ----------

export const MENSTRUAL = "menstrualCycle";
export type MenstrualCycleEntry = { id: string; startDate: string; endDate: string | null; createdAt: string };

export const listMenstrual = (vault: Vault) =>
  all<Omit<MenstrualCycleEntry, "id">>(vault, MENSTRUAL).sort(byDesc("startDate"));

route("GET", "/api/menstrual-cycle", ({ vault }) => json({ entries: listMenstrual(vault).slice(0, 24) }));

route("POST", "/api/menstrual-cycle", async ({ vault, body }) => {
  const { startDate, endDate } = (await body()) as { startDate?: string; endDate?: string | null };
  if (!startDate) return json({ message: "startDate er påkrævet" }, 400);
  const start = parseDate(startDate);
  if (!start) return json({ message: "startDate er ugyldig" }, 400);
  const end = parseDate(endDate);
  if (end === null) return json({ message: "endDate er ugyldig" }, 400);
  const entry = await save<MenstrualCycleEntry>(vault, MENSTRUAL, {
    id: newRecordId(),
    startDate: start.toISOString(),
    endDate: end ? end.toISOString() : null,
    createdAt: new Date().toISOString(),
  });
  return json({ entry });
});

// ---------- kropsmål ----------

export const BODY = "bodyMeasurements";
export type BodyMeasurement = {
  id: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  upperArmCm: number | null;
  note: string | null;
  measuredAt: string;
};
const BODY_FIELDS = ["waistCm", "hipCm", "chestCm", "thighCm", "upperArmCm"] as const;

export const listBody = (vault: Vault) => all<Omit<BodyMeasurement, "id">>(vault, BODY).sort(byDesc("measuredAt"));

route("GET", "/api/body-measurements", ({ vault }) => json({ entries: listBody(vault).slice(0, 200) }));

route("POST", "/api/body-measurements", async ({ vault, body }) => {
  const input = (await body()) as Partial<Record<(typeof BODY_FIELDS)[number], number | null>> & {
    note?: string;
    measuredAt?: string;
  };
  if (BODY_FIELDS.every((f) => !input[f])) {
    return json({ message: "Mindst ét mål (talje, hofte, bryst, lår eller overarm) er påkrævet" }, 400);
  }
  const at = parseDate(input.measuredAt);
  if (at === null) return json({ message: "measuredAt er ugyldig" }, 400);
  const entry = await save<BodyMeasurement>(vault, BODY, {
    id: newRecordId(),
    waistCm: input.waistCm ?? null,
    hipCm: input.hipCm ?? null,
    chestCm: input.chestCm ?? null,
    thighCm: input.thighCm ?? null,
    upperArmCm: input.upperArmCm ?? null,
    note: input.note || null,
    measuredAt: (at ?? new Date()).toISOString(),
  });
  return json({ entry });
});

route("PATCH", "/api/body-measurements/:id", async ({ vault, params, body }) => {
  const existing = vault.get<Omit<BodyMeasurement, "id">>(BODY, params.id);
  if (!existing) return json({ message: "Målingen findes ikke" }, 404);
  const input = (await body()) as Partial<BodyMeasurement>;
  const next = { ...existing };
  for (const f of BODY_FIELDS) if (input[f] !== undefined) next[f] = input[f] ?? null;
  if (input.note !== undefined) next.note = input.note || null;
  await vault.put(BODY, params.id, next);
  return json({ updated: true });
});

route("DELETE", "/api/body-measurements/:id", async ({ vault, params }) => {
  if (!vault.get(BODY, params.id)) return json({ message: "Målingen findes ikke" }, 404);
  await vault.remove(BODY, params.id);
  return json({ deleted: true });
});

// ---------- søvnmønster (ID = ugedag 0-6) ----------

export const SLEEP = "sleepSchedule";
export type SleepSchedule = { id: string; weekday: number; bedtime: string; wakeTime: string };

export const listSleep = (vault: Vault) =>
  all<Omit<SleepSchedule, "id">>(vault, SLEEP).sort((a, b) => a.weekday - b.weekday);

route("GET", "/api/sleep-schedule", ({ vault }) => json({ schedules: listSleep(vault) }));

route("PUT", "/api/sleep-schedule", async ({ vault, body }) => {
  const { weekday, bedtime, wakeTime } = (await body()) as {
    weekday?: number;
    bedtime?: string | null;
    wakeTime?: string | null;
  };
  if (weekday === undefined || weekday < 0 || weekday > 6) return json({ message: "weekday (0-6) er påkrævet" }, 400);
  const id = String(weekday);
  if (!bedtime && !wakeTime) {
    if (vault.get(SLEEP, id)) await vault.remove(SLEEP, id);
    return json({ schedule: null });
  }
  const schedule = await save<SleepSchedule>(vault, SLEEP, {
    id,
    weekday,
    bedtime: bedtime ?? "",
    wakeTime: wakeTime ?? "",
  });
  return json({ schedule });
});

// ---------- vagter (ID = dato YYYY-MM-DD) ----------

export const SHIFTS = "workShifts";
export type WorkShift = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  bedtime: string | null;
  wakeTime: string | null;
  createdAt: string;
};

function shiftKey(date: string): string | null {
  const d = parseDate(date);
  return d ? d.toISOString().slice(0, 10) : null;
}

export const listShifts = (vault: Vault) =>
  all<Omit<WorkShift, "id">>(vault, SHIFTS).sort((a, b) => a.date.localeCompare(b.date));

route("GET", "/api/work-shifts", ({ vault }) => json({ shifts: listShifts(vault) }));

route("GET", "/api/work-shifts/:date", ({ vault, params }) => {
  const key = shiftKey(params.date);
  const value = key ? vault.get<Omit<WorkShift, "id">>(SHIFTS, key) : undefined;
  return json({ shift: value && key ? { ...value, id: key } : null });
});

route("PUT", "/api/work-shifts/:date", async ({ vault, params, body }) => {
  const key = shiftKey(params.date);
  if (!key) return json({ message: "Ugyldig dato" }, 400);
  const input = (await body()) as Partial<Pick<WorkShift, "startTime" | "endTime" | "bedtime" | "wakeTime">>;
  const existing = vault.get<Omit<WorkShift, "id">>(SHIFTS, key);
  const pick = (k: "startTime" | "endTime" | "bedtime" | "wakeTime") =>
    input[k] !== undefined ? input[k] ?? null : existing?.[k] ?? null;
  const shift = await save<WorkShift>(vault, SHIFTS, {
    id: key,
    date: `${key}T00:00:00.000Z`,
    startTime: pick("startTime"),
    endTime: pick("endTime"),
    bedtime: pick("bedtime"),
    wakeTime: pick("wakeTime"),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
  return json({ shift });
});

route("DELETE", "/api/work-shifts/:date", async ({ vault, params }) => {
  const key = shiftKey(params.date);
  if (key && vault.get(SHIFTS, key)) await vault.remove(SHIFTS, key);
  return json({ ok: true });
});

// ---------- aktiviteter ----------

export const ACTIVITIES = "activities";
export type Activity = {
  id: string;
  source: string;
  sportType: string;
  startedAt: string;
  durationMinutes: number;
  caloriesBurned: number;
  createdAt: string;
};

export const listActivities = (vault: Vault) =>
  all<Omit<Activity, "id">>(vault, ACTIVITIES).sort(byDesc("startedAt"));

route("GET", "/api/activities", ({ vault }) => json({ activities: listActivities(vault).slice(0, 500) }));

route("POST", "/api/activities", async ({ vault, body }) => {
  const { sportType, startedAt, durationMinutes, caloriesBurned } = (await body()) as Partial<Activity>;
  if (!sportType || !durationMinutes || durationMinutes <= 0 || !caloriesBurned || caloriesBurned <= 0) {
    return json({ message: "sportType, durationMinutes og caloriesBurned (> 0) er påkrævet" }, 400);
  }
  const at = parseDate(startedAt);
  if (at === null) return json({ message: "Ugyldig startedAt" }, 400);
  const activity = await save<Activity>(vault, ACTIVITIES, {
    id: newRecordId(),
    source: "MANUAL",
    sportType,
    startedAt: (at ?? new Date()).toISOString(),
    durationMinutes,
    caloriesBurned,
    createdAt: new Date().toISOString(),
  });
  return json({ activity });
});

// ---------- sundhedsmålinger (skrives af integrationer via indbakken) ----------

export const HEALTH = "healthMetrics";
export type HealthMetric = {
  id: string;
  source: string;
  type: string;
  value: number;
  recordedAt: string;
  createdAt: string;
};

export const listHealth = (vault: Vault) => all<Omit<HealthMetric, "id">>(vault, HEALTH).sort(byDesc("recordedAt"));

route("GET", "/api/health-metrics", ({ vault }) => json({ metrics: listHealth(vault).slice(0, 2000) }));
