import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Admin → Analyse → Søgning (docs/DECISIONS.md 2026-10-10). Læser
// search_events/search_query_reviews; siden viser kun.

export const SEARCH_TABS = [
  { id: "all", label: "Alle søgninger" },
  { id: "refined", label: "Raffinerede søgninger" },
  { id: "misses", label: "Uden resultat" },
] as const;
export type SearchTab = (typeof SEARCH_TABS)[number]["id"];

export const SEARCH_SORTS = [
  { id: "count", label: "Flest søgninger" },
  { id: "recent", label: "Senest søgt" },
  { id: "misses", label: "Flest uden resultat" },
  { id: "query", label: "Alfabetisk" },
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number]["id"];

// "Rene fejl" = vurderet som manglende vare/mærke; stavefejl og meningsløse
// søgninger er sorteret fra (src/lib/search-miss-review.ts).
export const MISS_FILTERS = [
  { id: "clean", label: "Kun rene fejl" },
  { id: "unreviewed", label: "Ikke vurderet endnu" },
  { id: "typo", label: "Stavefejl" },
  { id: "nonsense", label: "Meningsløse" },
  { id: "all", label: "Alle" },
] as const;
export type MissFilter = (typeof MISS_FILTERS)[number]["id"];

export const MISS_KIND_LABELS: Record<string, string> = {
  MISSING: "Mangler i databasen",
  TYPO: "Stavefejl",
  NONSENSE: "Meningsløs",
};

const pick = <T extends string>(value: string | string[] | undefined, allowed: readonly { id: T }[], fallback: T): T => {
  const v = Array.isArray(value) ? value[0] : value;
  return allowed.some((a) => a.id === v) ? (v as T) : fallback;
};

export function parseSearchView(params: Record<string, string | string[] | undefined>) {
  return {
    tab: pick(params.tab, SEARCH_TABS, "all"),
    sort: pick(params.sort, SEARCH_SORTS, "count"),
    miss: pick(params.miss, MISS_FILTERS, "clean"),
  };
}

type Filter = { from: Date; to: Date; countries: string[] | null };

function scope({ from, to, countries }: Filter, alias = "e") {
  const col = (name: string) => Prisma.raw(`${alias}."${name}"`);
  return Prisma.sql`${col("createdAt")} >= ${from} AND ${col("createdAt")} < ${to}${
    countries ? Prisma.sql` AND ${col("region")} IN (${Prisma.join(countries)})` : Prisma.empty
  }`;
}

const LIMIT = 300;

export type SearchKpis = {
  searches: number;
  uniqueQueries: number;
  misses: number;
  refined: number;
  clicked: number;
  fallback: number;
};

export async function loadSearchKpis(filter: Filter): Promise<SearchKpis> {
  const [row] = await prisma.$queryRaw<Array<Record<keyof SearchKpis, bigint>>>`
    SELECT count(*) AS searches,
           count(DISTINCT e."normalizedQuery") AS "uniqueQueries",
           count(*) FILTER (WHERE e."fullMatchCount" = 0) AS misses,
           count(*) FILTER (WHERE EXISTS (SELECT 1 FROM "search_events" r WHERE r."refinedFromId" = e."id")) AS refined,
           count(*) FILTER (WHERE e."clickedAt" IS NOT NULL) AS clicked,
           count(*) FILTER (WHERE e."engine" = 'postgres') AS fallback
    FROM "search_events" e WHERE ${scope(filter)}`;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])) as SearchKpis;
}

export async function loadSearchCountries(filter: Filter) {
  const rows = await prisma.$queryRaw<Array<{ region: string; searches: bigint; misses: bigint }>>`
    SELECT e."region", count(*) AS searches, count(*) FILTER (WHERE e."fullMatchCount" = 0) AS misses
    FROM "search_events" e WHERE ${scope(filter)}
    GROUP BY e."region" ORDER BY searches DESC`;
  return rows.map((r) => ({ region: r.region, searches: Number(r.searches), misses: Number(r.misses) }));
}

export type QueryRow = {
  query: string;
  searches: number;
  misses: number;
  clicks: number;
  avgResults: number;
  countries: string[];
  lastAt: Date;
};

const ORDER: Record<SearchSort, Prisma.Sql> = {
  count: Prisma.sql`searches DESC, "lastAt" DESC`,
  recent: Prisma.sql`"lastAt" DESC`,
  misses: Prisma.sql`misses DESC, searches DESC`,
  query: Prisma.sql`query ASC`,
};

export async function loadAllSearches(filter: Filter, sort: SearchSort): Promise<QueryRow[]> {
  const rows = await prisma.$queryRaw<
    Array<{ query: string; searches: bigint; misses: bigint; clicks: bigint; avgResults: number; countries: string[]; lastAt: Date }>
  >`
    SELECT e."normalizedQuery" AS query, count(*) AS searches,
           count(*) FILTER (WHERE e."fullMatchCount" = 0) AS misses,
           count(*) FILTER (WHERE e."clickedAt" IS NOT NULL) AS clicks,
           avg(e."resultCount")::float AS "avgResults",
           array_agg(DISTINCT e."region") AS countries,
           max(e."createdAt") AS "lastAt"
    FROM "search_events" e WHERE ${scope(filter)}
    GROUP BY e."normalizedQuery"
    ORDER BY ${ORDER[sort]}
    LIMIT ${LIMIT}`;
  return rows.map((r) => ({ ...r, searches: Number(r.searches), misses: Number(r.misses), clicks: Number(r.clicks) }));
}

export type RefinementRow = {
  fromQuery: string;
  toQuery: string;
  times: number;
  fromMisses: number;
  foundAfter: number;
  lastAt: Date;
};

// Brugeren søgte på A, klikkede ikke, og søgte kort efter på B.
// foundAfter = antal gange B (eller en senere raffinering) endte med et klik.
export async function loadRefinements(filter: Filter, sort: SearchSort): Promise<RefinementRow[]> {
  const order =
    sort === "recent" ? Prisma.sql`"lastAt" DESC` : sort === "misses" ? Prisma.sql`"fromMisses" DESC, times DESC` : sort === "query" ? Prisma.sql`"fromQuery" ASC` : Prisma.sql`times DESC, "lastAt" DESC`;
  const rows = await prisma.$queryRaw<
    Array<{ fromQuery: string; toQuery: string; times: bigint; fromMisses: bigint; foundAfter: bigint; lastAt: Date }>
  >`
    SELECT f."normalizedQuery" AS "fromQuery", e."normalizedQuery" AS "toQuery", count(*) AS times,
           count(*) FILTER (WHERE f."fullMatchCount" = 0) AS "fromMisses",
           count(*) FILTER (WHERE e."clickedAt" IS NOT NULL OR EXISTS (
             SELECT 1 FROM "search_events" n WHERE n."refinedFromId" = e."id" AND n."clickedAt" IS NOT NULL)) AS "foundAfter",
           max(e."createdAt") AS "lastAt"
    FROM "search_events" e JOIN "search_events" f ON f."id" = e."refinedFromId"
    WHERE ${scope(filter)}
    GROUP BY f."normalizedQuery", e."normalizedQuery"
    ORDER BY ${order}
    LIMIT ${LIMIT}`;
  return rows.map((r) => ({ ...r, times: Number(r.times), fromMisses: Number(r.fromMisses), foundAfter: Number(r.foundAfter) }));
}

export type MissRow = {
  query: string;
  searches: number;
  countries: string[];
  lastAt: Date;
  kind: string | null;
  suggestion: string | null;
  // Det brugerne oftest søgte på bagefter.
  refinedTo: string | null;
};

const MISS_WHERE: Record<MissFilter, Prisma.Sql> = {
  clean: Prisma.sql`r."kind" = 'MISSING'`,
  unreviewed: Prisma.sql`r."kind" IS NULL`,
  typo: Prisma.sql`r."kind" = 'TYPO'`,
  nonsense: Prisma.sql`r."kind" = 'NONSENSE'`,
  all: Prisma.sql`TRUE`,
};

export async function loadMisses(filter: Filter, sort: SearchSort, miss: MissFilter): Promise<MissRow[]> {
  const order = sort === "recent" ? Prisma.sql`"lastAt" DESC` : sort === "query" ? Prisma.sql`query ASC` : Prisma.sql`searches DESC, "lastAt" DESC`;
  const rows = await prisma.$queryRaw<
    Array<{ query: string; searches: bigint; countries: string[]; lastAt: Date; kind: string | null; suggestion: string | null; refinedTo: string | null }>
  >`
    SELECT m.query, m.searches, m.countries, m."lastAt", r."kind", r."suggestion",
           (SELECT n."normalizedQuery" FROM "search_events" n JOIN "search_events" o ON o."id" = n."refinedFromId"
             WHERE o."normalizedQuery" = m.query GROUP BY n."normalizedQuery" ORDER BY count(*) DESC LIMIT 1) AS "refinedTo"
    FROM (
      SELECT e."normalizedQuery" AS query, count(*) AS searches, array_agg(DISTINCT e."region") AS countries, max(e."createdAt") AS "lastAt"
      FROM "search_events" e WHERE e."fullMatchCount" = 0 AND ${scope(filter)}
      GROUP BY e."normalizedQuery"
    ) m
    LEFT JOIN "search_query_reviews" r ON r."normalizedQuery" = m.query
    WHERE ${MISS_WHERE[miss]}
    ORDER BY ${order}
    LIMIT ${LIMIT}`;
  return rows.map((r) => ({ ...r, searches: Number(r.searches) }));
}

export async function earliestSearchEvent(): Promise<Date> {
  const first = await prisma.searchEvent.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  return first?.createdAt ?? new Date();
}
