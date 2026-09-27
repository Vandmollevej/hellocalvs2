// Server-side forbindelse til den selv-hostede Umami (docs/DECISIONS.md
// 2026-09-27 "Umami-analyse"). Umami kører som container på det interne
// Compose-netværk og er ikke udstillet; appen logger ind med Umamis
// admin-bruger og henter tallene via Umamis API (v3).
import { UMAMI_WEBSITE_DOMAIN, UMAMI_WEBSITE_ID, UMAMI_WEBSITE_NAME } from "@/lib/umami-config";

const TIMEOUT_MS = 5000;

export function umamiBaseUrl() {
  return (process.env.UMAMI_URL || "http://umami:3000").replace(/\/$/, "");
}

// Umami opretter brugeren admin/umami ved første start. Containeren kan
// ikke nås udefra, så standardkoden er kun synlig internt; den kan skiftes
// i Umami og sættes i UMAMI_PASSWORD (docs/DEPLOYMENT.md "Umami").
function credentials() {
  return {
    username: process.env.UMAMI_USERNAME || "admin",
    password: process.env.UMAMI_PASSWORD || "umami",
  };
}

export class UmamiError extends Error {
  constructor(
    readonly kind: "unreachable" | "auth" | "api",
    message: string,
  ) {
    super(message);
  }
}

let token: string | null = null;

async function rawFetch(path: string, init: RequestInit = {}) {
  try {
    return await fetch(`${umamiBaseUrl()}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new UmamiError("unreachable", error instanceof Error ? error.message : String(error));
  }
}

async function login() {
  const res = await rawFetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials()),
  });
  if (!res.ok) throw new UmamiError("auth", `Umami-login fejlede (${res.status})`);
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new UmamiError("auth", "Umami-login gav intet token");
  token = body.token;
  return token;
}

async function apiFetch(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const current = token ?? (await login());
  const res = await rawFetch(path, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${current}`, "content-type": "application/json" },
  });
  if (res.status === 401 && !retried) {
    token = null;
    return apiFetch(path, init, true);
  }
  return res;
}

async function apiJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new UmamiError("api", `Umami ${path.split("?")[0]} svarede ${res.status}`);
  return (await res.json()) as T;
}

let websiteReady: Promise<void> | null = null;

// Opretter Hello Cal-websitet i Umami med det faste id, første gang det
// behøves. Et mislykket forsøg glemmes, så næste kald prøver igen.
export function ensureUmamiWebsite() {
  if (!websiteReady) {
    websiteReady = (async () => {
      const existing = await apiFetch(`/api/websites/${UMAMI_WEBSITE_ID}`);
      if (existing.ok) return;
      const created = await apiFetch("/api/websites", {
        method: "POST",
        body: JSON.stringify({ id: UMAMI_WEBSITE_ID, name: UMAMI_WEBSITE_NAME, domain: UMAMI_WEBSITE_DOMAIN }),
      });
      if (!created.ok) throw new UmamiError("api", `Kunne ikke oprette website i Umami (${created.status})`);
    })().catch((error) => {
      websiteReady = null;
      throw error;
    });
  }
  return websiteReady;
}

export type AnalyticsRange = "24h" | "7d" | "30d" | "90d";

export const ANALYTICS_RANGES: { id: AnalyticsRange; label: string; ms: number }[] = [
  { id: "24h", label: "24 timer", ms: 24 * 3600_000 },
  { id: "7d", label: "7 dage", ms: 7 * 86400_000 },
  { id: "30d", label: "30 dage", ms: 30 * 86400_000 },
  { id: "90d", label: "90 dage", ms: 90 * 86400_000 },
];

type Stats = { pageviews: number; visitors: number; visits: number; bounces: number; totaltime: number };
export type MetricRow = { x: string | null; y: number };
export type SeriesPoint = { x: string; y: number };

export type AnalyticsOverview = {
  stats: Stats;
  previous: Stats | null;
  series: { pageviews: SeriesPoint[]; sessions: SeriesPoint[] };
  unit: "hour" | "day";
  startAt: number;
  endAt: number;
  pages: MetricRow[];
  referrers: MetricRow[];
  countries: MetricRow[];
  browsers: MetricRow[];
  os: MetricRow[];
  devices: MetricRow[];
};

export async function loadAnalyticsOverview(range: AnalyticsRange): Promise<AnalyticsOverview> {
  await ensureUmamiWebsite();

  const span = ANALYTICS_RANGES.find((r) => r.id === range)?.ms ?? ANALYTICS_RANGES[1].ms;
  const endAt = Date.now();
  const startAt = endAt - span;
  const unit = range === "24h" ? "hour" : "day";
  const base = `/api/websites/${UMAMI_WEBSITE_ID}`;
  const period = `startAt=${startAt}&endAt=${endAt}`;
  const metric = (type: string, limit = 10) =>
    apiJson<MetricRow[]>(`${base}/metrics?${period}&type=${type}&limit=${limit}`);

  const [stats, series, pages, referrers, countries, browsers, os, devices] = await Promise.all([
    apiJson<Stats & { comparison?: Stats }>(`${base}/stats?${period}`),
    apiJson<{ pageviews: SeriesPoint[]; sessions: SeriesPoint[] }>(
      `${base}/pageviews?${period}&unit=${unit}&timezone=Europe%2FCopenhagen`,
    ),
    metric("path", 15),
    metric("referrer"),
    metric("country"),
    metric("browser", 6),
    metric("os", 6),
    metric("device", 6),
  ]);

  const { comparison, ...current } = stats;
  return {
    stats: current,
    previous: comparison ?? null,
    series: { pageviews: series.pageviews ?? [], sessions: series.sessions ?? [] },
    unit,
    startAt,
    endAt,
    pages,
    referrers,
    countries,
    browsers,
    os,
    devices,
  };
}
