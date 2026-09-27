import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSubscriptionTier } from "@/lib/subscription";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support-labels";
import {
  STATS_TZ,
  bucketKey,
  countryLabel,
  listBuckets,
  regionFilterCountries,
  resolveStatsRange,
  type ResolvedRange,
  type StatsBucket,
  type StatsFilterInput,
} from "@/lib/admin-stats-range";

// Tal til /admin/statistics (docs/DECISIONS.md 2026-09-27 "Admin: Statistik").
// Alt er aggregeret: siden (og AI-opsummeringen) får aldrig e-mails, navne
// eller bruger-id'er. Abonnementstype er brugerens *nuværende* type.

type UserTierKey = "free" | "serious" | "family";

// Betalte MobilePay-træk (samme liste som src/lib/payments/mobilepay-subscription.ts).
const PAID_CHARGE_STATUSES = ["CHARGED", "PARTIALLY_CAPTURED", "PARTIALLY_REFUNDED"];

export type Kpi = { current: number; previous: number };
export type SeriesPoint = { key: string; label: string; values: Record<string, number> };
export type Row = { label: string; values: (string | number)[] };
export type TrendItem = { metric: string; current: number; previous: number; pct: number | null; unit?: string };

export type AdminStatistics = {
  range: { label: string; fromDay: string; toDay: string; granularity: ResolvedRange["granularity"] };
  scopeUserCount: number;
  kpis: Record<
    "newUsers" | "activeUsers" | "registrations" | "logins" | "hellofresh" | "revenueDkk" | "support" | "bugs",
    Kpi
  >;
  signups: SeriesPoint[];
  signupsByCountry: Row[];
  tierSnapshot: { free: number; seriousPaid: number; familyPaid: number; comped: number };
  tierByCountry: Row[];
  newPaying: Kpi;
  cancellations: Kpi;
  logins: SeriesPoint[];
  loginsByMethod: Row[];
  registrations: SeriesPoint[];
  registrationsByWeekday: Row[];
  trends: TrendItem[];
  hellofresh: {
    users: Kpi;
    topLogged: Row[];
    topSearched: Row[];
  };
  retention: {
    dau: number;
    wau: number;
    mau: number;
    cohortSize: number;
    day7: { eligible: number; retained: number };
    day30: { eligible: number; retained: number };
    inactive30: number;
  };
  revenue: {
    series: SeriesPoint[];
    byProvider: Row[];
    mrrDkk: number;
    payingNow: number;
    giftCodesRedeemed: Kpi;
    freeMonthsRedeemed: Kpi;
  };
  top: { logged: Row[]; searched: Row[]; misses: Row[]; missTotal: number };
  support: {
    openNow: number;
    medianFirstReplyHours: number | null;
    byCategory: Row[];
    bugsPending: number;
    bugsByStatus: Row[];
  };
};

const METHOD_LABEL: Record<string, string> = {
  password: "E-mail og adgangskode",
  passkey: "Face ID / passkey",
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
  signup: "Ny konto",
};

const WEEKDAYS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

type ScopedUser = { id: string; createdAt: Date; region: string; tier: UserTierKey; paid: boolean };

async function loadUsers(now: Date): Promise<ScopedUser[]> {
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    select: {
      id: true,
      createdAt: true,
      region: true,
      subscription: { select: { status: true, currentPeriodEnd: true, plan: true, provider: true } },
      familyMembership: {
        select: {
          family: {
            select: { owner: { select: { subscription: { select: { status: true, currentPeriodEnd: true, plan: true } } } } },
          },
        },
      },
    },
  });
  return users.map((user) => {
    const sub = user.subscription;
    let tier: UserTierKey = "free";
    let paid = false;
    if (sub && getSubscriptionTier(sub, now) === "SERIOUS") {
      tier = sub.plan === "FAMILY" ? "family" : "serious";
      paid = sub.provider !== null && (sub.status === "ACTIVE" || sub.status === "CANCELED");
    } else {
      const owner = user.familyMembership?.family.owner.subscription ?? null;
      if (owner && owner.plan === "FAMILY" && getSubscriptionTier(owner, now) === "SERIOUS") tier = "family";
    }
    return { id: user.id, createdAt: user.createdAt, region: user.region, tier, paid };
  });
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function emptySeries(buckets: StatsBucket[], series: string[]): SeriesPoint[] {
  return buckets.map((b) => ({ key: b.key, label: b.label, values: Object.fromEntries(series.map((s) => [s, 0])) }));
}

function fillSeries(points: SeriesPoint[], key: string, series: string, value: number) {
  const point = points.find((p) => p.key === key);
  if (point) point.values[series] = (point.values[series] ?? 0) + value;
}

// SQL-udtryk for tidsbucket i dansk tid; matcher bucketKey().
function bucketSql(column: Prisma.Sql, granularity: ResolvedRange["granularity"]) {
  return Prisma.sql`to_char(date_trunc(${granularity}::text, ${column} AT TIME ZONE 'UTC' AT TIME ZONE ${STATS_TZ}::text), 'YYYY-MM-DD"T"HH24')`;
}

function userFilterSql(column: Prisma.Sql, ids: string[] | null) {
  return ids ? Prisma.sql`AND ${column} = ANY(${ids}::text[])` : Prisma.empty;
}

export async function getAdminStatistics(filter: StatsFilterInput, now = new Date()): Promise<AdminStatistics> {
  const allUsers = await loadUsers(now);
  const earliest = allUsers.reduce((min, u) => (u.createdAt < min ? u.createdAt : min), now);
  const range = resolveStatsRange(filter, now, earliest);
  const { from, to, prevFrom, granularity } = range;
  const buckets = listBuckets(range);

  const countries = regionFilterCountries(filter.region);
  const scoped = allUsers.filter(
    (u) => (!countries || countries.includes(u.region)) && (filter.tier === "all" || u.tier === filter.tier)
  );
  const isFiltered = Boolean(countries) || filter.tier !== "all";
  const ids = isFiltered ? scoped.map((u) => u.id) : null;
  const userWhere = ids ? { userId: { in: ids } } : {};
  const inRange = (d: Date) => d >= from && d < to;
  const inPrev = (d: Date) => d >= prevFrom && d < from;
  const kpi = (current: number, previous: number): Kpi => ({ current, previous });

  // --- Nye oprettelser -----------------------------------------------------
  const signups = emptySeries(buckets, ["free", "serious", "family"]);
  const signupCountry = new Map<string, number>();
  for (const u of scoped) {
    if (!inRange(u.createdAt)) continue;
    fillSeries(signups, bucketKey(u.createdAt, granularity), u.tier, 1);
    signupCountry.set(u.region, (signupCountry.get(u.region) ?? 0) + 1);
  }
  const newUsers = kpi(scoped.filter((u) => inRange(u.createdAt)).length, scoped.filter((u) => inPrev(u.createdAt)).length);

  // --- Betalende vs. gratis (nu) --------------------------------------------
  const tierSnapshot = { free: 0, seriousPaid: 0, familyPaid: 0, comped: 0 };
  const tierCountry = new Map<string, { free: number; paid: number; comped: number }>();
  for (const u of scoped) {
    const bucket = u.tier === "free" ? "free" : u.paid ? "paid" : "comped";
    if (u.tier === "free") tierSnapshot.free++;
    else if (!u.paid) tierSnapshot.comped++;
    else if (u.tier === "family") tierSnapshot.familyPaid++;
    else tierSnapshot.seriousPaid++;
    const row = tierCountry.get(u.region) ?? { free: 0, paid: 0, comped: 0 };
    row[bucket]++;
    tierCountry.set(u.region, row);
  }

  const cancelWhere = { status: "CANCELED" as const, ...userWhere };
  const payingWhere = { provider: { not: null }, ...userWhere };

  // --- Parallelle forespørgsler ---------------------------------------------
  const regFilter = userFilterSql(Prisma.sql`r."userId"`, ids);
  const [
    regSeriesRows,
    regTotals,
    regWeekdayRows,
    loginSeriesRows,
    loginTotals,
    loginMethodRows,
    newPayingCur,
    newPayingPrev,
    cancelCur,
    cancelPrev,
    hfTopLogged,
    hfTopSearched,
    topLogged,
    topSearchedRows,
    missRows,
    chargeRows,
    chargePrev,
    latestCharges,
    giftCur,
    giftPrev,
    freeMonthCur,
    freeMonthPrev,
    supportCur,
    supportPrev,
    supportOpen,
    supportByCategory,
    firstReplies,
    bugCur,
    bugPrev,
    bugPending,
    bugByStatus,
    activeWindows,
  ] = await Promise.all([
    prisma.$queryRaw<{ bucket: string; products: number; hellofresh: number; dishes: number; generic: number }[]>`
      SELECT ${bucketSql(Prisma.sql`r."createdAt"`, granularity)} AS bucket,
        count(*) FILTER (WHERE r."productId" IS NOT NULL AND p."externalSource" IS DISTINCT FROM 'HELLOFRESH')::int AS products,
        count(*) FILTER (WHERE p."externalSource" = 'HELLOFRESH')::int AS hellofresh,
        count(*) FILTER (WHERE r."dishId" IS NOT NULL)::int AS dishes,
        count(*) FILTER (WHERE r."genericIngredientId" IS NOT NULL)::int AS generic
      FROM registrations r LEFT JOIN products p ON p.id = r."productId"
      WHERE r."createdAt" >= ${from} AND r."createdAt" < ${to} ${regFilter}
      GROUP BY 1`,
    prisma.$queryRaw<{ period: string; total: number; users: number; hellofresh: number; hfusers: number }[]>`
      SELECT CASE WHEN r."createdAt" >= ${from} THEN 'cur' ELSE 'prev' END AS period,
        count(*)::int AS total,
        count(DISTINCT r."userId")::int AS users,
        count(*) FILTER (WHERE p."externalSource" = 'HELLOFRESH')::int AS hellofresh,
        count(DISTINCT r."userId") FILTER (WHERE p."externalSource" = 'HELLOFRESH')::int AS hfusers
      FROM registrations r LEFT JOIN products p ON p.id = r."productId"
      WHERE r."createdAt" >= ${prevFrom} AND r."createdAt" < ${to} ${regFilter}
      GROUP BY 1`,
    prisma.$queryRaw<{ period: string; dow: number; n: number }[]>`
      SELECT CASE WHEN r."createdAt" >= ${from} THEN 'cur' ELSE 'prev' END AS period,
        extract(isodow FROM r."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE ${STATS_TZ}::text)::int AS dow,
        count(*)::int AS n
      FROM registrations r
      WHERE r."createdAt" >= ${prevFrom} AND r."createdAt" < ${to} ${regFilter}
      GROUP BY 1, 2`,
    prisma.$queryRaw<{ bucket: string; n: number; users: number }[]>`
      SELECT ${bucketSql(Prisma.sql`l."createdAt"`, granularity)} AS bucket, count(*)::int AS n, count(DISTINCT l."userId")::int AS users
      FROM login_events l
      WHERE l."createdAt" >= ${from} AND l."createdAt" < ${to} ${userFilterSql(Prisma.sql`l."userId"`, ids)}
      GROUP BY 1`,
    prisma.$queryRaw<{ period: string; n: number }[]>`
      SELECT CASE WHEN l."createdAt" >= ${from} THEN 'cur' ELSE 'prev' END AS period, count(*)::int AS n
      FROM login_events l
      WHERE l."createdAt" >= ${prevFrom} AND l."createdAt" < ${to} ${userFilterSql(Prisma.sql`l."userId"`, ids)}
      GROUP BY 1`,
    prisma.loginEvent.groupBy({
      by: ["method"],
      where: { createdAt: { gte: from, lt: to }, ...userWhere },
      _count: { _all: true },
    }),
    prisma.subscription.count({ where: { ...payingWhere, createdAt: { gte: from, lt: to } } }),
    prisma.subscription.count({ where: { ...payingWhere, createdAt: { gte: prevFrom, lt: from } } }),
    prisma.subscription.count({ where: { ...cancelWhere, updatedAt: { gte: from, lt: to } } }),
    prisma.subscription.count({ where: { ...cancelWhere, updatedAt: { gte: prevFrom, lt: from } } }),
    prisma.$queryRaw<{ title: string; n: number; users: number }[]>`
      SELECT r."titleSnapshot" AS title, count(*)::int AS n, count(DISTINCT r."userId")::int AS users
      FROM registrations r JOIN products p ON p.id = r."productId"
      WHERE p."externalSource" = 'HELLOFRESH' AND r."createdAt" >= ${from} AND r."createdAt" < ${to} ${regFilter}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    prisma.$queryRaw<{ name: string; searches: number; clicks: number; users: number }[]>`
      SELECT p.name AS name, sum(h."searchCount")::int AS searches, sum(h."clickCount")::int AS clicks, count(*)::int AS users
      FROM user_product_search_history h JOIN products p ON p.id = h."productId"
      WHERE p."externalSource" = 'HELLOFRESH' AND h."lastSearchedAt" >= ${from} AND h."lastSearchedAt" < ${to}
        ${userFilterSql(Prisma.sql`h."userId"`, ids)}
      GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 10`,
    prisma.$queryRaw<{ title: string; n: number; users: number }[]>`
      SELECT r."titleSnapshot" AS title, count(*)::int AS n, count(DISTINCT r."userId")::int AS users
      FROM registrations r
      WHERE r."createdAt" >= ${from} AND r."createdAt" < ${to} ${regFilter}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    prisma.$queryRaw<{ name: string; searches: number; clicks: number; users: number }[]>`
      SELECT p.name AS name, sum(h."searchCount")::int AS searches, sum(h."clickCount")::int AS clicks, count(*)::int AS users
      FROM user_product_search_history h JOIN products p ON p.id = h."productId"
      WHERE h."lastSearchedAt" >= ${from} AND h."lastSearchedAt" < ${to} ${userFilterSql(Prisma.sql`h."userId"`, ids)}
      GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 10`,
    prisma.$queryRaw<{ query: string; n: number; total: number }[]>`
      SELECT query, count(*)::int AS n, (sum(count(*)) OVER ())::int AS total
      FROM search_misses
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        ${countries ? Prisma.sql`AND region = ANY(${countries}::text[])` : Prisma.empty}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    prisma.$queryRaw<{ bucket: string; provider: string; ore: number; n: number }[]>`
      SELECT ${bucketSql(Prisma.sql`c."dueDate"`, granularity)} AS bucket, c.provider::text AS provider,
        sum(c."amountOre")::int AS ore, count(*)::int AS n
      FROM payment_charges c
      WHERE c.status = ANY(${PAID_CHARGE_STATUSES}::text[]) AND c."dueDate" >= ${from} AND c."dueDate" < ${to}
        ${userFilterSql(Prisma.sql`c."userId"`, ids)}
      GROUP BY 1, 2`,
    prisma.paymentCharge.aggregate({
      where: { status: { in: PAID_CHARGE_STATUSES }, dueDate: { gte: prevFrom, lt: from }, ...userWhere },
      _sum: { amountOre: true },
    }),
    prisma.$queryRaw<{ userId: string; ore: number; days: number }[]>`
      SELECT DISTINCT ON (c."userId") c."userId", c."amountOre"::int AS ore,
        GREATEST(1, extract(epoch FROM (c."periodEnd" - c."periodStart")) / 86400)::float AS days
      FROM payment_charges c
      WHERE c.status = ANY(${PAID_CHARGE_STATUSES}::text[]) ${userFilterSql(Prisma.sql`c."userId"`, ids)}
      ORDER BY c."userId", c."dueDate" DESC`,
    prisma.giftCode.count({ where: { redeemedAt: { gte: from, lt: to }, ...(ids ? { redeemedById: { in: ids } } : {}) } }),
    prisma.giftCode.count({ where: { redeemedAt: { gte: prevFrom, lt: from }, ...(ids ? { redeemedById: { in: ids } } : {}) } }),
    prisma.pointsTransaction.count({ where: { reason: "FREE_MONTH_REDEEMED", createdAt: { gte: from, lt: to }, ...userWhere } }),
    prisma.pointsTransaction.count({
      where: { reason: "FREE_MONTH_REDEEMED", createdAt: { gte: prevFrom, lt: from }, ...userWhere },
    }),
    prisma.supportRequest.count({ where: { createdAt: { gte: from, lt: to }, ...userWhere } }),
    prisma.supportRequest.count({ where: { createdAt: { gte: prevFrom, lt: from }, ...userWhere } }),
    prisma.supportRequest.count({ where: { status: "OPEN", ...userWhere } }),
    prisma.supportRequest.groupBy({
      by: ["category"],
      where: { createdAt: { gte: from, lt: to }, ...userWhere },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ hours: number }[]>`
      SELECT (extract(epoch FROM (min(m."createdAt") - s."createdAt")) / 3600)::float AS hours
      FROM support_requests s JOIN support_messages m ON m."requestId" = s.id AND m.author = 'SUPPORT'
      WHERE s."createdAt" >= ${from} AND s."createdAt" < ${to} ${userFilterSql(Prisma.sql`s."userId"`, ids)}
      GROUP BY s.id, s."createdAt"`,
    prisma.bugReport.count({ where: { createdAt: { gte: from, lt: to }, source: "USER", ...userWhere } }),
    prisma.bugReport.count({ where: { createdAt: { gte: prevFrom, lt: from }, source: "USER", ...userWhere } }),
    prisma.bugReport.count({ where: { status: "PENDING", source: "USER", ...userWhere } }),
    prisma.bugReport.groupBy({
      by: ["status"],
      where: { createdAt: { gte: from, lt: to }, source: "USER", ...userWhere },
      _count: { _all: true },
    }),
    (() => {
      const end = to < now ? to : now;
      const day = 86_400_000;
      return prisma.$queryRaw<{ dau: number; wau: number; mau: number }[]>`
        SELECT count(DISTINCT r."userId") FILTER (WHERE r."createdAt" >= ${new Date(end.getTime() - day)})::int AS dau,
          count(DISTINCT r."userId") FILTER (WHERE r."createdAt" >= ${new Date(end.getTime() - 7 * day)})::int AS wau,
          count(DISTINCT r."userId")::int AS mau
        FROM registrations r
        WHERE r."createdAt" >= ${new Date(end.getTime() - 30 * day)} AND r."createdAt" < ${end} ${regFilter}`;
    })(),
  ]);

  // --- Registreringer --------------------------------------------------------
  const registrations = emptySeries(buckets, ["products", "hellofresh", "dishes", "generic"]);
  for (const row of regSeriesRows) {
    for (const series of ["products", "hellofresh", "dishes", "generic"] as const) {
      fillSeries(registrations, row.bucket, series, row[series]);
    }
  }
  const regCur = regTotals.find((r) => r.period === "cur");
  const regPrev = regTotals.find((r) => r.period === "prev");

  const weekdayCur = new Map<number, number>();
  const weekdayPrev = new Map<number, number>();
  for (const row of regWeekdayRows) (row.period === "cur" ? weekdayCur : weekdayPrev).set(row.dow, row.n);
  const sumCur = [...weekdayCur.values()].reduce((a, b) => a + b, 0);
  const sumPrev = [...weekdayPrev.values()].reduce((a, b) => a + b, 0);
  const share = (n: number, total: number) => (total ? Math.round((n / total) * 1000) / 10 : 0);
  const registrationsByWeekday: Row[] = WEEKDAYS.map((label, i) => ({
    label,
    values: [
      weekdayCur.get(i + 1) ?? 0,
      `${share(weekdayCur.get(i + 1) ?? 0, sumCur)} %`,
      `${share(weekdayPrev.get(i + 1) ?? 0, sumPrev)} %`,
    ],
  }));

  // --- Log-ins -------------------------------------------------------------
  const logins = emptySeries(buckets, ["logins", "users"]);
  for (const row of loginSeriesRows) {
    fillSeries(logins, row.bucket, "logins", row.n);
    fillSeries(logins, row.bucket, "users", row.users);
  }
  const loginTotal = kpi(
    loginTotals.find((r) => r.period === "cur")?.n ?? 0,
    loginTotals.find((r) => r.period === "prev")?.n ?? 0
  );
  const loginsByMethod: Row[] = loginMethodRows
    .map((row) => ({ label: METHOD_LABEL[row.method] ?? row.method, values: [row._count._all] }))
    .sort((a, b) => Number(b.values[0]) - Number(a.values[0]));

  // --- Omsætning -----------------------------------------------------------
  const revenueSeries = emptySeries(buckets, ["MOBILEPAY_ONLINE", "STRIPE", "OTHER"]);
  const providerTotals = new Map<string, { ore: number; n: number }>();
  let revenueCurOre = 0;
  for (const row of chargeRows) {
    const series = row.provider === "MOBILEPAY_ONLINE" || row.provider === "STRIPE" ? row.provider : "OTHER";
    fillSeries(revenueSeries, row.bucket, series, row.ore / 100);
    const total = providerTotals.get(row.provider) ?? { ore: 0, n: 0 };
    total.ore += row.ore;
    total.n += row.n;
    providerTotals.set(row.provider, total);
    revenueCurOre += row.ore;
  }
  const payingIds = new Set(scoped.filter((u) => u.paid).map((u) => u.id));
  const mrrOre = latestCharges
    .filter((c) => payingIds.has(c.userId))
    .reduce((sum, c) => sum + (c.ore / c.days) * 30.44, 0);

  // --- Fastholdelse ----------------------------------------------------------
  const cohort = scoped.filter((u) => inRange(u.createdAt));
  const day = 86_400_000;
  const retentionRows =
    cohort.length > 0
      ? await prisma.$queryRaw<{ d7: boolean; d30: boolean; created: Date }[]>`
          SELECT u."createdAt" AS created,
            EXISTS (SELECT 1 FROM registrations r WHERE r."userId" = u.id AND r."createdAt" >= u."createdAt" + interval '7 days') AS d7,
            EXISTS (SELECT 1 FROM registrations r WHERE r."userId" = u.id AND r."createdAt" >= u."createdAt" + interval '30 days') AS d30
          FROM users u WHERE u.id = ANY(${cohort.map((u) => u.id)}::text[])`
      : [];
  const eligible7 = retentionRows.filter((r) => r.created.getTime() + 7 * day <= now.getTime());
  const eligible30 = retentionRows.filter((r) => r.created.getTime() + 30 * day <= now.getTime());
  const windows = activeWindows[0] ?? { dau: 0, wau: 0, mau: 0 };
  const olderThan30 = scoped.filter((u) => u.createdAt.getTime() + 30 * day <= now.getTime()).length;

  // --- Support --------------------------------------------------------------
  const replyHours = firstReplies.map((r) => Number(r.hours)).sort((a, b) => a - b);
  const medianFirstReplyHours = replyHours.length
    ? Math.round(
        (replyHours.length % 2
          ? replyHours[(replyHours.length - 1) / 2]
          : (replyHours[replyHours.length / 2 - 1] + replyHours[replyHours.length / 2]) / 2) * 10
      ) / 10
    : null;
  const BUG_STATUS: Record<string, string> = { PENDING: "Afventer", APPROVED: "Godkendt", REJECTED: "Afvist" };

  const kpis = {
    newUsers,
    activeUsers: kpi(regCur?.users ?? 0, regPrev?.users ?? 0),
    registrations: kpi(regCur?.total ?? 0, regPrev?.total ?? 0),
    logins: loginTotal,
    hellofresh: kpi(regCur?.hellofresh ?? 0, regPrev?.hellofresh ?? 0),
    revenueDkk: kpi(Math.round(revenueCurOre / 100), Math.round((chargePrev._sum.amountOre ?? 0) / 100)),
    support: kpi(supportCur, supportPrev),
    bugs: kpi(bugCur, bugPrev),
  };

  // --- Beregnede trends ------------------------------------------------------
  const perActive = (total: number, users: number) => (users ? Math.round((total / users) * 10) / 10 : 0);
  const trendSource: { metric: string; k: Kpi; unit?: string }[] = [
    { metric: "Nye oprettelser", k: kpis.newUsers },
    { metric: "Aktive brugere (har logget mad)", k: kpis.activeUsers },
    { metric: "Loggede produkter", k: kpis.registrations },
    {
      metric: "Registreringer pr. aktiv bruger",
      k: kpi(perActive(kpis.registrations.current, kpis.activeUsers.current), perActive(kpis.registrations.previous, kpis.activeUsers.previous)),
    },
    { metric: "Log-ins", k: kpis.logins },
    { metric: "HelloFresh-retter logget", k: kpis.hellofresh },
    { metric: "Nye betalende abonnementer", k: kpi(newPayingCur, newPayingPrev) },
    { metric: "Opsigelser", k: kpi(cancelCur, cancelPrev) },
    { metric: "Omsætning", k: kpis.revenueDkk, unit: "kr." },
    { metric: "Supporthenvendelser", k: kpis.support },
    { metric: "Fejlrapporter", k: kpis.bugs },
  ];
  const trends: TrendItem[] = trendSource
    .map(({ metric, k, unit }) => ({ metric, current: k.current, previous: k.previous, pct: pctChange(k.current, k.previous), unit }))
    .sort((a, b) => Math.abs(b.pct ?? 1000) - Math.abs(a.pct ?? 1000));

  const byCount = (map: Map<string, number>) =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ label: countryLabel(code), values: [n] }));

  return {
    range: { label: range.label, fromDay: range.fromDay, toDay: range.toDay, granularity },
    scopeUserCount: scoped.length,
    kpis,
    signups,
    signupsByCountry: byCount(signupCountry),
    tierSnapshot,
    tierByCountry: [...tierCountry.entries()]
      .sort((a, b) => b[1].free + b[1].paid + b[1].comped - (a[1].free + a[1].paid + a[1].comped))
      .map(([code, r]) => {
        const total = r.free + r.paid + r.comped;
        return { label: countryLabel(code), values: [total, r.paid, r.comped, r.free, `${share(r.paid, total)} %`] };
      }),
    newPaying: kpi(newPayingCur, newPayingPrev),
    cancellations: kpi(cancelCur, cancelPrev),
    logins,
    loginsByMethod,
    registrations,
    registrationsByWeekday,
    trends,
    hellofresh: {
      users: kpi(regCur?.hfusers ?? 0, regPrev?.hfusers ?? 0),
      topLogged: hfTopLogged.map((r) => ({ label: r.title, values: [r.n, r.users] })),
      topSearched: hfTopSearched.map((r) => ({ label: r.name, values: [r.searches, r.clicks, r.users] })),
    },
    retention: {
      dau: windows.dau,
      wau: windows.wau,
      mau: windows.mau,
      cohortSize: cohort.length,
      day7: { eligible: eligible7.length, retained: eligible7.filter((r) => r.d7).length },
      day30: { eligible: eligible30.length, retained: eligible30.filter((r) => r.d30).length },
      inactive30: Math.max(0, olderThan30 - windows.mau),
    },
    revenue: {
      series: revenueSeries,
      byProvider: [...providerTotals.entries()].map(([provider, t]) => ({
        label: provider === "MOBILEPAY_ONLINE" ? "MobilePay" : provider === "STRIPE" ? "Kort (Stripe)" : provider,
        values: [t.n, Math.round(t.ore / 100)],
      })),
      mrrDkk: Math.round(mrrOre / 100),
      payingNow: payingIds.size,
      giftCodesRedeemed: kpi(giftCur, giftPrev),
      freeMonthsRedeemed: kpi(freeMonthCur, freeMonthPrev),
    },
    top: {
      logged: topLogged.map((r) => ({ label: r.title, values: [r.n, r.users] })),
      searched: topSearchedRows.map((r) => ({ label: r.name, values: [r.searches, r.clicks, r.users] })),
      misses: missRows.map((r) => ({ label: r.query, values: [r.n] })),
      missTotal: missRows[0]?.total ?? 0,
    },
    support: {
      openNow: supportOpen,
      medianFirstReplyHours,
      byCategory: supportByCategory
        .map((r) => ({ label: SUPPORT_CATEGORY_LABELS[r.category] ?? r.category, values: [r._count._all] }))
        .sort((a, b) => Number(b.values[0]) - Number(a.values[0])),
      bugsPending: bugPending,
      bugsByStatus: bugByStatus.map((r) => ({ label: BUG_STATUS[r.status] ?? r.status, values: [r._count._all] })),
    },
  };
}
