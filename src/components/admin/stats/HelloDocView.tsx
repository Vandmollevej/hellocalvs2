import Link from "next/link";
import { AD_STATS_RANGES, type AdStatsRange } from "@/lib/admin-ad-stats";
import { loadHelloDocAnalytics } from "@/lib/hello-doc-analytics";
import { StatsBarChart } from "@/components/admin/stats/StatsBarChart";

const number = new Intl.NumberFormat("da-DK");

const CATEGORY_LABELS: Record<string, string> = {
  profile: "Profil",
  weight: "Vægt",
  goals: "Målsætning",
  menstrualCycle: "Menstruationscyklus",
  digestion: "Fordøjelse",
  sleep: "Søvn",
  foodAndCalories: "Mad og kalorier",
  vitaminsMinerals: "Vitaminer og mineraler",
  fluid: "Væske",
};
const RANGE_LABELS: Record<string, string> = {
  LAST_7_DAYS: "Seneste 7 dage",
  LAST_MONTH: "Seneste måned",
  LAST_YEAR: "Seneste år",
  ALL: "Al historik",
};
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Afventer",
  ACTIVE: "Aktiv",
  EXPIRED: "Udløbet",
  REVOKED: "Tilbagekaldt",
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="hf-panel">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className="hf-type-hero mt-1 text-hf-black">{value}</p>
    </div>
  );
}

function BarList({ title, unitLabel, rows }: { title: string; unitLabel: string; rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="flex flex-col hf-surface">
      <header className="flex items-center justify-between border-b border-hf-tan-dark px-4 py-3">
        <h2 className="hf-type-body hf-type-strong text-hf-black">{title}</h2>
        <span className="hf-type-small text-text-muted">{unitLabel}</span>
      </header>
      {rows.length === 0 ? (
        <p className="hf-type-body px-4 py-8 text-center text-text-muted">Ingen data i perioden.</p>
      ) : (
        <ul className="flex flex-col gap-1 p-2">
          {rows.map((row) => (
            <li key={row.label} className="hf-type-body relative overflow-hidden rounded-md px-2 py-1.5">
              <span className="absolute inset-y-0 left-0 bg-hf-tan" style={{ width: `${(row.count / max) * 100}%` }} aria-hidden="true" />
              <span className="relative flex items-center justify-between gap-3">
                <span className="truncate text-hf-black">{row.label}</span>
                <span className="shrink-0 tabular-nums text-text-secondary">{number.format(row.count)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export async function HelloDocView({ range }: { range: AdStatsRange }) {
  const days = AD_STATS_RANGES.find((r) => r.id === range)?.days ?? 7;
  const data = await loadHelloDocAnalytics(days * 86400_000);
  const label = (map: Record<string, string>) => (i: { key: string; count: number }) => ({
    label: map[i.key] ?? i.key,
    count: i.count,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hf-type-body text-text-secondary">
          Brug af Hello Doc (deling med læge/behandler) fra databasen. Åbninger af lægelinket logges ikke.
        </p>
        <nav className="hf-type-body flex hf-surface p-0.5" aria-label="Periode">
          {AD_STATS_RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/admin/statistics?view=doc&range=${r.id}`}
              className={`rounded-md px-3 py-1.5 ${
                r.id === range ? "hf-type-strong bg-hf-tan text-hf-green-dark" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Tile label="Invitationer sendt" value={number.format(data.totals.created)} />
        <Tile label="Accepteret" value={number.format(data.totals.accepted)} />
        <Tile label="Accept-rate" value={data.acceptanceRate === null ? "–" : `${data.acceptanceRate} %`} />
        <Tile label="Brugere der deler" value={number.format(data.totals.sharers)} />
        <Tile label="Aktive delinger nu" value={number.format(data.totals.activeNow)} />
      </div>
      <div className="hf-panel">
        <h2 className="hf-type-body hf-type-strong mb-3 text-hf-black">Invitationer pr. dag</h2>
        <StatsBarChart
          points={data.series.map((b) => ({ key: b.key, label: b.label, values: { created: b.created, accepted: b.accepted } }))}
          series={[
            { key: "created", label: "Sendt", color: "var(--hf-color-brand)" },
            { key: "accepted", label: "Accepteret", color: "var(--hf-color-watch)" },
          ]}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <BarList
          title="Delte kategorier"
          unitLabel="Invitationer"
          rows={data.categories.map((c) => ({ label: CATEGORY_LABELS[c.key] ?? c.key, count: c.count }))}
        />
        <BarList title="Historik-periode" unitLabel="Invitationer" rows={data.historyRanges.map(label(RANGE_LABELS))} />
        <BarList title="Status i alt" unitLabel="Delinger" rows={data.statuses.map(label(STATUS_LABELS))} />
      </div>
    </div>
  );
}
