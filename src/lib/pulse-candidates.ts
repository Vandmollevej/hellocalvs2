import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findPendingSpikes, type DetectedSpike, type HeartRateSample, type SpikeContext } from "@/lib/heart-rate-spikes";
import {
  MIN_COVERAGE,
  MIN_SAMPLES,
  classifyPulsePattern,
  extractPulseFeatures,
  pulseShapeTags,
  type LabelledExample,
  type PulseFeatures,
  type PulseShapeTag,
} from "@/lib/pulse-pattern";
import { getSportMeta, normalizeSportType } from "@/lib/sport-icons";
import type { JobResult } from "@/lib/jobs/runs";
import type { WeekActivity } from "@/lib/pulse-week";

// Nattens puls-robot og forsiden "Vi kan se, at din puls var højere end
// sædvanlig …" (docs/DECISIONS.md 2026-10-04).
//
// - Robotten (job "pulse-activity", kl. 02:00) finder de seneste 7 dages
//   pulsudsving uden registreret sport, regner kurvens form og gemmer et gæt
//   på sporten i pulse_activity_candidates.
// - Forsiden henter det nyeste ubesvarede fund. Gættet vises kun, når der er
//   data nok (pulse-pattern.ts: `ready`).
// - Brugerens svar (en aktivitet) bliver samtidig til et nyt eksempel, robotten
//   lærer af: alle aktiviteter med pulsmålinger er træningsdata.

const MINUTE = 60_000;
const DAY = 24 * 3600_000;
export const NIGHT_LOOKBACK_HOURS = 7 * 24;
/** Ubesvarede fund spørges der om i op til 7 dage; derefter udløber de. */
const PROMPT_DAYS = 7;
const EXPIRE_DAYS = 14;
const GAP_MS = 10 * MINUTE;
const TRAINING_DAYS = 120;
const TRAINING_MAX_ACTIVITIES = 60;
const TRAINING_BATCH = 15;
const CHART_HALF_WINDOW_MS = 2 * 3600_000;
const WEEK_FETCH_MS = 8 * DAY;

export type PulseSuggestionView = {
  sport: string;
  label: string;
  confidence: number;
  basis: "personal" | "pattern";
  shape: PulseShapeTag[];
  alternatives: { sport: string; label: string }[];
};

export type PulsePrompt = {
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  extraKcal: number;
  peakBpm: number;
  restingBpm: number;
  windowStart: string;
  windowEnd: string;
  samples: HeartRateSample[];
  /** Aktiviteter omkring udsvinget; klienten bygger ugen ud fra sin egen tidszone. */
  weekActivities: WeekActivity[];
  suggestion: PulseSuggestionView | null;
};

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number, gap = 0) =>
  aStart <= bEnd + gap && bStart <= aEnd + gap;

/** Brugerens kendte sessioner: aktiviteter (urets kategori eller eget svar) med pulsmålinger i tidsrummet. */
export async function loadLabelledExamples(
  userId: string,
  context: Pick<SpikeContext, "restingBpm" | "age">,
  now = new Date(),
): Promise<LabelledExample[]> {
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startedAt: { gte: new Date(now.getTime() - TRAINING_DAYS * DAY), lte: now },
      durationMinutes: { gte: 8 },
    },
    orderBy: { startedAt: "desc" },
    take: TRAINING_MAX_ACTIVITIES,
    select: { startedAt: true, durationMinutes: true, sportType: true },
  });

  const examples: LabelledExample[] = [];
  for (let i = 0; i < activities.length; i += TRAINING_BATCH) {
    const batch = activities.slice(i, i + TRAINING_BATCH);
    const rows = await Promise.all(
      batch.map(async (activity) => {
        const start = activity.startedAt.getTime();
        const end = start + activity.durationMinutes * MINUTE;
        const samples = await prisma.healthMetric.findMany({
          where: {
            userId,
            type: "HEART_RATE_BPM",
            recordedAt: { gte: new Date(start - 20 * MINUTE), lte: new Date(end) },
          },
          orderBy: { recordedAt: "asc" },
          select: { recordedAt: true, value: true },
        });
        const features = extractPulseFeatures(
          samples.map((row) => ({ t: row.recordedAt.getTime(), bpm: row.value })),
          { start, end },
          context,
        );
        return features && features.sampleCount >= MIN_SAMPLES && features.coverage >= MIN_COVERAGE - 0.1
          ? { sport: normalizeSportType(activity.sportType), features }
          : null;
      }),
    );
    for (const row of rows) if (row && row.sport !== "other") examples.push(row);
  }
  return examples;
}

export type SyncResult = { found: number; created: number; updated: number; suggested: number };

/** Finder uregistrerede udsving for brugeren og gemmer/opdaterer fundene. */
export async function syncPulseCandidates(
  userId: string,
  { lookbackHours, now = new Date(), detectedBy }: { lookbackHours: number; now?: Date; detectedBy: "night" | "live" },
): Promise<SyncResult> {
  const result: SyncResult = { found: 0, created: 0, updated: 0, suggested: 0 };
  const { spikes, context } = await findPendingSpikes(userId, { now, lookbackHours });
  if (!context || spikes.length === 0) return result;
  result.found = spikes.length;

  const existing = await prisma.pulseActivityCandidate.findMany({
    where: { userId, startedAt: { gte: new Date(now.getTime() - (lookbackHours / 24 + 2) * DAY) } },
  });

  let examples: LabelledExample[] | null = null;
  for (const spike of spikes) {
    const start = new Date(spike.startedAt).getTime();
    const end = new Date(spike.endedAt).getTime();
    const match = existing.find((row) => overlaps(start, end, row.startedAt.getTime(), row.endedAt.getTime(), GAP_MS));
    if (match && match.status !== "PENDING") continue;
    // Uændret fund, der allerede er regnet på: ingen ny beregning.
    if (
      match &&
      match.features !== null &&
      match.startedAt.getTime() === start &&
      Math.abs(match.endedAt.getTime() - end) < 5 * MINUTE
    ) {
      continue;
    }

    if (examples === null) examples = await loadLabelledExamples(userId, context, now);
    const suggestion = spike.features ? classifyPulsePattern(spike.features, examples, { baselineDays: context.baselineDays }) : null;
    if (suggestion?.ready) result.suggested++;

    const data = candidateData(spike, spike.features, suggestion);
    if (match) {
      await prisma.pulseActivityCandidate.update({ where: { id: match.id }, data: { startedAt: new Date(start), ...data } });
      result.updated++;
    } else {
      try {
        await prisma.pulseActivityCandidate.create({ data: { userId, startedAt: new Date(start), detectedBy, ...data } });
        result.created++;
      } catch (error) {
        // Natkørslen og en åbnet forside kan finde samme udsving samtidig.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
  }
  return result;
}

function candidateData(
  spike: DetectedSpike,
  features: PulseFeatures | null,
  suggestion: ReturnType<typeof classifyPulsePattern>,
) {
  return {
    endedAt: new Date(spike.endedAt),
    durationMinutes: spike.durationMinutes,
    extraKcal: spike.extraKcal,
    peakBpm: spike.peakBpm,
    restingBpm: spike.restingBpm,
    features: features ? (features as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    suggestedSport: suggestion?.sport ?? null,
    confidence: suggestion?.confidence ?? null,
    basis: suggestion?.basis ?? null,
    alternatives: suggestion ? (suggestion.alternatives as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
    suggestionReady: suggestion?.ready ?? false,
  };
}

/** Ubesvarede fund, som en senere aktivitet eller et svar ikke allerede dækker (nyeste først). */
async function loadPending(userId: string, now: Date) {
  const rows = await prisma.pulseActivityCandidate.findMany({
    where: { userId, status: "PENDING", startedAt: { gte: new Date(now.getTime() - PROMPT_DAYS * DAY) } },
    orderBy: { startedAt: "desc" },
  });
  if (rows.length === 0) return rows;

  const from = new Date(Math.min(...rows.map((r) => r.startedAt.getTime())) - DAY);
  const [activities, reviews] = await Promise.all([
    prisma.activity.findMany({ where: { userId, startedAt: { gte: from } }, select: { startedAt: true, durationMinutes: true } }),
    prisma.heartRateSpikeReview.findMany({ where: { userId, startedAt: { gte: from } }, select: { startedAt: true, endedAt: true } }),
  ]);
  const covered = new Set<string>();
  for (const row of rows) {
    const start = row.startedAt.getTime();
    const end = row.endedAt.getTime();
    const hit =
      activities.some((a) => overlaps(start, end, a.startedAt.getTime(), a.startedAt.getTime() + a.durationMinutes * MINUTE)) ||
      reviews.some((r) => overlaps(start, end, r.startedAt.getTime(), r.endedAt.getTime()));
    if (hit) covered.add(row.id);
  }
  if (covered.size > 0) {
    await prisma.pulseActivityCandidate.updateMany({ where: { id: { in: [...covered] } }, data: { status: "COVERED" } });
  }
  return rows.filter((row) => !covered.has(row.id));
}

function toSuggestionView(row: {
  suggestedSport: string | null;
  confidence: number | null;
  basis: string | null;
  alternatives: Prisma.JsonValue;
  features: Prisma.JsonValue;
  suggestionReady: boolean;
}): PulseSuggestionView | null {
  if (!row.suggestionReady || !row.suggestedSport) return null;
  const alternatives = Array.isArray(row.alternatives)
    ? (row.alternatives as { sport?: unknown }[])
        .map((entry) => (typeof entry?.sport === "string" ? entry.sport : null))
        .filter((sport): sport is string => Boolean(sport) && sport !== row.suggestedSport)
    : [];
  return {
    sport: row.suggestedSport,
    label: getSportMeta(row.suggestedSport).label,
    confidence: row.confidence ?? 0,
    basis: row.basis === "personal" ? "personal" : "pattern",
    shape: row.features && typeof row.features === "object" && !Array.isArray(row.features)
      ? pulseShapeTags(row.features as unknown as PulseFeatures)
      : [],
    alternatives: alternatives.slice(0, 2).map((sport) => ({ sport, label: getSportMeta(sport).label })),
  };
}

/** Næste "Vi kan se, at din puls var højere end sædvanlig …"-spørgsmål (eller null), plus hvor mange der venter efter det. */
export async function getPulsePrompt(
  userId: string,
  now = new Date(),
): Promise<{ prompt: PulsePrompt | null; remaining: number }> {
  // Friske udsving siden nattens kørsel (de seneste 48 timer) tages med.
  await syncPulseCandidates(userId, { lookbackHours: 48, now, detectedBy: "live" }).catch((error) =>
    console.error("Pulse candidate sync failed", error),
  );

  const pending = await loadPending(userId, now);
  const first = pending[0];
  if (!first) return { prompt: null, remaining: 0 };

  const start = first.startedAt.getTime();
  const end = first.endedAt.getTime();
  const middle = (start + end) / 2;
  const windowStart = new Date(middle - CHART_HALF_WINDOW_MS);
  const windowEnd = new Date(middle + CHART_HALF_WINDOW_MS);
  const [samples, activities] = await Promise.all([
    prisma.healthMetric.findMany({
      where: { userId, type: "HEART_RATE_BPM", recordedAt: { gte: windowStart, lte: windowEnd } },
      orderBy: { recordedAt: "asc" },
      select: { recordedAt: true, value: true },
    }),
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(start - WEEK_FETCH_MS), lte: new Date(start + WEEK_FETCH_MS) } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true, durationMinutes: true, sportType: true },
    }),
  ]);

  return {
    remaining: pending.length - 1,
    prompt: {
      startedAt: first.startedAt.toISOString(),
      endedAt: first.endedAt.toISOString(),
      durationMinutes: first.durationMinutes,
      extraKcal: first.extraKcal,
      peakBpm: first.peakBpm,
      restingBpm: first.restingBpm,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      samples: samples.map((row) => ({ at: row.recordedAt.toISOString(), bpm: Math.round(row.value) })),
      weekActivities: activities.map((a) => ({
        startedAt: a.startedAt.toISOString(),
        durationMinutes: a.durationMinutes,
        sportType: a.sportType,
      })),
      suggestion: toSuggestionView(first),
    },
  };
}

/** Brugerens svar (en aktivitet) eller "Spring over" — gemmes på fundet, så robotten kan lære af det. */
export async function recordPulseAnswer(
  userId: string,
  input: { startedAt: Date; endedAt: Date; extraKcal: number; activityId?: string | null },
) {
  const activity = input.activityId
    ? await prisma.activity.findFirst({ where: { id: input.activityId, userId }, select: { sportType: true } })
    : null;
  const data = {
    endedAt: input.endedAt,
    extraKcal: input.extraKcal,
    activityId: input.activityId ?? null,
    dismissed: !input.activityId,
  };
  await prisma.heartRateSpikeReview.upsert({
    where: { userId_startedAt: { userId, startedAt: input.startedAt } },
    create: { userId, startedAt: input.startedAt, ...data },
    update: data,
  });
  await prisma.pulseActivityCandidate.updateMany({
    where: { userId, status: "PENDING", startedAt: { lte: input.endedAt }, endedAt: { gte: input.startedAt } },
    data: {
      status: activity ? "ANSWERED" : "SKIPPED",
      answeredSport: activity ? normalizeSportType(activity.sportType) : null,
      answeredAt: new Date(),
    },
  });
}

/** Robottens træfsikkerhed på besvarede fund (admin → Robotter og jobbets besked). */
export async function pulseRobotStats(now = new Date()) {
  const since = new Date(now.getTime() - 30 * DAY);
  const [byStatus, answered] = await Promise.all([
    prisma.pulseActivityCandidate.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.pulseActivityCandidate.findMany({
      where: { status: "ANSWERED", answeredAt: { gte: since }, suggestedSport: { not: null } },
      select: { suggestedSport: true, answeredSport: true, suggestionReady: true },
    }),
  ]);
  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])) as Partial<
    Record<"PENDING" | "ANSWERED" | "SKIPPED" | "COVERED" | "EXPIRED", number>
  >;
  const hit = (row: { suggestedSport: string | null; answeredSport: string | null }) =>
    row.suggestedSport !== null && row.suggestedSport === row.answeredSport;
  const shown = answered.filter((row) => row.suggestionReady);
  return {
    pending: counts.PENDING ?? 0,
    answered: counts.ANSWERED ?? 0,
    skipped: counts.SKIPPED ?? 0,
    expired: counts.EXPIRED ?? 0,
    guessed: answered.length,
    guessedRight: answered.filter(hit).length,
    shown: shown.length,
    shownRight: shown.filter(hit).length,
  };
}

/** Nattens kørsel: alle brugere med pulsdata de seneste 8 dage. */
export async function runPulseNightJob(): Promise<JobResult> {
  const now = new Date();
  const users = await prisma.healthMetric.groupBy({
    by: ["userId"],
    where: { type: "HEART_RATE_BPM", recordedAt: { gte: new Date(now.getTime() - 8 * DAY) } },
  });

  const total: SyncResult = { found: 0, created: 0, updated: 0, suggested: 0 };
  let failed = 0;
  for (const { userId } of users) {
    try {
      const result = await syncPulseCandidates(userId, { lookbackHours: NIGHT_LOOKBACK_HOURS, now, detectedBy: "night" });
      total.found += result.found;
      total.created += result.created;
      total.updated += result.updated;
      total.suggested += result.suggested;
    } catch (error) {
      failed++;
      console.error(`[pulse-activity] ${userId} fejlede`, error);
    }
  }

  const expired = await prisma.pulseActivityCandidate.updateMany({
    where: { status: "PENDING", startedAt: { lt: new Date(now.getTime() - EXPIRE_DAYS * DAY) } },
    data: { status: "EXPIRED" },
  });

  const stats = await pulseRobotStats(now).catch(() => null);
  const accuracy =
    stats && stats.guessed > 0
      ? ` · gæt ramt ${Math.round((stats.guessedRight / stats.guessed) * 100)} % (${stats.guessed} besvarede)`
      : "";
  const message =
    `${users.length} brugere tjekket · ${total.created} nye udsving uden sport, ${total.updated} opdateret · ` +
    `${total.suggested} med sportsforslag${expired.count ? ` · ${expired.count} udløbet` : ""}` +
    `${failed ? ` · ${failed} fejlede` : ""}${accuracy}`;
  return { message, count: total.created + total.updated };
}
