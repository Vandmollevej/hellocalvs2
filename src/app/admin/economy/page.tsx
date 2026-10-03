import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/require-admin";
import { getEconomy, type KindSummary } from "@/lib/admin-economy";
import { EconomyForecast } from "@/components/admin/EconomyForecast";

export const dynamic = "force-dynamic";

// Admin "Economy" (docs/DECISIONS.md 2026-10-02): aktive betalende
// abonnementer samlet — årsabonnementer med sikret indkomst/løbetid,
// månedsabonnementer med total og næste måneds forventede indtjening.
const kr = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" });

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="hf-type-small text-text-secondary">{label}</p>
      <p className="hf-type-strong text-hf-black">{value}</p>
      {hint && <p className="hf-type-small text-text-muted">{hint}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 hf-surface p-4">
      <h2 className="hf-type-strong text-hf-black">{title}</h2>
      {children}
    </section>
  );
}

function countLine(k: KindSummary) {
  return `${k.count} (${k.renewing} fornyes, ${k.canceled} opsagt)`;
}

export default async function EconomyPage() {
  const admin = await requireAdminUser();
  if (!admin) redirect("/admin/login");

  const data = await getEconomy();
  const annual = data.kinds.find((k) => k.kind === "annual")!;
  const monthly = data.kinds.find((k) => k.kind === "monthly")!;
  const quarterly = data.kinds.find((k) => k.kind === "quarterly")!;
  const cover = data.annualCover;
  const maxRunway = Math.max(1, ...cover.runway.map((r) => r.securedDkk));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="hf-type-title text-hf-black">Economy</h1>
      <p className="hf-type-small text-text-muted">
        {data.payingNow} betalende abonnementer · løbende indtægt pr. måned: {kr.format(data.mrrDkk)} kr.
        {data.estimatedSubscriptions > 0 &&
          ` · ${data.estimatedSubscriptions} har skønnet pris (ikke fundet hos betalingsudbyderen)`}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Årsabonnementer">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Abonnenter" value={countLine(annual)} />
            <Stat
              label="Årlig sikker indkomst"
              value={`${kr.format(annual.periodTotalDkk)} kr.`}
              hint={annual.canceled ? `heraf opsagt: ${kr.format(annual.canceledPeriodTotalDkk)} kr.` : undefined}
            />
            <Stat
              label="Økonomien er sikret"
              value={cover.monthsToLatest === null ? "–" : `${cover.monthsToLatest} måneder`}
              hint={cover.latestEnd ? `til ${dateFmt.format(new Date(cover.latestEnd))} (sidste abonnement udløber)` : undefined}
            />
            <Stat
              label="Gennemsnitlig restløbetid"
              value={cover.weightedMonths === null ? "–" : `${cover.weightedMonths} måneder`}
              hint={`Betalt, ikke optjent: ${kr.format(cover.remainingValueDkk)} kr.`}
            />
          </div>
          {cover.runway.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="hf-type-small text-text-secondary">Sikret indtægt pr. måned fra årsabonnementer</p>
              {cover.runway.map((r) => (
                <div key={r.label} className="hf-type-small flex items-center gap-2">
                  <span className="w-20 shrink-0 text-text-secondary">{r.label}</span>
                  <span className="h-2 rounded-full bg-hf-green" style={{ width: `${(r.securedDkk / maxRunway) * 100}%`, minWidth: 2 }} />
                  <span className="text-text-muted">{kr.format(r.securedDkk)} kr.</span>
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block title="Månedsabonnementer">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Abonnenter" value={countLine(monthly)} />
            <Stat label="Total pr. måned" value={`${kr.format(monthly.periodTotalDkk)} kr.`} />
          </div>
          {quarterly.count > 0 && (
            <div className="grid grid-cols-2 gap-3 border-t border-hf-tan-dark pt-3">
              <Stat label="3-måneders abonnenter" value={countLine(quarterly)} />
              <Stat
                label="Total pr. 3 måneder"
                value={`${kr.format(quarterly.periodTotalDkk)} kr.`}
                hint={`${kr.format(quarterly.perMonthDkk)} kr. pr. måned`}
              />
            </div>
          )}
        </Block>
      </div>

      <EconomyForecast initial={data.forecast} basis={data.churn.basis} />
    </div>
  );
}
