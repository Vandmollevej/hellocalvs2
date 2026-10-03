import { ActivitySource, HealthMetricSource, Prisma, WeightSource, type IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { INTEGRATION_CATALOG, integrationSlug, type IntegrationMeta } from "@/lib/integrations";
import { adapterByProvider, isConfigured } from "@/lib/integrations/registry";
import { activeOverTime, keptForLabel, median, uninstallDurations } from "@/lib/integration-lifecycle";
import { capabilitiesFor, resolveSyncSettings, type ReadType, type WriteType } from "@/lib/integrations/sync-settings";
import {
  STATS_TZ,
  listBuckets,
  resolveStatsRange,
  type ResolvedRange,
  type StatsFilterInput,
} from "@/lib/admin-stats-range";

// Tal til admin → Integrationer (docs/DECISIONS.md 2026-10-02). Installationer
// og frakoblinger, synkroniseringer og push kommer fra IntegrationEvent;
// nuværende status fra Integration; datamængder fra de rækker, integrationen
// har skrevet (WeightEntry/Activity/HealthMetric med integrationens kilde).

export type Kpi = { current: number; previous: number };
export type SeriesPoint = { key: string; label: string; values: Record<string, number> };

type EventCounts = {
  connected: number;
  disconnected: number;
  syncs: number;
  syncErrors: number;
  delivered: number;
  pushed: number;
  pushes: number;
  settingsChanged: number;
  activeUsers: number;
};

const EMPTY_COUNTS: EventCounts = {
  connected: 0,
  disconnected: 0,
  syncs: 0,
  syncErrors: 0,
  delivered: 0,
  pushed: 0,
  pushes: 0,
  settingsChanged: 0,
  activeUsers: 0,
};

export type IntegrationOverviewRow = {
  meta: IntegrationMeta;
  slug: string;
  configured: boolean | null; // null = ikke en cloud-integration
  activeNow: number;
  errorNow: number;
  everInstalled: number;
  uninstalledNow: number;
  period: EventCounts;
  previous: EventCounts;
  lastSyncAt: string | null;
};

export type IntegrationsOverview = {
  range: ResolvedRange;
  rows: IntegrationOverviewRow[];
  usersWithIntegration: number;
  totalUsers: number;
  totals: { active: Kpi; connected: Kpi; disconnected: Kpi; syncs: Kpi; delivered: Kpi; errors: Kpi };
  installs: SeriesPoint[];
  activity: SeriesPoint[];
};

type BucketRow = { bucket: string; provider: IntegrationProvider; type: string; n: number; items: number };

// SQL-udtryk for tidsbucket i dansk tid; matcher bucketKey() (samme som admin-stats.ts).
function bucketSql(column: Prisma.Sql, granularity: ResolvedRange["granularity"]) {
  return Prisma.sql`to_char(date_trunc(${granularity}::text, ${column} AT TIME ZONE 'UTC' AT TIME ZONE ${STATS_TZ}::text), 'YYYY-MM-DD"T"HH24')`;
}

function emptySeries(range: ResolvedRange, keys: string[]): SeriesPoint[] {
  return listBuckets(range).map((b) => ({ key: b.key, label: b.label, values: Object.fromEntries(keys.map((k) => [k, 0])) }));
}

function add(points: SeriesPoint[], key: string, series: string, value: number) {
  const point = points.find((p) => p.key === key);
  if (point) point.values[series] = (point.values[series] ?? 0) + value;
}

async function earliestEvent(provider?: IntegrationProvider) {
  const first = await prisma.integrationEvent.findFirst({
    where: provider ? { provider } : undefined,
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return first?.createdAt ?? new Date();
}

async function eventCounts(from: Date, to: Date, provider?: IntegrationProvider) {
  const providerSql = provider ? Prisma.sql`AND e.provider = ${provider}::"IntegrationProvider"` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ provider: IntegrationProvider; type: string; n: number; items: number; users: number }[]>`
    SELECT e.provider::text AS provider, e.type::text AS type, count(*)::int AS n,
      coalesce(sum(e."itemCount"), 0)::int AS items, count(DISTINCT e."userId")::int AS users
    FROM integration_events e
    WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to} ${providerSql}
    GROUP BY e.provider, e.type`;
  const activeRows = await prisma.$queryRaw<{ provider: IntegrationProvider; users: number }[]>`
    SELECT e.provider::text AS provider, count(DISTINCT e."userId")::int AS users
    FROM integration_events e
    WHERE e."createdAt" >= ${from} AND e."createdAt" < ${to} AND e.type IN ('SYNC', 'PUSH') ${providerSql}
    GROUP BY e.provider`;

  const byProvider = new Map<IntegrationProvider, EventCounts>();
  const get = (p: IntegrationProvider) => {
    if (!byProvider.has(p)) byProvider.set(p, { ...EMPTY_COUNTS });
    return byProvider.get(p)!;
  };
  for (const row of rows) {
    const c = get(row.provider);
    if (row.type === "CONNECTED") c.connected += row.n;
    if (row.type === "DISCONNECTED") c.disconnected += row.n;
    if (row.type === "SYNC") {
      c.syncs += row.n;
      c.delivered += row.items;
    }
    if (row.type === "SYNC_ERROR") c.syncErrors += row.n;
    if (row.type === "PUSH") {
      c.pushes += row.n;
      c.pushed += row.items;
    }
    if (row.type === "SETTINGS_CHANGED") c.settingsChanged += row.n;
  }
  for (const row of activeRows) get(row.provider).activeUsers = row.users;
  return byProvider;
}

async function bucketRows(range: ResolvedRange, provider?: IntegrationProvider) {
  const providerSql = provider ? Prisma.sql`AND e.provider = ${provider}::"IntegrationProvider"` : Prisma.empty;
  return prisma.$queryRaw<BucketRow[]>`
    SELECT ${bucketSql(Prisma.sql`e."createdAt"`, range.granularity)} AS bucket, e.provider::text AS provider,
      e.type::text AS type, count(*)::int AS n, coalesce(sum(e."itemCount"), 0)::int AS items
    FROM integration_events e
    WHERE e."createdAt" >= ${range.from} AND e."createdAt" < ${range.to} ${providerSql}
    GROUP BY 1, 2, 3`;
}

async function statusCounts() {
  const rows = await prisma.integration.groupBy({
    by: ["provider", "status"],
    where: { connectedAt: { not: null } },
    _count: { _all: true },
    _max: { lastSyncedAt: true },
  });
  const map = new Map<IntegrationProvider, { active: number; error: number; disconnected: number; lastSync: Date | null }>();
  for (const row of rows) {
    const entry = map.get(row.provider) ?? { active: 0, error: 0, disconnected: 0, lastSync: null };
    if (row.status === "CONNECTED") entry.active += row._count._all;
    if (row.status === "ERROR") entry.error += row._count._all;
    if (row.status === "DISCONNECTED") entry.disconnected += row._count._all;
    const last = row._max.lastSyncedAt;
    if (last && (!entry.lastSync || last > entry.lastSync)) entry.lastSync = last;
    map.set(row.provider, entry);
  }
  return map;
}

// Kataloget i visningsrækkefølge; Fitbit (afløst af Google Health) kun hvis den har brugere.
function visibleCatalog(used: Set<IntegrationProvider>) {
  return INTEGRATION_CATALOG.filter((meta) => !meta.legacy || used.has(meta.provider));
}

export async function getIntegrationsOverview(filter: StatsFilterInput, now = new Date()): Promise<IntegrationsOverview> {
  const range = resolveStatsRange(filter, now, await earliestEvent());
  const [status, period, previous, buckets, usersWithIntegration, totalUsers] = await Promise.all([
    statusCounts(),
    eventCounts(range.from, range.to),
    eventCounts(range.prevFrom, range.from),
    bucketRows(range),
    prisma.integration
      .findMany({ where: { status: { not: "DISCONNECTED" }, connectedAt: { not: null } }, distinct: ["userId"], select: { userId: true } })
      .then((rows) => rows.length),
    prisma.user.count({ where: { forgottenAt: null } }),
  ]);

  const rows: IntegrationOverviewRow[] = visibleCatalog(new Set(status.keys())).map((meta) => {
    const s = status.get(meta.provider);
    const adapter = adapterByProvider(meta.provider);
    return {
      meta,
      slug: integrationSlug(meta.provider),
      configured: adapter ? isConfigured(adapter) : null,
      activeNow: s?.active ?? 0,
      errorNow: s?.error ?? 0,
      everInstalled: (s?.active ?? 0) + (s?.error ?? 0) + (s?.disconnected ?? 0),
      uninstalledNow: s?.disconnected ?? 0,
      period: period.get(meta.provider) ?? { ...EMPTY_COUNTS },
      previous: previous.get(meta.provider) ?? { ...EMPTY_COUNTS },
      lastSyncAt: s?.lastSync?.toISOString() ?? null,
    };
  });

  const sum = (pick: (c: EventCounts) => number) => ({
    current: [...period.values()].reduce((a, c) => a + pick(c), 0),
    previous: [...previous.values()].reduce((a, c) => a + pick(c), 0),
  });
  const activeNow = rows.reduce((a, r) => a + r.activeNow + r.errorNow, 0);
  // Aktive ved periodens start = nu minus nettotilgangen i perioden.
  const netInPeriod = sum((c) => c.connected - c.disconnected).current;

  const installs = emptySeries(range, ["connected", "disconnected"]);
  const activity = emptySeries(range, ["syncs", "errors"]);
  for (const row of buckets) {
    if (row.type === "CONNECTED") add(installs, row.bucket, "connected", row.n);
    if (row.type === "DISCONNECTED") add(installs, row.bucket, "disconnected", row.n);
    if (row.type === "SYNC") add(activity, row.bucket, "syncs", row.n);
    if (row.type === "SYNC_ERROR") add(activity, row.bucket, "errors", row.n);
  }

  return {
    range,
    rows,
    usersWithIntegration,
    totalUsers,
    totals: {
      active: { current: activeNow, previous: Math.max(0, activeNow - netInPeriod) },
      connected: sum((c) => c.connected),
      disconnected: sum((c) => c.disconnected),
      syncs: sum((c) => c.syncs),
      delivered: sum((c) => c.delivered),
      errors: sum((c) => c.syncErrors),
    },
    installs,
    activity,
  };
}

// --- Én integration ---------------------------------------------------------

export type PersonRow = { email: string; at: string; detail?: string };

export type IntegrationDetail = {
  meta: IntegrationMeta;
  range: ResolvedRange;
  configured: boolean | null;
  activeNow: number;
  errorNow: number;
  everInstalled: number;
  uninstalledNow: number;
  period: EventCounts;
  previous: EventCounts;
  // Nuværende antal minus nettotilgang = antal ved periodens start.
  activeAtStart: number;
  installs: SeriesPoint[];
  activity: SeriesPoint[];
  delivered: SeriesPoint[];
  cumulative: SeriesPoint[];
  medianDaysBeforeUninstall: number | null;
  uninstalledWithin7Days: { count: number; of: number };
  dataStored: { label: string; count: number }[];
  readSettings: { type: ReadType; on: number; of: number }[];
  writeSettings: { type: WriteType; on: number; of: number }[];
  recentInstalls: PersonRow[];
  recentUninstalls: PersonRow[];
  errors: PersonRow[];
};

const METRIC_LABELS: Partial<Record<string, string>> = {
  STEPS: "Skridt",
  ACTIVE_ENERGY_KCAL: "Aktiv energi",
  RESTING_ENERGY_KCAL: "Hvileenergi",
  HEART_RATE_BPM: "Puls",
  RESTING_HEART_RATE_BPM: "Hvilepuls",
  SLEEP_MINUTES: "Søvn",
  BODY_FAT_PERCENT: "Fedtprocent",
  MUSCLE_MASS_KG: "Muskelmasse",
  BODY_WATER_PERCENT: "Kropsvand",
  FAT_MASS_KG: "Fedtmasse",
  FAT_FREE_MASS_KG: "Fedtfri masse",
  BONE_MASS_KG: "Knoglemasse",
  VISCERAL_FAT_INDEX: "Visceralt fedt",
  HEIGHT_CM: "Højde",
  BMI: "BMI",
  WATER_ML: "Vand",
  DISTANCE_KM: "Distance",
};

function oneOf<T extends Record<string, string>>(values: T, provider: IntegrationProvider): T[keyof T] | null {
  return (Object.values(values) as string[]).includes(provider) ? (provider as T[keyof T]) : null;
}

async function storedData(provider: IntegrationProvider) {
  const weightSource = oneOf(WeightSource, provider);
  const activitySource = oneOf(ActivitySource, provider);
  const metricSource = oneOf(HealthMetricSource, provider);
  const [weights, activities, metrics] = await Promise.all([
    weightSource ? prisma.weightEntry.count({ where: { source: weightSource } }) : 0,
    activitySource ? prisma.activity.count({ where: { source: activitySource } }) : 0,
    metricSource
      ? prisma.healthMetric.groupBy({ by: ["type"], where: { source: metricSource }, _count: { _all: true } })
      : Promise.resolve([] as { type: string; _count: { _all: number } }[]),
  ]);
  const rows = [
    { label: "Vejninger", count: weights },
    { label: "Træningspas", count: activities },
    ...metrics.map((m) => ({ label: METRIC_LABELS[m.type] ?? m.type, count: m._count._all })),
  ];
  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
}

export async function getIntegrationDetail(slug: string, filter: StatsFilterInput, now = new Date()): Promise<IntegrationDetail | null> {
  const meta = INTEGRATION_CATALOG.find((m) => integrationSlug(m.provider) === slug);
  if (!meta) return null;
  const provider = meta.provider;
  const range = resolveStatsRange(filter, now, await earliestEvent(provider));
  const adapter = adapterByProvider(provider);

  const [status, period, previous, buckets, lifecycle, data, rows, recentInstalls, recentUninstalls] = await Promise.all([
    statusCounts(),
    eventCounts(range.from, range.to, provider),
    eventCounts(range.prevFrom, range.from, provider),
    bucketRows(range, provider),
    prisma.integrationEvent.findMany({
      where: { provider, type: { in: ["CONNECTED", "DISCONNECTED"] } },
      orderBy: { createdAt: "asc" },
      select: { userId: true, type: true, createdAt: true },
    }),
    storedData(provider),
    prisma.integration.findMany({
      where: { provider, connectedAt: { not: null } },
      select: { status: true, syncSettings: true, lastError: true, lastSyncedAt: true, user: { select: { email: true } } },
    }),
    prisma.integrationEvent.findMany({
      where: { provider, type: "CONNECTED" },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { createdAt: true, user: { select: { email: true } } },
    }),
    prisma.integrationEvent.findMany({
      where: { provider, type: "DISCONNECTED" },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { createdAt: true, userId: true, user: { select: { email: true } } },
    }),
  ]);

  const s = status.get(provider);
  const p = period.get(provider) ?? { ...EMPTY_COUNTS };
  const activeNow = (s?.active ?? 0) + (s?.error ?? 0);

  const installs = emptySeries(range, ["connected", "disconnected"]);
  const activity = emptySeries(range, ["syncs", "pushes", "errors"]);
  const delivered = emptySeries(range, ["delivered", "pushed"]);
  for (const row of buckets) {
    if (row.type === "CONNECTED") add(installs, row.bucket, "connected", row.n);
    if (row.type === "DISCONNECTED") add(installs, row.bucket, "disconnected", row.n);
    if (row.type === "SYNC") {
      add(activity, row.bucket, "syncs", row.n);
      add(delivered, row.bucket, "delivered", row.items);
    }
    if (row.type === "PUSH") {
      add(activity, row.bucket, "pushes", row.n);
      add(delivered, row.bucket, "pushed", row.items);
    }
    if (row.type === "SYNC_ERROR") add(activity, row.bucket, "errors", row.n);
  }

  // Aktive installationer ved udgangen af hver periode-bucket.
  const over = activeOverTime(
    activeNow,
    installs.map((point) => ({ connected: point.values.connected, disconnected: point.values.disconnected }))
  );
  const cumulative = installs.map((point, i) => ({ key: point.key, label: point.label, values: { active: over.series[i] } }));

  const durations = uninstallDurations(lifecycle);
  const caps = capabilitiesFor(provider);
  const connectedRows = rows.filter((r) => r.status !== "DISCONNECTED");
  const settings = connectedRows.map((r) => resolveSyncSettings(provider, r.syncSettings));

  return {
    meta,
    range,
    configured: adapter ? isConfigured(adapter) : null,
    activeNow,
    errorNow: s?.error ?? 0,
    everInstalled: activeNow + (s?.disconnected ?? 0),
    uninstalledNow: s?.disconnected ?? 0,
    period: p,
    previous: previous.get(provider) ?? { ...EMPTY_COUNTS },
    activeAtStart: over.atStart,
    installs,
    activity,
    delivered,
    cumulative,
    medianDaysBeforeUninstall: median(durations),
    uninstalledWithin7Days: { count: durations.filter((d) => d < 7).length, of: durations.length },
    dataStored: data,
    readSettings: caps.read.map((type) => ({ type, on: settings.filter((x) => x.read[type]).length, of: settings.length })),
    writeSettings: caps.write.map((type) => ({ type, on: settings.filter((x) => x.write[type]).length, of: settings.length })),
    recentInstalls: recentInstalls.map((e) => ({ email: e.user.email, at: e.createdAt.toISOString() })),
    recentUninstalls: recentUninstalls.map((e) => ({
      email: e.user.email,
      at: e.createdAt.toISOString(),
      detail: keptForLabel(lifecycle, e.userId, e.createdAt),
    })),
    errors: rows
      .filter((r) => r.status === "ERROR")
      .map((r) => ({ email: r.user.email, at: r.lastSyncedAt?.toISOString() ?? "", detail: r.lastError ?? undefined }))
      .slice(0, 25),
  };
}


// --- Opmærksomhedspunkter ---------------------------------------------------

export type IntegrationAlert = { tone: "warning" | "danger" | "info"; slug: string; text: string };

// Automatiske fund på oversigten: manglende nøgler, forbindelser i fejl,
// høj fejlrate og flere frakoblinger end tilkoblinger i perioden.
export function integrationAlerts(rows: IntegrationOverviewRow[]): IntegrationAlert[] {
  const alerts: IntegrationAlert[] = [];
  for (const row of rows) {
    const name = row.meta.label;
    if (row.meta.kind === "oauth" && row.configured === false && !row.meta.legacy) {
      alerts.push({ tone: "warning", slug: row.slug, text: `${name} mangler nøgler på serveren — brugerne kan ikke forbinde.` });
    }
    if (row.errorNow > 0) {
      alerts.push({
        tone: "danger",
        slug: row.slug,
        text: `${row.errorNow} ${name}-forbindelse${row.errorNow === 1 ? "" : "r"} står i fejl lige nu.`,
      });
    }
    const attempts = row.period.syncs + row.period.syncErrors;
    if (attempts >= 10 && row.period.syncErrors / attempts >= 0.1) {
      alerts.push({
        tone: "danger",
        slug: row.slug,
        text: `${name}: ${Math.round((row.period.syncErrors / attempts) * 100)} % af synkroniseringerne fejlede i perioden.`,
      });
    }
    if (row.period.disconnected > row.period.connected && row.period.disconnected >= 2) {
      alerts.push({
        tone: "warning",
        slug: row.slug,
        text: `${name}: flere frakoblinger (${row.period.disconnected}) end nye tilkoblinger (${row.period.connected}) i perioden.`,
      });
    }
    if (row.meta.legacy && row.activeNow + row.errorNow > 0) {
      alerts.push({
        tone: "info",
        slug: row.slug,
        text: `${row.activeNow + row.errorNow} bruger${row.activeNow + row.errorNow === 1 ? "" : "e"} har stadig ${name} forbundet — de bør skifte til Google Health.`,
      });
    }
  }
  const order = { danger: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.tone] - order[b.tone]);
}
