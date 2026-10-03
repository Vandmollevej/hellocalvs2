import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { parseStatsFilter } from "@/lib/admin-stats-range";
import { getIntegrationDetail, type PersonRow } from "@/lib/admin-integration-stats";
import type { ReadType, WriteType } from "@/lib/integrations/sync-settings";
import { StatsBarChart } from "@/components/admin/stats/StatsBarChart";
import { DivergingBarChart } from "@/components/admin/integrations/DivergingBarChart";
import {
  Card,
  IntegrationIcon,
  KindBadge,
  PeriodPicker,
  Plain,
  Section,
  Tile,
  formatDateTime,
  num,
  pct,
} from "@/components/admin/integrations/IntegrationBlocks";

// Én integration i admin → Integrationer (docs/DECISIONS.md 2026-10-02):
// installationer, interaktion, seneste tilmeldinger som graf og frakoblinger.

export const dynamic = "force-dynamic";

const C = {
  green: "var(--hf-color-brand)",
  blue: "var(--hf-color-watch)",
  red: "var(--hf-color-danger)",
};

const READ_LABELS: Record<ReadType, string> = {
  weight: "Vægt",
  bodyFat: "Fedtprocent",
  muscleMass: "Muskelmasse",
  fatFreeMass: "Fedtfri masse",
  bodyWater: "Kropsvand",
  boneMass: "Knoglemasse",
  visceralFat: "Visceralt fedt",
  activities: "Træning",
  steps: "Skridt og distance",
  energy: "Energi (aktiv/hvile)",
  heart: "Puls",
  sleep: "Søvn",
  water: "Vand",
  body: "Højde og BMI",
};

const WRITE_LABELS: Record<WriteType, string> = {
  nutrition: "Kost og kalorier",
  water: "Vand",
  weight: "Vægt",
  activities: "Træning",
};

const SECTIONS = [
  { id: "noegletal", label: "Nøgletal" },
  { id: "tilmeldinger", label: "Tilmeldinger" },
  { id: "interaktion", label: "Interaktion" },
  { id: "frakoblinger", label: "Frakoblinger" },
  { id: "data", label: "Data og valg" },
  { id: "fejl", label: "Fejl" },
] as const;

function PeopleTable({ rows, detailHead, empty }: { rows: PersonRow[]; detailHead?: string; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-strong bg-surface-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-strong bg-surface-2 text-left text-xs text-text-secondary">
            <th className="px-3 py-2 font-medium">Bruger</th>
            <th className="px-3 py-2 font-medium">Tidspunkt</th>
            {detailHead && <th className="px-3 py-2 font-medium">{detailHead}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={detailHead ? 3 : 2} className="px-3 py-3 text-text-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row, i) => (
            <tr key={`${row.email}-${row.at}-${i}`} className="border-b border-border-strong last:border-0">
              <td className="px-3 py-2 text-text-primary">{row.email}</td>
              <td className="whitespace-nowrap px-3 py-2 text-text-secondary">{formatDateTime(row.at || null)}</td>
              {detailHead && <td className="px-3 py-2 text-text-secondary">{row.detail ?? "–"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// countOnly: vis kun antallet (søjlen er relativ til den største række).
function ShareBars({ rows, countOnly = false }: { rows: { label: string; on: number; of: number }[]; countOnly?: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3 text-sm">
          <span className="w-56 shrink-0 text-text-primary">{row.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-1" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${row.of ? (row.on / row.of) * 100 : 0}%`, background: C.green }} />
          </span>
          <span className="w-28 shrink-0 text-right text-xs tabular-nums text-text-secondary">
            {countOnly ? num.format(row.on) : `${num.format(row.on)} af ${num.format(row.of)} (${pct(row.on, row.of)})`}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function AdminIntegrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const { slug } = await params;
  const query = await searchParams;
  const filter = parseStatsFilter({ preset: query.preset ?? "3m" });
  const d = await getIntegrationDetail(slug, filter);
  if (!d) notFound();

  const p = d.period;
  const prev = d.previous;
  const attempts = p.syncs + p.syncErrors;
  const prevAttempts = prev.syncs + prev.syncErrors;
  const triedIt = d.everInstalled;
  const canWrite = d.writeSettings.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={`/admin/integrations?preset=${filter.preset}`} className="text-sm text-text-secondary underline hover:text-text-primary">
          ← Alle integrationer
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <IntegrationIcon src={d.meta.icon} size={44} />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-text-primary">{d.meta.label}</h1>
              <KindBadge kind={d.meta.kind} configured={d.configured} />
            </div>
            <p className="text-sm text-text-secondary">{d.meta.description}</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary">
          {d.range.label}: {d.range.fromDay} – {d.range.toDay} · procenter sammenlignes med en lige så lang periode lige før.
        </p>
        <PeriodPicker basePath={`/admin/integrations/${slug}`} active={filter.preset} />
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="text-text-secondary underline hover:text-text-primary">
              {section.label}
            </a>
          ))}
        </nav>
      </div>

      <Section id="noegletal" title="Installationer">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Aktive installationer" k={{ current: d.activeNow, previous: d.activeAtStart }} />
          <Plain label="Installeret i alt" value={triedIt} hint="Brugere, der nogensinde har forbundet" />
          <Plain
            label="Afinstalleret i alt"
            value={d.uninstalledNow}
            hint={`${pct(d.uninstalledNow, triedIt)} af dem, der har prøvet den`}
          />
          <Tile label="Nye tilkoblinger" k={{ current: p.connected, previous: prev.connected }} />
          <Tile label="Frakoblinger" k={{ current: p.disconnected, previous: prev.disconnected }} invert />
          <Plain
            label="Netto i perioden"
            value={`${p.connected - p.disconnected > 0 ? "+" : ""}${num.format(p.connected - p.disconnected)}`}
            hint={`Fra ${num.format(d.activeAtStart)} til ${num.format(d.activeNow)} aktive`}
          />
        </div>
      </Section>

      <Section id="tilmeldinger" title="Seneste tilmeldinger" intro="Tilkoblinger over linjen, frakoblinger under.">
        <Card>
          <DivergingBarChart
            points={d.installs}
            up={{ key: "connected", label: "Tilkoblinger", color: C.green }}
            down={{ key: "disconnected", label: "Frakoblinger", color: C.red }}
          />
        </Card>
        <Card title="Aktive installationer over tid">
          <StatsBarChart points={d.cumulative} series={[{ key: "active", label: "Aktive", color: C.green }]} />
        </Card>
        <PeopleTable rows={d.recentInstalls} empty="Ingen tilkoblinger registreret endnu" />
      </Section>

      <Section
        id="interaktion"
        title="Interaktion"
        intro={`Hvor ofte ${d.meta.label} bruges: hentninger fra appen${canWrite ? ", data sendt til appen" : ""} og ændrede til/fra-valg.`}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Synkroniseringer" k={{ current: p.syncs, previous: prev.syncs }} />
          <Tile label="Brugere i brug" k={{ current: p.activeUsers, previous: prev.activeUsers }} />
          <Tile label="Datapunkter hentet" k={{ current: p.delivered, previous: prev.delivered }} />
          {canWrite ? (
            <Tile label="Datapunkter sendt til appen" k={{ current: p.pushed, previous: prev.pushed }} />
          ) : (
            <Plain label="Datapunkter sendt til appen" value="–" hint={`${d.meta.label} tager ikke imod data`} />
          )}
          <Plain
            label="Fejlrate"
            value={pct(p.syncErrors, attempts)}
            hint={`${num.format(p.syncErrors)} af ${num.format(attempts)} forsøg (forrige: ${pct(prev.syncErrors, prevAttempts)})`}
          />
          <Plain
            label="Synk. pr. bruger i brug"
            value={p.activeUsers ? num.format(p.syncs / p.activeUsers) : "–"}
            hint="I perioden"
          />
          <Plain
            label="Datapunkter pr. synk."
            value={p.syncs ? num.format(p.delivered / p.syncs) : "–"}
            hint="Nye rækker gemt pr. hentning"
          />
          <Tile label="Ændrede til/fra-valg" k={{ current: p.settingsChanged, previous: prev.settingsChanged }} />
        </div>
        <Card title="Synkroniseringer">
          <StatsBarChart
            points={d.activity}
            series={[
              { key: "syncs", label: "Hentninger", color: C.green },
              ...(canWrite ? [{ key: "pushes", label: "Sendt til appen", color: C.blue }] : []),
              { key: "errors", label: "Fejl", color: C.red },
            ]}
          />
        </Card>
        <Card title="Datapunkter">
          <StatsBarChart
            points={d.delivered}
            series={[
              { key: "delivered", label: "Hentet", color: C.green },
              ...(canWrite ? [{ key: "pushed", label: "Sendt til appen", color: C.blue }] : []),
            ]}
          />
        </Card>
      </Section>

      <Section id="frakoblinger" title="Frakoblinger" intro="Hvem der koblede fra, og hvor længe de havde integrationen.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Frakoblinger i perioden" k={{ current: p.disconnected, previous: prev.disconnected }} invert />
          <Plain
            label="Median tid før frakobling"
            value={d.medianDaysBeforeUninstall === null ? "–" : `${num.format(d.medianDaysBeforeUninstall)} dage`}
            hint="Alle registrerede frakoblinger"
          />
          <Plain
            label="Frakoblet inden for 7 dage"
            value={pct(d.uninstalledWithin7Days.count, d.uninstalledWithin7Days.of)}
            hint={`${num.format(d.uninstalledWithin7Days.count)} af ${num.format(d.uninstalledWithin7Days.of)} frakoblinger`}
          />
        </div>
        <PeopleTable rows={d.recentUninstalls} detailHead="Havde den i" empty="Ingen frakoblinger registreret endnu" />
      </Section>

      <Section id="data" title="Data og valg">
        <Card title="Data gemt fra integrationen (alle tider)">
          {d.dataStored.length === 0 ? (
            <p className="text-sm text-text-muted">Ingen data gemt endnu.</p>
          ) : (
            <ShareBars
              rows={d.dataStored.map((row) => ({ label: row.label, on: row.count, of: d.dataStored[0].count }))}
              countOnly
            />
          )}
        </Card>
        {d.readSettings.length > 0 && (
          <Card title="Hent fra appen — slået til blandt forbundne">
            <ShareBars rows={d.readSettings.map((r) => ({ label: READ_LABELS[r.type], on: r.on, of: r.of }))} />
          </Card>
        )}
        {canWrite && (
          <Card title="Send til appen — slået til blandt forbundne">
            <ShareBars rows={d.writeSettings.map((r) => ({ label: WRITE_LABELS[r.type], on: r.on, of: r.of }))} />
          </Card>
        )}
      </Section>

      <Section id="fejl" title="Forbindelser i fejl" intro="Brugere, hvis seneste synkronisering fejlede. Fejlteksten er appens eget svar.">
        <PeopleTable rows={d.errors} detailHead="Fejl" empty="Ingen forbindelser i fejl" />
      </Section>
    </div>
  );
}
