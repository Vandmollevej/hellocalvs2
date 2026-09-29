import type { Sex } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAge } from "@/lib/age";

// Pulsudsving → "Hvad foretog du dig?" (docs/DECISIONS.md 2026-09-29).
//
// Et udsving er en sammenhængende periode, hvor pulsen ligger mindst
// SPIKE_ABOVE_REST_BPM over hvilepulsen (og mindst SPIKE_MIN_BPM), i mindst
// SPIKE_MIN_MINUTES. Det er "mærkbart", når det ekstra forbrug i perioden er
// mindst NOTICEABLE_EXTRA_KCAL. Ekstra forbrug tages fra uret
// (ACTIVE_ENERGY_KCAL), når det findes; ellers estimeres det med Keytel-
// formlen (puls, vægt, alder, køn) minus samme formel ved hvilepuls.

export const SPIKE_ABOVE_REST_BPM = 35;
export const SPIKE_MIN_BPM = 100;
export const SPIKE_MIN_MINUTES = 10;
export const NOTICEABLE_EXTRA_KCAL = 150;
/** Huller i målingerne op til dette tæller stadig som samme udsving. */
const MAX_GAP_MINUTES = 10;
const LOOKBACK_HOURS = 48;
const CHART_WINDOW_HOURS = 4;
const DEFAULT_RESTING_BPM = 65;

const MINUTE = 60_000;

export type HeartRateSample = { at: string; bpm: number };

export type HeartRateSpike = {
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  extraKcal: number;
  peakBpm: number;
  restingBpm: number;
  windowStart: string;
  windowEnd: string;
  samples: HeartRateSample[];
};

type Sample = { at: Date; bpm: number };

function keytelKcalPerMinute(bpm: number, weightKg: number, age: number, sex: Sex | null) {
  const value =
    sex === "FEMALE"
      ? -20.4022 + 0.4472 * bpm - 0.1263 * weightKg + 0.074 * age
      : -55.0969 + 0.6309 * bpm + 0.1988 * weightKg + 0.2017 * age;
  return Math.max(0, value / 4.184);
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

/** Rå udsvingsperioder (ren funktion, testbar uden database). */
export function findSpikeRanges(samples: Sample[], restingBpm: number) {
  const threshold = Math.max(SPIKE_MIN_BPM, restingBpm + SPIKE_ABOVE_REST_BPM);
  const ranges: { start: number; end: number }[] = [];
  let current: { start: number; end: number } | null = null;
  for (const sample of samples) {
    if (sample.bpm < threshold) continue;
    const at = sample.at.getTime();
    if (current && at - current.end <= MAX_GAP_MINUTES * MINUTE) {
      current.end = at;
    } else {
      if (current) ranges.push(current);
      current = { start: at, end: at };
    }
  }
  if (current) ranges.push(current);
  return ranges.filter((range) => range.end - range.start >= SPIKE_MIN_MINUTES * MINUTE);
}

/**
 * Det nyeste mærkbare udsving inden for de sidste 48 timer, som brugeren
 * ikke er spurgt om, og som ikke allerede dækkes af en registreret aktivitet.
 */
export async function findPendingSpike(userId: string, now = new Date()): Promise<HeartRateSpike | null> {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3600_000);
  const baselineSince = new Date(now.getTime() - 7 * 24 * 3600_000);

  const [samplesRaw, resting, activeEnergy, user, latestWeight, activities, reviews] = await Promise.all([
    prisma.healthMetric.findMany({
      where: { userId, type: "HEART_RATE_BPM", recordedAt: { gte: baselineSince, lte: now } },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true, value: true },
    }),
    prisma.healthMetric.findFirst({
      where: { userId, type: "RESTING_HEART_RATE_BPM" },
      orderBy: { recordedAt: "desc" },
      select: { value: true },
    }),
    prisma.healthMetric.findMany({
      where: { userId, type: "ACTIVE_ENERGY_KCAL", recordedAt: { gte: since, lte: now } },
      select: { recordedAt: true, value: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { weightKg: true, birthDate: true, sex: true } }),
    prisma.weightEntry.findFirst({ where: { userId }, orderBy: { weighedAt: "desc" }, select: { weightKg: true } }),
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(since.getTime() - 24 * 3600_000) } },
      select: { startedAt: true, durationMinutes: true },
    }),
    prisma.heartRateSpikeReview.findMany({ where: { userId, startedAt: { gte: since } }, select: { startedAt: true, endedAt: true } }),
  ]);

  const all: Sample[] = samplesRaw.map((row) => ({ at: row.recordedAt, bpm: row.value }));
  const recent = all.filter((sample) => sample.at >= since);
  if (recent.length === 0) return null;

  const restingBpm = Math.round(resting?.value ?? percentile(all.map((s) => s.bpm), 0.1) ?? DEFAULT_RESTING_BPM);
  const weightKg = latestWeight?.weightKg ?? user?.weightKg ?? 75;
  const age = computeAge(user?.birthDate) ?? 40;

  const overlaps = (start: number, end: number, otherStart: number, otherEnd: number) => start <= otherEnd && otherStart <= end;
  const activityRanges = activities.map((a) => [a.startedAt.getTime(), a.startedAt.getTime() + a.durationMinutes * MINUTE]);
  const reviewRanges = reviews.map((r) => [r.startedAt.getTime(), r.endedAt.getTime()]);

  const ranges = findSpikeRanges(recent, restingBpm).reverse();
  for (const range of ranges) {
    if (activityRanges.some(([s, e]) => overlaps(range.start, range.end, s, e))) continue;
    if (reviewRanges.some(([s, e]) => overlaps(range.start, range.end, s, e))) continue;

    const inRange = recent.filter((s) => s.at.getTime() >= range.start && s.at.getTime() <= range.end);
    const fromWatch = activeEnergy
      .filter((row) => row.recordedAt.getTime() >= range.start && row.recordedAt.getTime() <= range.end)
      .reduce((sum, row) => sum + row.value, 0);

    let estimated = 0;
    for (let i = 1; i < inRange.length; i++) {
      const minutes = Math.min(MAX_GAP_MINUTES, (inRange[i].at.getTime() - inRange[i - 1].at.getTime()) / MINUTE);
      const bpm = (inRange[i].bpm + inRange[i - 1].bpm) / 2;
      estimated +=
        (keytelKcalPerMinute(bpm, weightKg, age, user?.sex ?? null) -
          keytelKcalPerMinute(restingBpm, weightKg, age, user?.sex ?? null)) *
        minutes;
    }
    const extraKcal = Math.round(fromWatch > 0 ? fromWatch : Math.max(0, estimated));
    if (extraKcal < NOTICEABLE_EXTRA_KCAL) continue;

    const middle = (range.start + range.end) / 2;
    const windowStart = middle - (CHART_WINDOW_HOURS / 2) * 3600_000;
    const windowEnd = middle + (CHART_WINDOW_HOURS / 2) * 3600_000;
    const samples = all
      .filter((s) => s.at.getTime() >= windowStart && s.at.getTime() <= windowEnd)
      .map((s) => ({ at: s.at.toISOString(), bpm: Math.round(s.bpm) }));

    return {
      startedAt: new Date(range.start).toISOString(),
      endedAt: new Date(range.end).toISOString(),
      durationMinutes: Math.max(1, Math.round((range.end - range.start) / MINUTE)),
      extraKcal,
      peakBpm: Math.round(Math.max(...inRange.map((s) => s.bpm))),
      restingBpm,
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
      samples,
    };
  }
  return null;
}
