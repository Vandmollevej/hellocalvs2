import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeAge } from "@/lib/age";
import { getSubscriptionTier } from "@/lib/subscription";
import { STATS_TZ } from "@/lib/admin-stats-range";
import {
  ageBucketFor,
  buildPersonaAggregates,
  type PersonaAggregates,
  type PersonaTier,
  type PersonaUserFeatures,
} from "@/lib/persona-groups";
import { analysePersonasWithAi, type PersonaAiResult } from "@/lib/persona-ai";

// Admin → Brugere → Personas (docs/DECISIONS.md 2026-10-02): samler ét
// anonymt sæt træk pr. bruger fra databasen, grupperer (persona-groups.ts),
// lader AI'en udlede personas (persona-ai.ts) og gemmer resultatet som
// PersonaSnapshot. Kører kun ved deploy (én gang pr. build) og manuelt —
// ingen natlig plan (ejerens valg 2026-10-03, docs/DECISIONS.md).

const DAY_MS = 24 * 60 * 60 * 1000;
const LOGIN_WINDOW_DAYS = 90;
const USAGE_WINDOW_DAYS = 30;

// Time (0–23) og ugedag (0 = mandag) i dansk tid.
function copenhagenHourAndWeekday(date: Date): { hour: number; weekday: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: STATS_TZ, hour: "2-digit", hourCycle: "h23", weekday: "short" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday ?? "");
  return { hour: Number(parts.hour) % 24, weekday: weekdayIndex < 0 ? 0 : weekdayIndex };
}

function copenhagenDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STATS_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// "iPhone · Safari" → "iPhone" (src/lib/user-login.ts describeDevice).
function deviceOsFromLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const os = label.split("·")[0]?.trim();
  return os && os !== "Ukendt enhed" ? os : null;
}

export async function collectPersonaFeatures(now: Date = new Date()): Promise<PersonaUserFeatures[]> {
  const loginSince = new Date(now.getTime() - LOGIN_WINDOW_DAYS * DAY_MS);
  const usageSince = new Date(now.getTime() - USAGE_WINDOW_DAYS * DAY_MS);

  const users = await prisma.user.findMany({
    where: { role: "USER", forgottenAt: null },
    select: {
      id: true,
      createdAt: true,
      region: true,
      appLocale: true,
      birthDate: true,
      sex: true,
      goalMode: true,
      activityLevel: true,
      onboardingCompletedAt: true,
      wantsPushNotifications: true,
      subscription: { select: { status: true, currentPeriodEnd: true, plan: true } },
      familyMembership: {
        select: {
          family: {
            select: { owner: { select: { subscription: { select: { status: true, currentPeriodEnd: true, plan: true } } } } },
          },
        },
      },
      integrations: { where: { status: "CONNECTED" }, select: { provider: true } },
      knownDevices: { orderBy: { lastSeenAt: "desc" }, take: 1, select: { label: true } },
    },
  });
  if (users.length === 0) return [];
  const userIds = users.map((u) => u.id);
  const userFilter: Prisma.StringFilter = { in: userIds };

  const [logins, registrations, activities, weighIns] = await Promise.all([
    prisma.loginEvent.findMany({
      where: { userId: userFilter, createdAt: { gte: loginSince } },
      select: { userId: true, createdAt: true, country: true, city: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.registration.findMany({
      where: { userId: userFilter, createdAt: { gte: usageSince } },
      select: { userId: true, createdAt: true, product: { select: { externalSource: true } } },
    }),
    prisma.activity.groupBy({ by: ["userId"], where: { userId: userFilter, createdAt: { gte: usageSince } }, _count: { _all: true } }),
    prisma.weightEntry.groupBy({ by: ["userId"], where: { userId: userFilter, weighedAt: { gte: usageSince } }, _count: { _all: true } }),
  ]);

  type LoginAgg = { count: number; days: Set<string>; hours: number[]; weekdays: number[]; last: Date | null; city: string | null; country: string | null };
  const loginByUser = new Map<string, LoginAgg>();
  for (const login of logins) {
    const agg =
      loginByUser.get(login.userId) ??
      { count: 0, days: new Set<string>(), hours: new Array<number>(24).fill(0), weekdays: new Array<number>(7).fill(0), last: null, city: null, country: null };
    const { hour, weekday } = copenhagenHourAndWeekday(login.createdAt);
    agg.count += 1;
    agg.days.add(copenhagenDay(login.createdAt));
    agg.hours[hour] += 1;
    agg.weekdays[weekday] += 1;
    agg.last = login.createdAt; // sorteret stigende → sidste vinder
    if (login.city) agg.city = login.city;
    if (login.country) agg.country = login.country;
    loginByUser.set(login.userId, agg);
  }

  type RegAgg = { count: number; hellofresh: number; days: Set<string> };
  const regByUser = new Map<string, RegAgg>();
  for (const reg of registrations) {
    const agg = regByUser.get(reg.userId) ?? { count: 0, hellofresh: 0, days: new Set<string>() };
    agg.count += 1;
    if (reg.product?.externalSource === "HELLOFRESH") agg.hellofresh += 1;
    agg.days.add(copenhagenDay(reg.createdAt));
    regByUser.set(reg.userId, agg);
  }
  const activityByUser = new Map(activities.map((a) => [a.userId, a._count._all]));
  const weighInByUser = new Map(weighIns.map((w) => [w.userId, w._count._all]));

  return users.map((user) => {
    const sub = user.subscription;
    let tier: PersonaTier = "free";
    if (sub && getSubscriptionTier(sub, now) === "SERIOUS") {
      tier = sub.plan === "FAMILY" ? "family" : "serious";
    } else {
      const owner = user.familyMembership?.family.owner.subscription ?? null;
      if (owner && owner.plan === "FAMILY" && getSubscriptionTier(owner, now) === "SERIOUS") tier = "family";
    }
    const login = loginByUser.get(user.id);
    const reg = regByUser.get(user.id);
    return {
      // Land = seneste login-land, hvis kendt; ellers profilens region.
      country: login?.country ?? user.region,
      city: login?.city ?? null,
      language: user.appLocale,
      ageBucket: ageBucketFor(computeAge(user.birthDate)),
      sex: user.sex ?? "UNKNOWN",
      tier,
      accountAgeDays: Math.floor((now.getTime() - user.createdAt.getTime()) / DAY_MS),
      logins90d: login?.count ?? 0,
      loginDays90d: login?.days.size ?? 0,
      lastLoginDaysAgo: login?.last ? Math.floor((now.getTime() - login.last.getTime()) / DAY_MS) : null,
      registrations30d: reg?.count ?? 0,
      activeDays30d: reg?.days.size ?? 0,
      hellofreshRegistrations30d: reg?.hellofresh ?? 0,
      activities30d: activityByUser.get(user.id) ?? 0,
      weighIns30d: weighInByUser.get(user.id) ?? 0,
      integrations: user.integrations.map((i) => i.provider),
      loginHours: login?.hours ?? new Array<number>(24).fill(0),
      loginWeekdays: login?.weekdays ?? new Array<number>(7).fill(0),
      deviceOs: deviceOsFromLabel(user.knownDevices[0]?.label),
      onboardingCompleted: user.onboardingCompletedAt !== null,
      pushEnabled: user.wantsPushNotifications,
      goalMode: user.goalMode,
      activityLevel: user.activityLevel,
    };
  });
}

export async function computePersonaAggregates(now: Date = new Date()): Promise<PersonaAggregates> {
  return buildPersonaAggregates(await collectPersonaFeatures(now), now);
}

export type PersonaSnapshotView = {
  id: string;
  createdAt: Date;
  source: string;
  userCount: number;
  model: string | null;
  aggregates: PersonaAggregates;
  personas: PersonaAiResult | null;
  error: string | null;
  durationMs: number | null;
};

// Beregner grupperne, kører AI'en og gemmer et snapshot. Fejler AI'en,
// gemmes snapshottet stadig med gruppetallene og fejlteksten.
// Next.js skriver buildets id i .next/BUILD_ID (også i standalone-output).
let buildIdCache: string | null | undefined;
export async function currentBuildId(): Promise<string | null> {
  if (buildIdCache !== undefined) return buildIdCache;
  try {
    const id = (await readFile(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8")).trim();
    buildIdCache = id && id !== "development" ? id : null;
  } catch {
    buildIdCache = null;
  }
  return buildIdCache;
}

export async function runPersonaAnalysis(source: "job" | "manual"): Promise<PersonaSnapshotView> {
  const started = Date.now();
  const aggregates = await computePersonaAggregates();
  let personas: PersonaAiResult | null = null;
  let model: string | null = null;
  let error: string | null = null;
  if (aggregates.userCount === 0) {
    error = "Ingen brugere at analysere";
  } else {
    try {
      const ai = await analysePersonasWithAi(aggregates);
      personas = ai.result;
      model = ai.model;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "AI-analysen fejlede";
    }
  }
  const row = await prisma.personaSnapshot.create({
    data: {
      source,
      buildId: await currentBuildId(),
      userCount: aggregates.userCount,
      model,
      aggregates: aggregates as unknown as Prisma.InputJsonValue,
      personas: personas ? (personas as unknown as Prisma.InputJsonValue) : undefined,
      error,
      durationMs: Date.now() - started,
    },
  });
  return { ...row, aggregates, personas };
}

// Cronjob-runner (src/lib/jobs/registry.ts "personas"): kaldes ved deploy
// (requestPersonaRunOnDeploy) og ved "Kør nu" under Cronjobs.
export async function runPersonaJob(): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return "Sprunget over: OPENAI_API_KEY er ikke sat";
  const snapshot = await runPersonaAnalysis("job");
  if (snapshot.error) throw new Error(snapshot.error);
  return `${snapshot.userCount} brugere, ${snapshot.personas?.personas.length ?? 0} personas (${snapshot.model})`;
}

export async function getLatestPersonaSnapshot(): Promise<PersonaSnapshotView | null> {
  const row = await prisma.personaSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  if (!row) return null;
  return {
    ...row,
    aggregates: row.aggregates as unknown as PersonaAggregates,
    personas: (row.personas as unknown as PersonaAiResult | null) ?? null,
  };
}

export async function listPersonaSnapshots(limit = 12) {
  return prisma.personaSnapshot.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, createdAt: true, source: true, userCount: true, model: true, error: true, durationMs: true },
  });
}

// Ved opstart af en ny build (= deploy efter push til master): bed
// cronjob-runneren om én kørsel, hvis der endnu ikke findes et snapshot for
// denne build. Kun i produktion og kun med OpenAI-nøgle. En genstart af
// samme build udløser ingen ny kørsel.
export async function requestPersonaRunOnDeploy(): Promise<void> {
  if (process.env.NODE_ENV !== "production" || !process.env.OPENAI_API_KEY) return;
  const buildId = await currentBuildId();
  if (!buildId) return;
  const existing = await prisma.personaSnapshot.findFirst({ where: { buildId }, select: { id: true } });
  if (existing) return;
  const now = new Date();
  await prisma.scheduledJob.upsert({
    where: { key: "personas" },
    create: { key: "personas", intervalMinutes: null, runAtTime: null, runRequestedAt: now },
    update: { runRequestedAt: now },
  });
}
