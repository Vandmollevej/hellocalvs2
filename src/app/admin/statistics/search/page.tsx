import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { countryLabel, parseStatsFilter, regionFilterCountries, resolveStatsRange } from "@/lib/admin-stats-range";
import {
  MISS_FILTERS,
  MISS_KIND_LABELS,
  SEARCH_SORTS,
  SEARCH_TABS,
  earliestSearchEvent,
  loadAllSearches,
  loadMisses,
  loadRefinements,
  loadSearchCountries,
  loadSearchKpis,
  parseSearchView,
} from "@/lib/admin-search-analytics";
import { StatsFilters } from "@/components/admin/stats/StatsFilters";
import { ReviewMissesButton } from "@/components/admin/stats/ReviewMissesButton";

// Admin → Analyse → Søgning (docs/DECISIONS.md 2026-10-10): alle søgninger med
// land og periode, raffinerede søgninger (søgte videre uden at klikke) og
// søgninger uden resultat, hvor stavefejl og meningsløse søgninger kan
// filtreres fra, så kun rene fejl står tilbage. Tal fra src/lib/admin-search-analytics.ts.

export const dynamic = "force-dynamic";

const num = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });
const when = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Copenhagen" });

function pct(part: number, total: number) {
  return total ? `${num.format((part / total) * 100)} %` : "–";
}

const btn = (active: boolean) => `${active ? "hf-btn-primary" : "hf-btn-secondary"} h-10 px-3 !text-sm`;

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="hf-kpi">
      <p className="hf-type-caption">{label}</p>
      <p className="hf-type-page-title text-text-primary">{typeof value === "number" ? num.format(value) : value}</p>
      {hint && <p className="hf-type-small text-text-muted">{hint}</p>}
    </div>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: Array<Array<React.ReactNode>>; empty: string }) {
  return (
    <div className="hf-surface hf-table-scroll">
      <table className="hf-type-body w-full">
        <thead>
          <tr className="border-b border-border-strong text-left">
            {head.map((h, i) => (
              <th key={h} className={`hf-type-caption px-3 py-2 ${i > 0 ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-3 py-3 text-text-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border-strong last:border-0">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-2 text-text-primary ${i > 0 ? "text-right tabular-nums" : ""}`}>
                  {typeof cell === "number" ? num.format(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const countries = (codes: string[]) => codes.map(countryLabel).join(", ");

export default async function SearchAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const filter = parseStatsFilter(params);
  const view = parseSearchView(params);
  const range = resolveStatsRange(filter, new Date(), await earliestSearchEvent());
  const scope = { from: range.from, to: range.to, countries: regionFilterCountries(filter.region) };

  const href = (next: Record<string, string>) => {
    const out = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const v = Array.isArray(value) ? value[0] : value;
      if (v) out.set(key, v);
    }
    for (const [key, value] of Object.entries(next)) out.set(key, value);
    return `/admin/statistics/search?${out.toString()}`;
  };

  const [kpis, byCountry, rows] = await Promise.all([
    loadSearchKpis(scope),
    loadSearchCountries(scope),
    view.tab === "refined"
      ? loadRefinements(scope, view.sort).then((list) => ({ kind: "refined" as const, list }))
      : view.tab === "misses"
        ? loadMisses(scope, view.sort, view.miss).then((list) => ({ kind: "misses" as const, list }))
        : loadAllSearches(scope, view.sort).then((list) => ({ kind: "all" as const, list })),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1>Søgning</h1>
        <p className="hf-type-body text-text-secondary">
          Alle søgninger i appen ({range.label.toLowerCase()}). Indtastning bogstav for bogstav tæller som én søgning. En
          raffinering er en ny søgning kort efter en tidligere, uden at brugeren klikkede på et resultat. Søgningerne er
          anonyme.
        </p>
      </div>

      <StatsFilters filter={filter} fromDay={range.fromDay} toDay={range.toDay} hideTier keep={["tab", "sort", "miss"]} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Søgninger" value={kpis.searches} hint={`${num.format(kpis.uniqueQueries)} forskellige`} />
        <Kpi label="Uden resultat" value={pct(kpis.misses, kpis.searches)} hint={`${num.format(kpis.misses)} søgninger`} />
        <Kpi label="Raffineret" value={pct(kpis.refined, kpis.searches)} hint={`${num.format(kpis.refined)} søgte videre`} />
        <Kpi label="Klik på et resultat" value={pct(kpis.clicked, kpis.searches)} hint={`${num.format(kpis.clicked)} søgninger`} />
      </div>
      {kpis.fallback > 0 && (
        <p className="hf-type-small text-text-secondary">
          {num.format(kpis.fallback)} søgninger blev besvaret af databasen, fordi søgemotoren ikke svarede.
        </p>
      )}

      <section className="hf-panel">
        <p className="hf-type-body hf-type-strong text-text-primary">Lande</p>
        <Table
          head={["Land", "Søgninger", "Uden resultat"]}
          rows={byCountry.map((c) => [
            <Link key={c.region} href={href({ region: c.region })} className="underline">
              {countryLabel(c.region)}
            </Link>,
            c.searches,
            `${num.format(c.misses)} (${pct(c.misses, c.searches)})`,
          ])}
          empty="Ingen søgninger i perioden"
        />
      </section>

      <section className="hf-panel">
        <nav className="flex flex-wrap gap-1.5" aria-label="Søgevisning">
          {SEARCH_TABS.map((tab) => (
            <Link key={tab.id} href={href({ tab: tab.id })} className={btn(view.tab === tab.id)}>
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hf-type-small text-text-secondary">Sortér:</span>
          {SEARCH_SORTS.filter((s) => !(view.tab === "misses" && s.id === "misses")).map((sort) => (
            <Link key={sort.id} href={href({ sort: sort.id })} className={btn(view.sort === sort.id)}>
              {sort.label}
            </Link>
          ))}
        </div>

        {rows.kind === "all" && (
          <Table
            head={["Søgning", "Antal", "Uden resultat", "Klik", "Resultater i snit", "Lande", "Senest"]}
            rows={rows.list.map((r) => [r.query, r.searches, r.misses, r.clicks, num.format(r.avgResults), countries(r.countries), when.format(r.lastAt)])}
            empty="Ingen søgninger i perioden"
          />
        )}

        {rows.kind === "refined" && (
          <Table
            head={["Søgte først på", "Søgte så på", "Antal", "Første gav intet", "Fandt det bagefter", "Senest"]}
            rows={rows.list.map((r) => [r.fromQuery, r.toQuery, r.times, r.fromMisses, `${num.format(r.foundAfter)} (${pct(r.foundAfter, r.times)})`, when.format(r.lastAt)])}
            empty="Ingen raffinerede søgninger i perioden"
          />
        )}

        {rows.kind === "misses" && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="hf-type-small text-text-secondary">Vis:</span>
              {MISS_FILTERS.map((f) => (
                <Link key={f.id} href={href({ miss: f.id })} className={btn(view.miss === f.id)}>
                  {f.label}
                </Link>
              ))}
            </div>
            <p className="hf-type-small text-text-secondary">
              Uden resultat = ingen vare matchede alle ordene. Hver nat vurderes nye søgninger: stavefejl (appen rettede dem
              selv, eller AI fandt rettelsen) og meningsløse søgninger sorteres fra, så &quot;Kun rene fejl&quot; viser varer
              og mærker, der mangler i databasen.
            </p>
            <ReviewMissesButton />
            <Table
              head={["Søgning", "Antal", "Vurdering", "Søgte så på", "Lande", "Senest"]}
              rows={rows.list.map((r) => [
                r.query,
                r.searches,
                r.kind ? `${MISS_KIND_LABELS[r.kind] ?? r.kind}${r.suggestion ? ` → ${r.suggestion}` : ""}` : "Ikke vurderet",
                r.refinedTo ?? "–",
                countries(r.countries),
                when.format(r.lastAt),
              ])}
              empty="Ingen søgninger uden resultat med dette filter"
            />
          </>
        )}
      </section>
    </div>
  );
}
