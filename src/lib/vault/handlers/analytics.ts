"use client";

// Anonym statistik fra enheden (docs/PRIVACY.md "Statistik").
//
// Én gang pr. dag beregner enheden de foregående dages tal og sender dem som
// intervaller sammen med aldersinterval og køn — aldrig præcise værdier,
// fødselsdato eller ID. Den præcise kombination findes derfor aldrig i
// statistiksystemet.

import { computeAge } from "@/lib/age";
import { ageBand, bucketFor, type AnalyticsMetric } from "@/lib/analytics-rules";
import type { VaultClient } from "@/lib/vault/client";
import { listRegistrations } from "@/lib/vault/handlers/meals";
import { listWeightEntries } from "@/lib/vault/handlers/weight";
import { listActivities, listHealth, listWater } from "@/lib/vault/handlers/tracking";
import { readPrivateProfile } from "@/lib/vault/handlers/profile";

const SETTINGS = "settings";
const STATE_ID = "analytics";
const MAX_BACKFILL_DAYS = 7;

type State = { lastSubmittedDay: string | null };

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function valuesForDay(vault: VaultClient, day: string): Partial<Record<AnalyticsMetric, string>> {
  const on = (iso: string) => iso.slice(0, 10) === day;
  const regs = listRegistrations(vault).filter((r) => on(r.createdAt));
  const weights = listWeightEntries(vault).filter((w) => on(w.weighedAt));
  const water =
    listWater(vault)
      .filter((w) => on(w.loggedAt))
      .reduce((sum, w) => sum + w.amountMl, 0) +
    listHealth(vault)
      .filter((m) => m.type === "WATER_ML" && on(m.recordedAt))
      .reduce((sum, m) => sum + m.value, 0);
  const activity = listActivities(vault)
    .filter((a) => on(a.startedAt))
    .reduce((sum, a) => sum + a.durationMinutes, 0);

  const out: Partial<Record<AnalyticsMetric, string>> = {};
  const put = (metric: AnalyticsMetric, value: number | null) => {
    const bucket = value === null ? null : bucketFor(metric, value);
    if (bucket) out[metric] = bucket;
  };
  if (regs.length > 0) {
    put("kcal", regs.reduce((sum, r) => sum + r.kcalSnapshot, 0));
    put("proteinG", regs.reduce((sum, r) => sum + r.proteinSnapshot, 0));
  }
  if (weights.length > 0) put("weightKg", weights[0].weightKg);
  if (water > 0) put("waterMl", water);
  if (activity > 0) put("activityMinutes", activity);
  return out;
}

export async function submitDailyAnalytics(vault: VaultClient) {
  const state = vault.get<State>(SETTINGS, STATE_ID) ?? { lastSubmittedDay: null };
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const last = dayKey(yesterday);
  if (state.lastSubmittedDay && state.lastSubmittedDay >= last) return;

  const profile = readPrivateProfile(vault);
  const band = ageBand(computeAge(profile.birthDate));
  const sex = profile.sex ?? "UNKNOWN";

  const start = new Date(yesterday);
  start.setUTCDate(start.getUTCDate() - (MAX_BACKFILL_DAYS - 1));
  for (let d = new Date(start); dayKey(d) <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = dayKey(d);
    if (state.lastSubmittedDay && day <= state.lastSubmittedDay) continue;
    const values = valuesForDay(vault, day);
    if (Object.keys(values).length === 0) continue;
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, ageBand: band, sex, values }),
    }).catch(() => undefined);
  }
  await vault.put<State>(SETTINGS, STATE_ID, { lastSubmittedDay: last });
}
