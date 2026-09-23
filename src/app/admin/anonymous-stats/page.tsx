import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { ANALYTICS_METRICS, MIN_COHORT_SIZE, type AnalyticsMetric } from "@/lib/analytics-rules";
import { cohortAverages } from "@/lib/analytics-query";

const METRIC_LABELS: Record<AnalyticsMetric, string> = {
  kcal: "Kalorier pr. dag",
  proteinG: "Protein pr. dag (g)",
  weightKg: "Vægt (kg)",
  waterMl: "Væske pr. dag (ml)",
  activityMinutes: "Aktivitet pr. dag (min)",
};

const SEX_LABELS: Record<string, string> = { FEMALE: "Kvinder", MALE: "Mænd", UNKNOWN: "Ukendt" };

// Anonym statistik (docs/PRIVACY.md "Statistik"): kun grupper med mindst
// MIN_COHORT_SIZE indsendelser, med statistisk støj. Ingen enkeltbrugere.
export default async function AnonymousStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; country?: string }>;
}) {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");
  const params = await searchParams;
  const days = [7, 30, 90, 365].includes(Number(params.days)) ? Number(params.days) : 30;
  const country = params.country && /^[A-Z]{2}$/.test(params.country) ? params.country : null;

  const metrics = Object.keys(ANALYTICS_METRICS) as AnalyticsMetric[];
  const tables = await Promise.all(metrics.map(async (metric) => ({ metric, rows: await cohortAverages(metric, days, country) })));
  const nf = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Anonym statistik</h1>
        <p className="text-sm text-text-secondary">
          Seneste {days} dage{country ? ` · ${country}` : ""}. Grupper med under {MIN_COHORT_SIZE} indsendelser vises
          ikke, og tallene har lidt statistisk støj. Gennemsnit er beregnet ud fra intervallernes midtpunkter.
        </p>
        <p className="mt-1 flex gap-2 text-sm">
          {[7, 30, 90, 365].map((d) => (
            <a key={d} href={`?days=${d}${country ? `&country=${country}` : ""}`} className={d === days ? "font-semibold underline" : "underline"}>
              {d} dage
            </a>
          ))}
        </p>
      </div>
      {tables.map(({ metric, rows }) => (
        <div key={metric} className="rounded-lg border border-border-strong bg-surface-2 p-4">
          <p className="font-medium text-text-primary">{METRIC_LABELS[metric]}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-text-muted">Ingen data endnu.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="py-1">Alder</th>
                  <th>Køn</th>
                  <th>Antal</th>
                  <th>Gennemsnit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.ageBand}-${row.sex}`} className="border-t border-border-strong">
                    <td className="py-1">{row.ageBand === "UNKNOWN" ? "Ukendt" : row.ageBand}</td>
                    <td>{SEX_LABELS[row.sex] ?? row.sex}</td>
                    <td>{row.suppressed ? "For få" : `~${row.count}`}</td>
                    <td>{row.suppressed || row.average === null ? "–" : nf.format(row.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
