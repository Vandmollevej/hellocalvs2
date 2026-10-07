import Link from "next/link";
import { AD_STATS_RANGES, loadAdStats, type AdStatsRange, type AdStatsRow } from "@/lib/admin-ad-stats";

const number = new Intl.NumberFormat("da-DK");

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="hf-panel">
      <p className="hf-type-body text-text-secondary">{label}</p>
      <p className="hf-type-hero mt-1 text-hf-black">{value}</p>
    </div>
  );
}

function AdTable({ title, firstColumn, rows }: { title: string; firstColumn: string; rows: AdStatsRow[] }) {
  return (
    <div className="hf-panel">
      <h2 className="hf-type-body hf-type-strong text-hf-black">{title}</h2>
      {rows.length === 0 ? (
        <p className="hf-type-body mt-2 text-text-muted">Ingen data i perioden.</p>
      ) : (
        <div className="hf-table-scroll mt-2"><table className="hf-type-body w-full">
          <thead>
            <tr className="text-left text-text-secondary">
              <th className="py-1">{firstColumn}</th>
              <th className="py-1 text-right">Visninger</th>
              <th className="py-1 text-right">Klik</th>
              <th className="py-1 text-right">CTR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-hf-tan-dark">
                <td className="py-1.5">{row.key}</td>
                <td className="py-1.5 text-right">{number.format(row.impressions)}</td>
                <td className="py-1.5 text-right">{number.format(row.clicks)}</td>
                <td className="py-1.5 text-right">{row.ctr.toLocaleString("da-DK")} %</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}

export async function AdsView({ range }: { range: AdStatsRange }) {
  const stats = await loadAdStats(range);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hf-type-body text-text-secondary">
          Anonyme visninger og klik pr. reklame og placering. CTR = klik ÷ visninger.
        </p>
        <nav className="hf-insight__toolbar" aria-label="Periode">
          {AD_STATS_RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/admin/statistics?view=ads&range=${r.id}`}
              className={`hf-choice ${r.id === range ? "is-selected" : ""}`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Visninger" value={number.format(stats.impressions)} />
        <Tile label="Klik" value={number.format(stats.clicks)} />
        <Tile label="CTR" value={`${stats.ctr.toLocaleString("da-DK")} %`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdTable title="Pr. reklame" firstColumn="Reklame" rows={stats.byAd} />
        <AdTable title="Pr. placering" firstColumn="Placering" rows={stats.byPlacement} />
      </div>
    </div>
  );
}
