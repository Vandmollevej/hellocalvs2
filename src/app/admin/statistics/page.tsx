import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getAdminStatistics, type Kpi, type Row, type TrendItem } from "@/lib/admin-stats";
import { parseStatsFilter } from "@/lib/admin-stats-range";
import { StatsFilters } from "@/components/admin/stats/StatsFilters";
import { StatsBarChart, type ChartSeries } from "@/components/admin/stats/StatsBarChart";
import { StatsAiSummary } from "@/components/admin/stats/StatsAiSummary";
import { AnalyticsView, parseAnalyticsRange } from "@/components/admin/stats/AnalyticsView";
import { AdsView } from "@/components/admin/stats/AdsView";
import { HelloDocView } from "@/components/admin/stats/HelloDocView";
import { StatsTabs, parseStatsView } from "@/components/admin/stats/StatsTabs";
import { AD_STATS_RANGES, type AdStatsRange } from "@/lib/admin-ad-stats";

// Admin "Statistik" (docs/DECISIONS.md 2026-09-27): dashboards med periode-,
// land/region- og abonnementsfilter øverst. Alle tal beregnes i
// src/lib/admin-stats.ts; siden viser kun.

export const dynamic = "force-dynamic";

// Farver: HelloFresh-grøn og de eksisterende semantiske tokens (validator-
// kørt, se docs/DECISIONS.md). Gratis er bevidst neutral grå.
const C = {
  green: "var(--hf-color-brand)",
  blue: "var(--hf-color-watch)",
  brown: "var(--hf-color-warning)",
  gray: "var(--hf-color-disabled)",
};

const TIER_SERIES: ChartSeries[] = [
  { key: "serious", label: "Seriøs", color: C.green },
  { key: "family", label: "Seriøs Familie", color: C.blue },
  { key: "free", label: "Gratis", color: C.gray },
];

const REG_SERIES: ChartSeries[] = [
  { key: "products", label: "Varer", color: C.green },
  { key: "hellofresh", label: "HelloFresh-retter", color: C.blue },
  { key: "dishes", label: "Egne retter", color: C.brown },
  { key: "generic", label: "Generiske ingredienser", color: C.gray },
];

const REVENUE_SERIES: ChartSeries[] = [
  { key: "MOBILEPAY_ONLINE", label: "MobilePay", color: C.blue },
  { key: "STRIPE", label: "Kort", color: C.green },
  { key: "OTHER", label: "Andet", color: C.gray },
];

const SECTIONS = [
  { id: "noegletal", label: "Nøgletal" },
  { id: "oprettelser", label: "Nye oprettelser" },
  { id: "abonnement", label: "Betalende vs. gratis" },
  { id: "logins", label: "Log-ins" },
  { id: "logget", label: "Varer logget" },
  { id: "trends", label: "Trends" },
  { id: "hellofresh", label: "HelloFresh-menuer" },
  { id: "fastholdelse", label: "Fastholdelse & churn" },
  { id: "omsaetning", label: "Omsætning" },
  { id: "top", label: "Top & søgninger" },
  { id: "support", label: "Support & fejl" },
] as const;

const num = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

function pct(part: number, total: number) {
  return total ? `${num.format((part / total) * 100)} %` : "–";
}

function Delta({ k, invert = false }: { k: Kpi; invert?: boolean }) {
  if (k.previous === 0 && k.current === 0) return <span className="text-text-muted">uændret</span>;
  if (k.previous === 0) return <span className="text-text-muted">ny (forrige: 0)</span>;
  const change = ((k.current - k.previous) / k.previous) * 100;
  const good = invert ? change < 0 : change > 0;
  const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "■";
  return (
    <span className={change === 0 ? "text-text-muted" : good ? "text-hf-green-dark" : "text-hf-red-dark"}>
      {arrow} {num.format(Math.abs(change))} % <span className="text-text-muted">(forrige: {num.format(k.previous)})</span>
    </span>
  );
}

function Tile({ label, k, unit, invert }: { label: string; k: Kpi; unit?: string; invert?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-hf-tan p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">
        {num.format(k.current)}
        {unit && <span className="ml-1 text-base font-normal text-text-secondary">{unit}</span>}
      </p>
      <p className="text-xs">
        <Delta k={k} invert={invert} />
      </p>
    </div>
  );
}

function Plain({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-hf-tan p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-2xl font-semibold text-text-primary">{typeof value === "number" ? num.format(value) : value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

function Table({ head, rows, empty = "Ingen data i perioden" }: { head: string[]; rows: Row[]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-strong bg-surface-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-strong bg-surface-2 text-left text-xs text-text-secondary">
            {head.map((h, i) => (
              <th key={h} className={`px-3 py-2 font-medium ${i > 0 ? "text-right" : ""}`}>
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
            <tr key={`${row.label}-${index}`} className="border-b border-border-strong last:border-0">
              <td className="px-3 py-2 text-text-primary">{row.label}</td>
              {row.values.map((value, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums text-text-primary">
                  {typeof value === "number" ? num.format(value) : value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-4 flex-col gap-3">
      <h2 className="border-b border-border-strong pb-1 text-base font-semibold text-hf-green-dark">{title}</h2>
      {intro && <p className="text-sm text-text-secondary">{intro}</p>}
      {children}
    </section>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-2 p-4">
      {title && <p className="text-sm font-semibold text-text-primary">{title}</p>}
      {children}
    </div>
  );
}

function TrendList({ items }: { items: TrendItem[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border-strong rounded-lg border border-border-strong bg-surface-1">
      {items.map((item) => {
        const up = item.current > item.previous;
        const same = item.current === item.previous;
        const text = same
          ? `${item.metric} er uændret (${num.format(item.current)}${item.unit ? ` ${item.unit}` : ""}).`
          : `${item.metric} ${up ? "steg" : "faldt"} ${
              item.pct === null ? "fra 0" : `${num.format(Math.abs(item.pct))} %`
            } (${num.format(item.previous)} → ${num.format(item.current)}${item.unit ? ` ${item.unit}` : ""}).`;
        const notable = item.pct === null || Math.abs(item.pct) >= 10;
        return (
          <li key={item.metric} className="flex items-start gap-2 px-3 py-2 text-sm">
            <span aria-hidden className={same ? "text-text-muted" : up ? "text-hf-green-dark" : "text-hf-red-dark"}>
              {same ? "■" : up ? "▲" : "▼"}
            </span>
            <span className={notable ? "text-text-primary" : "text-text-secondary"}>{text}</span>
            {notable && !same && (
              <span className="ml-auto shrink-0 rounded-full bg-hf-tan px-2 py-0.5 text-xs text-text-secondary">
                Markant
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  const view = parseStatsView(params.view);
  if (view !== "users") {
    const adRange = AD_STATS_RANGES.some((r) => r.id === params.range) ? (params.range as AdStatsRange) : "7d";
    return (
      <div className="flex flex-col gap-6">
        <StatsTabs active={view} />
        {view === "traffic" ? (
          <AnalyticsView range={parseAnalyticsRange(params.range)} />
        ) : view === "doc" ? (
          <HelloDocView range={adRange} />
        ) : (
          <AdsView range={adRange} />
        )}
      </div>
    );
  }
  const filter = parseStatsFilter(params);
  const s = await getAdminStatistics(filter);
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))
  ).toString();
  const t = s.tierSnapshot;
  const tierTotal = t.free + t.seriousPaid + t.familyPaid + t.comped;
  const r = s.retention;

  return (
    <div className="flex flex-col gap-8">
      <StatsTabs active="users" />
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Statistik</h1>
          <p className="text-sm text-text-secondary">
            {s.range.label}: {s.range.fromDay} – {s.range.toDay} · {num.format(s.scopeUserCount)} brugere i filteret · alle
            procenter sammenlignes med en lige så lang periode lige før.
          </p>
        </div>
        <StatsFilters filter={filter} fromDay={s.range.fromDay} toDay={s.range.toDay} />
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="text-text-secondary underline hover:text-text-primary">
              {section.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="noegletal" title="Nøgletal">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Nye oprettelser" k={s.kpis.newUsers} />
          <Tile label="Aktive brugere (har logget)" k={s.kpis.activeUsers} />
          <Tile label="Varer logget" k={s.kpis.registrations} />
          <Tile label="Log-ins" k={s.kpis.logins} />
          <Tile label="HelloFresh-retter logget" k={s.kpis.hellofresh} />
          <Tile label="Omsætning" k={s.kpis.revenueDkk} unit="kr." />
          <Tile label="Supporthenvendelser" k={s.kpis.support} invert />
          <Tile label="Fejlrapporter" k={s.kpis.bugs} invert />
        </div>
      </Section>

      <Section id="oprettelser" title="Nye oprettelser" intro="Farvet efter brugerens nuværende abonnement.">
        <Card>
          <StatsBarChart points={s.signups} series={TIER_SERIES} />
        </Card>
        <Table head={["Land", "Nye brugere"]} rows={s.signupsByCountry} />
      </Section>

      <Section id="abonnement" title="Betalende vs. gratis" intro="Status lige nu for brugerne i filteret.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Plain label="Seriøs (betalende)" value={t.seriousPaid} hint={pct(t.seriousPaid, tierTotal)} />
          <Plain label="Seriøs Familie (betalende)" value={t.familyPaid} hint={pct(t.familyPaid, tierTotal)} />
          <Plain label="Gave, points, prøve eller familiemedlem" value={t.comped} hint={pct(t.comped, tierTotal)} />
          <Plain label="Gratis" value={t.free} hint={pct(t.free, tierTotal)} />
        </div>
        {tierTotal > 0 && (
          <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded" aria-hidden>
            {[
              { n: t.seriousPaid, c: C.green },
              { n: t.familyPaid, c: C.blue },
              { n: t.comped, c: C.brown },
              { n: t.free, c: C.gray },
            ]
              .filter((part) => part.n > 0)
              .map((part) => (
                <div key={part.c} style={{ width: `${(part.n / tierTotal) * 100}%`, background: part.c }} />
              ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Nye betalende abonnementer" k={s.newPaying} />
          <Tile label="Opsigelser" k={s.cancellations} invert />
        </div>
        <Table head={["Land", "Brugere", "Betalende", "Gave/points m.m.", "Gratis", "Andel betalende"]} rows={s.tierByCountry} />
      </Section>

      <Section
        id="logins"
        title="Log-ins"
        intro="Gennemførte log-ins (alle metoder). Log-ins registreres fra 27. september 2026; brugere forbliver typisk logget ind længe, så se også aktive brugere."
      >
        <Card>
          <StatsBarChart points={s.logins} series={[{ key: "logins", label: "Log-ins", color: C.green }]} />
        </Card>
        <Table head={["Metode", "Log-ins"]} rows={s.loginsByMethod} />
      </Section>

      <Section id="logget" title="Varer logget over tid">
        <Card>
          <StatsBarChart points={s.registrations} series={REG_SERIES} />
        </Card>
        <Table head={["Ugedag", "Registreringer", "Andel nu", "Andel forrige periode"]} rows={s.registrationsByWeekday} />
      </Section>

      <Section
        id="trends"
        title="Trends"
        intro="Beregnet automatisk: perioden sammenlignet med forrige periode, største ændringer øverst. ≥ 10 % markeres."
      >
        <TrendList items={s.trends} />
        <StatsAiSummary query={query} />
      </Section>

      <Section id="hellofresh" title="HelloFresh-menuer" intro="Brug af HelloFresh-retter (opskrifter fra HelloFreshs menuer) i appen.">
        <div className="grid grid-cols-2 gap-3">
          <Tile label="HelloFresh-retter logget" k={s.kpis.hellofresh} />
          <Tile label="Brugere der loggede en HelloFresh-ret" k={s.hellofresh.users} />
        </div>
        <Card title="Mest loggede HelloFresh-retter">
          <Table head={["Ret", "Gange logget", "Brugere"]} rows={s.hellofresh.topLogged} />
        </Card>
        <Card title="Mest søgte HelloFresh-retter">
          <p className="text-xs text-text-muted">Retter søgt frem i perioden; søgninger og klik er brugernes samlede antal.</p>
          <Table head={["Ret", "Søgninger", "Klik", "Brugere"]} rows={s.hellofresh.topSearched} />
        </Card>
      </Section>

      <Section id="fastholdelse" title="Fastholdelse & churn" intro="Aktiv = har logget mindst én vare.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Plain label="Aktive seneste døgn" value={r.dau} />
          <Plain label="Aktive seneste 7 dage" value={r.wau} />
          <Plain label="Aktive seneste 30 dage" value={r.mau} hint={r.mau ? `Døgn/måned: ${pct(r.dau, r.mau)}` : undefined} />
          <Plain label="Inaktive over 30 dage" value={r.inactive30} hint="Konti ældre end 30 dage uden logning" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Plain
            label="Bruger stadig appen efter 7 dage"
            value={pct(r.day7.retained, r.day7.eligible)}
            hint={`${r.day7.retained} af ${r.day7.eligible} nye brugere i perioden`}
          />
          <Plain
            label="Bruger stadig appen efter 30 dage"
            value={pct(r.day30.retained, r.day30.eligible)}
            hint={`${r.day30.retained} af ${r.day30.eligible} nye brugere i perioden`}
          />
        </div>
        <Tile label="Opsigelser af abonnement" k={s.cancellations} invert />
      </Section>

      <Section id="omsaetning" title="Omsætning" intro="Gennemførte betalinger efter forfaldsdato.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Omsætning i perioden" k={s.kpis.revenueDkk} unit="kr." />
          <Plain label="Månedlig tilbagevendende (MRR)" value={`${num.format(s.revenue.mrrDkk)} kr.`} hint="Estimat ud fra seneste betaling" />
          <Plain label="Betalende lige nu" value={s.revenue.payingNow} />
          <Plain
            label="Gennemsnit pr. betalende"
            value={s.revenue.payingNow ? `${num.format(Math.round(s.revenue.mrrDkk / s.revenue.payingNow))} kr.` : "–"}
            hint="pr. måned"
          />
        </div>
        <Card>
          <StatsBarChart points={s.revenue.series} series={REVENUE_SERIES} unit="kr." />
        </Card>
        <Table head={["Betalingsmetode", "Betalinger", "Beløb (kr.)"]} rows={s.revenue.byProvider} />
        <div className="grid grid-cols-2 gap-3">
          <Tile label="Gavekoder indløst" k={s.revenue.giftCodesRedeemed} />
          <Tile label="Gratis måneder indløst (points)" k={s.revenue.freeMonthsRedeemed} />
        </div>
      </Section>

      <Section id="top" title="Top-varer & søgninger">
        <Card title="Mest loggede">
          <Table head={["Vare/ret", "Gange logget", "Brugere"]} rows={s.top.logged} />
        </Card>
        <Card title="Mest søgte">
          <p className="text-xs text-text-muted">Varer søgt frem i perioden; søgninger og klik er brugernes samlede antal.</p>
          <Table head={["Vare", "Søgninger", "Klik", "Brugere"]} rows={s.top.searched} />
        </Card>
        <Card title={`Søgninger uden resultat (${num.format(s.top.missTotal)} i alt)`}>
          <p className="text-xs text-text-muted">
            Varesøgninger på mindst 3 tegn uden et eneste vare-hit. Registreres fra 27. september 2026; filtreres kun
            på land.
          </p>
          <Table head={["Søgetekst", "Antal"]} rows={s.top.misses} />
        </Card>
      </Section>

      <Section id="support" title="Support & fejl">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Nye supporthenvendelser" k={s.kpis.support} invert />
          <Plain label="Åbne sager nu" value={s.support.openNow} />
          <Plain
            label="Median tid til første svar"
            value={s.support.medianFirstReplyHours === null ? "–" : `${num.format(s.support.medianFirstReplyHours)} t`}
          />
          <Tile label="Fejlrapporter fra brugere" k={s.kpis.bugs} invert />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Table head={["Kategori", "Henvendelser"]} rows={s.support.byCategory} />
          <Table
            head={["Fejlrapport-status", "Antal"]}
            rows={[...s.support.bugsByStatus, { label: "Afventer lige nu (alle perioder)", values: [s.support.bugsPending] }]}
          />
        </div>
      </Section>
    </div>
  );
}
