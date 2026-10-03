import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { parseStatsFilter } from "@/lib/admin-stats-range";
import { getIntegrationsOverview, integrationAlerts } from "@/lib/admin-integration-stats";
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

// Admin → Integrationer (docs/DECISIONS.md 2026-10-02): alle integrationer
// med installationer, brug og frakoblinger. Tallene regnes i
// src/lib/admin-integration-stats.ts; siden viser kun.

export const dynamic = "force-dynamic";

const C = {
  green: "var(--hf-color-brand)",
  red: "var(--hf-color-danger)",
};

const ALERT_TONE = {
  danger: "border-hf-red-dark text-hf-red-dark",
  warning: "border-hf-warning text-hf-warning",
  info: "border-border-strong text-text-secondary",
} as const;

export default async function AdminIntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const params = await searchParams;
  // Kun periode (land/abonnement giver ikke mening her); standard 3 måneder.
  const filter = parseStatsFilter({ preset: params.preset ?? "3m" });
  const o = await getIntegrationsOverview(filter);
  const alerts = integrationAlerts(o.rows);
  const maxActive = Math.max(1, ...o.rows.map((r) => r.activeNow + r.errorNow));
  const activeTotal = o.totals.active.current;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Integrationer</h1>
          <p className="text-sm text-text-secondary">
            {o.range.label}: {o.range.fromDay} – {o.range.toDay} · procenter sammenlignes med en lige så lang periode lige før.
            Til-/frakoblinger og synkroniseringer registreres fra 2. oktober 2026; forbindelser, der var aktive
            da, er talt med fra deres tilkoblingsdato.
          </p>
        </div>
        <PeriodPicker basePath="/admin/integrations" active={filter.preset} />
      </div>

      <Section title="Nøgletal">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="Aktive installationer" k={o.totals.active} />
          <Tile label="Nye tilkoblinger" k={o.totals.connected} />
          <Tile label="Frakoblinger" k={o.totals.disconnected} invert />
          <Plain
            label="Brugere med integration"
            value={o.usersWithIntegration}
            hint={`${pct(o.usersWithIntegration, o.totalUsers)} af ${num.format(o.totalUsers)} brugere`}
          />
          <Tile label="Synkroniseringer" k={o.totals.syncs} />
          <Tile label="Datapunkter hentet" k={o.totals.delivered} />
          <Tile label="Synkroniseringsfejl" k={o.totals.errors} invert />
          <Plain
            label="Integrationer pr. bruger"
            value={o.usersWithIntegration ? num.format(activeTotal / o.usersWithIntegration) : "–"}
            hint="Gennemsnit blandt brugere med mindst én"
          />
        </div>
      </Section>

      {alerts.length > 0 && (
        <Section title="Kræver opmærksomhed">
          <ul className="flex flex-col gap-2">
            {alerts.map((alert, i) => (
              <li key={i}>
                <Link
                  href={`/admin/integrations/${alert.slug}`}
                  className={`flex items-center gap-2 rounded-lg border bg-surface-1 px-3 py-2 text-sm hover:bg-surface-2 ${ALERT_TONE[alert.tone]}`}
                >
                  <span aria-hidden>{alert.tone === "info" ? "ℹ" : "!"}</span>
                  <span>{alert.text}</span>
                  <span aria-hidden className="ml-auto text-text-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Alle integrationer" intro="Klik på en integration for installationer, brug, grafer og frakoblinger.">
        <div className="overflow-x-auto rounded-lg border border-border-strong bg-surface-1">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border-strong bg-surface-2 text-left text-xs text-text-secondary">
                <th className="px-3 py-2 font-medium">Integration</th>
                <th className="px-3 py-2 font-medium">Aktive nu</th>
                <th className="px-3 py-2 text-right font-medium">Nye</th>
                <th className="px-3 py-2 text-right font-medium">Frakoblet</th>
                <th className="px-3 py-2 text-right font-medium">Synk.</th>
                <th className="px-3 py-2 text-right font-medium">Brugere i brug</th>
                <th className="px-3 py-2 text-right font-medium">Datapunkter</th>
                <th className="px-3 py-2 text-right font-medium">Fejl nu</th>
                <th className="px-3 py-2 text-right font-medium">Seneste synk.</th>
              </tr>
            </thead>
            <tbody>
              {o.rows.map((row) => {
                const active = row.activeNow + row.errorNow;
                return (
                  <tr key={row.slug} className="border-b border-border-strong last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <Link href={`/admin/integrations/${row.slug}`} className="flex items-center gap-2.5">
                        <IntegrationIcon src={row.meta.icon} />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium text-text-primary underline-offset-2 hover:underline">{row.meta.label}</span>
                          <KindBadge kind={row.meta.kind} configured={row.configured} />
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-right tabular-nums text-text-primary">{num.format(active)}</span>
                        <span className="h-2 w-24 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${(active / maxActive) * 100}%`, background: C.green }}
                          />
                        </span>
                        <span className="text-xs text-text-muted">{pct(active, activeTotal)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{num.format(row.period.connected)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{num.format(row.period.disconnected)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{num.format(row.period.syncs)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{num.format(row.period.activeUsers)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-primary">{num.format(row.period.delivered)}</td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${row.errorNow > 0 ? "font-semibold text-hf-red-dark" : "text-text-primary"}`}
                    >
                      {num.format(row.errorNow)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-text-secondary">{formatDateTime(row.lastSyncAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Til- og frakoblinger" intro="Alle integrationer samlet. Tilkoblinger over linjen, frakoblinger under.">
        <Card>
          <DivergingBarChart
            points={o.installs}
            up={{ key: "connected", label: "Tilkoblinger", color: C.green }}
            down={{ key: "disconnected", label: "Frakoblinger", color: C.red }}
          />
        </Card>
      </Section>

      <Section title="Hvor ofte de bruges" intro="Synkroniseringer (hentning fra appen) og fejl, alle integrationer samlet.">
        <Card>
          <StatsBarChart
            points={o.activity}
            series={[
              { key: "syncs", label: "Synkroniseringer", color: C.green },
              { key: "errors", label: "Fejl", color: C.red },
            ]}
          />
        </Card>
      </Section>
    </div>
  );
}
