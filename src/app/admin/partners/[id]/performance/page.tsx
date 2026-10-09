import Link from "next/link";
import { notFound } from "next/navigation";
import { getPartnerPerformance, parsePeriod, formatSeconds, ymdCph } from "@/lib/partner-performance";
import { InsightKpi } from "@/components/hf/HelloDocInsight";
import { ReportActions } from "@/components/admin/partner/ReportActions";
import { SpotGrid } from "@/components/admin/partner/SpotGrid";
import { DailyBars } from "@/components/admin/partner/DailyBars";
import { BTN } from "@/components/admin/partner/ui";

export const dynamic = "force-dynamic";

type Search = { tab?: string; from?: string; to?: string; days?: string; triggered?: string };

const PRESETS = [7, 30, 90];
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const num = (v: number) => v.toLocaleString("da-DK");
const ymd = ymdCph;

// Partnersiden → Performance (docs/DECISIONS.md 2026-10-02). To faner:
// Overview (standard) med totaler/KPI'er og Data mining med de enkelte
// bannere i kasser to og to. Periode vælges øverst, rapporten kan hentes
// som PDF/CSV eller sendes til en indtastet adresse.
export default async function PartnerPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = sp.tab === "mining" ? "mining" : "overview";
  const onlyTriggered = sp.triggered === "1";

  const presetDays = PRESETS.includes(Number(sp.days)) ? Number(sp.days) : null;
  const today = new Date();
  const fromRaw = sp.from || (presetDays ? ymd(new Date(today.getTime() - (presetDays - 1) * 86_400_000)) : undefined);
  const toRaw = sp.to || (presetDays ? ymd(today) : undefined);
  const { from, to } = parsePeriod(fromRaw, toRaw);
  const perf = await getPartnerPerformance(id, from, to, { onlyTriggered });
  if (!perf) notFound();

  const fromInput = ymd(from);
  const toInput = ymd(new Date(to.getTime() - 1));
  const activePreset = presetDays ?? (!sp.from && !sp.to ? 30 : null);

  const href = (patch: Partial<Search>) => {
    const next: Record<string, string> = { from: fromInput, to: toInput, ...(tab === "mining" ? { tab: "mining" } : {}), ...(onlyTriggered ? { triggered: "1" } : {}) };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === "") delete next[key];
      else next[key] = value;
    }
    return `/admin/partners/${id}/performance?${new URLSearchParams(next)}`;
  };
  const presetHref = (days: number) => {
    const base: Record<string, string> = { days: String(days), ...(tab === "mining" ? { tab: "mining" } : {}), ...(onlyTriggered ? { triggered: "1" } : {}) };
    return `/admin/partners/${id}/performance?${new URLSearchParams(base)}`;
  };

  const query = new URLSearchParams({ from: fromInput, to: toInput, ...(onlyTriggered ? { onlyTriggered: "1" } : {}) }).toString();
  const t = perf.totals;

  return (
    <>
      <h2 className="hf-type-page-title text-hf-black">Performance</h2>

      <nav className="hf-type-body flex flex-wrap self-start p-0.5 hf-surface" aria-label="Performance">
        {[
          { id: "overview", label: "Overview", to: href({ tab: "" }) },
          { id: "mining", label: "Data mining", to: href({ tab: "mining" }) },
        ].map((item) => (
          <Link
            key={item.id}
            href={item.to}
            className={`rounded-md px-3 py-1.5 ${item.id === tab ? "hf-type-strong bg-hf-tan text-hf-green-dark" : "text-text-secondary hover:text-text-primary"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="hf-insight__toolbar items-end">
        {PRESETS.map((days) => (
          <Link key={days} href={presetHref(days)} className="hf-choice" aria-pressed={activePreset === days}>
            {days} dage
          </Link>
        ))}
        <form method="get" className="flex flex-wrap items-end gap-2">
          {tab === "mining" && <input type="hidden" name="tab" value="mining" />}
          {onlyTriggered && <input type="hidden" name="triggered" value="1" />}
          <label className="flex flex-col"><span className="hf-type-caption">Fra</span><input type="date" name="from" defaultValue={fromInput} className="hf-type-body h-10 rounded-md border border-hf-tan-dark bg-hf-white px-3" /></label>
          <label className="flex flex-col"><span className="hf-type-caption">Til</span><input type="date" name="to" defaultValue={toInput} className="hf-type-body h-10 rounded-md border border-hf-tan-dark bg-hf-white px-3" /></label>
          <button className={BTN}>Vis</button>
        </form>
        <Link href={href({ triggered: onlyTriggered ? "" : "1" })} className="hf-choice" aria-pressed={onlyTriggered} title="Vis kun reklamer, der udløses af produktkategori eller produkttype">
          Kun udløst af kategori/type
        </Link>
      </div>

      {tab === "overview" ? (
        <>
          <div className="hf-insight__kpis">
            <InsightKpi label="Visninger i alt" value={num(t.impressions)} />
            <InsightKpi label="Klik" value={num(t.clicks)} />
            <InsightKpi label="Klikrate (CTR)" value={pct(t.ctr)} />
            <InsightKpi label="Eksponeringstid i alt" value={formatSeconds(t.seconds)} />
            <InsightKpi label="Gns. eksponering pr. visning" value={`${t.avgSeconds.toFixed(1).replace(".", ",")} sek.`} />
            <InsightKpi label="Opfyldelse af aftalte visninger" value={t.fulfilment === null ? "–" : pct(t.fulfilment)} />
            <InsightKpi label="Reklamespots" value={num(t.spots)} />
            <InsightKpi label="Forskellige sider vist på" value={num(t.uniquePaths)} />
          </div>
          <section className="hf-panel">
            <h3 className="hf-type-title">Visninger og klik pr. dag</h3>
            <DailyBars days={perf.byDay} />
          </section>
        </>
      ) : (
        <SpotGrid spots={perf.spots} />
      )}

      <ReportActions partnerId={id} query={query} />
    </>
  );
}
