import Link from "next/link";
import {
  ANALYTICS_RANGES,
  loadAnalyticsOverview,
  UmamiError,
  type AnalyticsOverview,
  type AnalyticsRange,
  type MetricRow,
  type SeriesPoint,
} from "@/lib/umami";

// Admin "Analyse" (docs/DECISIONS.md 2026-09-27 "Umami-analyse"): besøgs-
// statistik for den brugerrettede app fra den selv-hostede Umami. Tallene
// hentes server-side via Umamis API; Umami selv er ikke udstillet.

const TIME_ZONE = "Europe/Copenhagen";
const number = new Intl.NumberFormat("da-DK");

// invert: for afvisningsrate er et fald godt. unit: "%" for procentvis
// ændring, "point" for procentpoint.
function StatCard({
  label,
  value,
  change,
  invert = false,
  unit = "%",
}: {
  label: string;
  value: string;
  change: number | null;
  invert?: boolean;
  unit?: "%" | "point";
}) {
  const good = change !== null && (invert ? change < 0 : change > 0);
  return (
    <div className="flex flex-col hf-surface p-4">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className="hf-type-hero mt-1 text-hf-black">{value}</p>
      <p
        className={`hf-type-small mt-auto pt-2 ${
          change === null || change === 0 ? "text-text-muted" : good ? "text-hf-green-dark" : "text-hf-red-dark"
        }`}
      >
        {change === null ? "Ingen sammenligning" : `${change > 0 ? "+" : ""}${change} ${unit === "%" ? "%" : "procentpoint"} mod forrige periode`}
      </p>
    </div>
  );
}

function percentChange(now: number, before: number | undefined) {
  if (before === undefined || before === 0) return null;
  return Math.round(((now - before) / before) * 100);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0 s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

// Umami giver kun tidspunkter med data; tomme timer/dage fyldes med 0, så
// grafen viser hele perioden. Nøglen er dato (og time) i dansk tid.
function bucketKey(date: Date, unit: "hour" | "day") {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return unit === "day" ? day : `${day} ${parts.hour}`;
}

function pointKey(x: string, unit: "hour" | "day") {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2})/.exec(x) ?? /^(\d{4}-\d{2}-\d{2})/.exec(x);
  if (!match) return x;
  return unit === "day" ? match[1] : `${match[1]} ${match[2] ?? "00"}`;
}

function buildBuckets(overview: AnalyticsOverview) {
  const { unit, startAt, endAt, series } = overview;
  const step = unit === "hour" ? 3600_000 : 86400_000;
  const keys: string[] = [];
  for (let t = startAt; t <= endAt; t += step) {
    const key = bucketKey(new Date(t), unit);
    if (!keys.includes(key)) keys.push(key);
  }
  const lastKey = bucketKey(new Date(endAt), unit);
  if (!keys.includes(lastKey)) keys.push(lastKey);

  const sum = (points: SeriesPoint[]) => {
    const map = new Map<string, number>();
    for (const p of points) map.set(pointKey(p.x, unit), (map.get(pointKey(p.x, unit)) ?? 0) + Number(p.y));
    return map;
  };
  const views = sum(series.pageviews);
  const visitors = sum(series.sessions);
  return keys.map((key) => ({
    key,
    label: unit === "hour" ? key.slice(11, 13) : `${Number(key.slice(8, 10))}/${Number(key.slice(5, 7))}`,
    views: views.get(key) ?? 0,
    visitors: visitors.get(key) ?? 0,
  }));
}

function TrafficChart({ overview }: { overview: AnalyticsOverview }) {
  const buckets = buildBuckets(overview);
  const max = Math.max(1, ...buckets.map((b) => b.views));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 12));

  return (
    <section className="hf-surface p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="hf-type-body hf-type-strong text-hf-black">Trafik</h2>
        <div className="hf-type-small flex gap-4 text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-hf-green-light" /> Sidevisninger
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-hf-green-dark" /> Besøgende
          </span>
        </div>
      </header>
      <div className="flex h-48 items-end gap-px">
        {buckets.map((b) => (
          <div
            key={b.key}
            className="relative flex h-full flex-1 items-end"
            title={`${b.label}: ${number.format(b.views)} sidevisninger, ${number.format(b.visitors)} besøgende`}
          >
            <div className="w-full rounded-t-sm bg-hf-green-light" style={{ height: `${(b.views / max) * 100}%` }} />
            <div
              className="absolute bottom-0 left-1/4 w-1/2 rounded-t-sm bg-hf-green-dark"
              style={{ height: `${(b.visitors / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="hf-type-micro mt-1 flex gap-px text-text-muted">
        {buckets.map((b, i) => (
          <span key={b.key} className="flex-1 overflow-visible whitespace-nowrap text-center">
            {i % labelEvery === 0 ? b.label : ""}
          </span>
        ))}
      </div>
    </section>
  );
}

const countryNames = new Intl.DisplayNames(["da"], { type: "region" });
const DEVICE_LABELS: Record<string, string> = { mobile: "Mobil", desktop: "Computer", tablet: "Tablet", laptop: "Bærbar" };

function label(kind: string, value: string | null) {
  if (!value) return kind === "referrer" ? "Direkte / ukendt" : "Ukendt";
  if (kind === "country") {
    try {
      return countryNames.of(value.toUpperCase()) ?? value;
    } catch {
      return value;
    }
  }
  if (kind === "device") return DEVICE_LABELS[value] ?? value;
  return value;
}

function MetricList({
  title,
  kind,
  rows,
  unitLabel,
  className = "",
}: {
  title: string;
  kind: string;
  rows: MetricRow[];
  unitLabel: string;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r.y)));
  return (
    <section className={`flex flex-col hf-surface ${className}`}>
      <header className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
        <h2 className="hf-type-body hf-type-strong text-hf-black">{title}</h2>
        <span className="hf-type-small text-text-muted">{unitLabel}</span>
      </header>
      {rows.length === 0 ? (
        <p className="hf-type-body px-4 py-8 text-center text-text-muted">Ingen data i perioden.</p>
      ) : (
        <ul className="flex flex-col gap-1 p-2">
          {rows.map((row, i) => (
            <li key={`${row.x ?? "none"}-${i}`} className="hf-type-body relative overflow-hidden rounded-md px-2 py-1.5">
              <span
                className="absolute inset-y-0 left-0 bg-hf-tan"
                style={{ width: `${(Number(row.y) / max) * 100}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-3">
                <span className="truncate text-hf-black">{label(kind, row.x)}</span>
                <span className="shrink-0 tabular-nums text-text-secondary">{number.format(Number(row.y))}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Unavailable({ error }: { error: unknown }) {
  const kind = error instanceof UmamiError ? error.kind : "api";
  const text =
    kind === "unreachable"
      ? "Umami-containeren svarer ikke. Den startes af deployet (tjenesten \"umami\" i compose.production.yaml); første start tager et par minutter."
      : kind === "auth"
        ? "Appen kan ikke logge ind i Umami. Har du skiftet Umamis admin-kode, skal den nye kode sættes som UMAMI_PASSWORD i .env.production."
        : "Umami svarede med en fejl. Prøv igen om lidt.";
  return (
    <div className="hf-type-body hf-surface p-4 text-text-secondary">
      <p className="hf-type-strong text-hf-black">Analysen er ikke tilgængelig lige nu</p>
      <p className="mt-1">{text}</p>
      {error instanceof Error && <p className="hf-type-small mt-2 text-text-muted">{error.message}</p>}
    </div>
  );
}

export function parseAnalyticsRange(requested: string | string[] | undefined): AnalyticsRange {
  return ANALYTICS_RANGES.some((r) => r.id === requested) ? (requested as AnalyticsRange) : "7d";
}

export async function AnalyticsView({ range }: { range: AnalyticsRange }) {

  let overview: AnalyticsOverview | null = null;
  let error: unknown = null;
  try {
    overview = await loadAnalyticsOverview(range);
  } catch (caught) {
    error = caught;
  }

  const stats = overview?.stats;
  const prev = overview?.previous ?? undefined;
  const bounceRate = stats && stats.visits > 0 ? Math.round((stats.bounces / stats.visits) * 100) : 0;
  const prevBounceRate = prev && prev.visits > 0 ? Math.round((prev.bounces / prev.visits) * 100) : undefined;
  const avgTime = stats && stats.visits > 0 ? stats.totaltime / stats.visits : 0;
  const prevAvgTime = prev && prev.visits > 0 ? prev.totaltime / prev.visits : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="hf-type-title text-hf-black">Trafik</h1>
          <p className="hf-type-body text-text-secondary">
            Cookiefri besøgsstatistik for hellocal.io (Umami, kører på egen server).
          </p>
        </div>
        <nav className="hf-type-body flex hf-surface p-0.5" aria-label="Periode">
          {ANALYTICS_RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/admin/statistics?view=traffic&range=${r.id}`}
              className={`rounded-md px-3 py-1.5 ${
                r.id === range ? "hf-type-strong bg-hf-tan text-hf-green-dark" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      {!overview || !stats ? (
        <Unavailable error={error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard
              label="Besøgende"
              value={number.format(stats.visitors)}
              change={percentChange(stats.visitors, prev?.visitors)}
            />
            <StatCard label="Besøg" value={number.format(stats.visits)} change={percentChange(stats.visits, prev?.visits)} />
            <StatCard
              label="Sidevisninger"
              value={number.format(stats.pageviews)}
              change={percentChange(stats.pageviews, prev?.pageviews)}
            />
            <StatCard
              label="Afvisningsrate"
              value={`${bounceRate} %`}
              change={prevBounceRate === undefined ? null : bounceRate - prevBounceRate}
              invert
              unit="point"
            />
            <StatCard label="Gns. besøgstid" value={formatDuration(avgTime)} change={percentChange(avgTime, prevAvgTime)} />
          </div>

          <TrafficChart overview={overview} />

          <div className="grid gap-4 lg:grid-cols-3">
            <MetricList title="Sider" kind="path" rows={overview.pages} unitLabel="Besøgende" className="lg:col-span-2" />
            <MetricList title="Henvisninger" kind="referrer" rows={overview.referrers} unitLabel="Besøgende" />
            <MetricList title="Lande" kind="country" rows={overview.countries} unitLabel="Besøgende" />
            <MetricList title="Enheder" kind="device" rows={overview.devices} unitLabel="Besøgende" />
            <MetricList title="Browsere" kind="browser" rows={overview.browsers} unitLabel="Besøgende" />
            <MetricList title="Styresystemer" kind="os" rows={overview.os} unitLabel="Besøgende" />
          </div>
        </>
      )}
    </div>
  );
}
