import type { DayStats } from "@/lib/partner-performance";

// Søjler pr. dag (visninger); klik ses i tooltip. Ren server-komponent.
export function DailyBars({ days }: { days: DayStats[] }) {
  if (days.length === 0) return <p className="hf-type-body text-text-secondary">Ingen visninger i perioden.</p>;
  const max = Math.max(...days.map((d) => d.impressions), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Visninger og klik pr. dag">
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.date}: ${d.impressions} visninger, ${d.clicks} klik`}>
            <div className="w-full rounded-t-sm bg-hf-green-dark" style={{ height: `${(d.impressions / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="hf-type-caption mt-1 flex justify-between">
        <span>{days[0].date}</span>
        <span>{days[days.length - 1].date}</span>
      </div>
      <p className="hf-type-caption mt-2">Søjlerne viser visninger pr. dag. Hold over en søjle for at se klik.</p>
    </div>
  );
}
