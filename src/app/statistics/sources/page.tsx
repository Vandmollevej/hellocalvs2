"use client";

// "Største kilder" (G3, docs/DECISIONS.md 2026-09-24): alle varer i den
// periode, der var valgt på Statistik-siden, sorteret efter Kalorier, Fedt
// eller Sukker. Én række pr. vare (sammenlagt). Kan skifte til visning pr.
// produkttype.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { SegmentedTabs, SourceMetricTabs } from "@/components/SourceMetricTabs";
import { SourceItemList } from "@/components/SourceRows";
import {
  aggregateSources,
  filterRegistrationsInRange,
  formatMetric,
  formatShare,
  groupSourcesByProductType,
  type SourceMetric,
} from "@/lib/food-classification";
import { periodRange } from "@/lib/stat-periods";
import { useSourceRegistrations } from "@/lib/use-source-registrations";

type View = "products" | "types";

const VIEWS: { key: View; label: string }[] = [
  { key: "products", label: "Produkter" },
  { key: "types", label: "Produkttyper" },
];

function parseRange(from: string | null, to: string | null) {
  const start = from ? new Date(from) : null;
  const end = to ? new Date(to) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) return { start, end };
  return periodRange("thisMonth");
}

function rangeLabel(range: { start: Date; end: Date }) {
  const format = (date: Date) => date.toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
  const inclusiveEnd = new Date(range.end.getTime() - 1);
  return `${format(range.start)} – ${format(inclusiveEnd)}`;
}

function SourcesContent() {
  const searchParams = useSearchParams();
  const range = useMemo(
    () => parseRange(searchParams.get("from"), searchParams.get("to")),
    [searchParams],
  );
  const { registrations, loading } = useSourceRegistrations();
  const [metric, setMetric] = useState<SourceMetric>("kcal");
  const [view, setView] = useState<View>("products");

  const inRange = useMemo(() => filterRegistrationsInRange(registrations, range), [registrations, range]);
  const items = useMemo(() => aggregateSources(inRange, metric), [inRange, metric]);
  const groups = useMemo(() => groupSourcesByProductType(inRange, metric), [inRange, metric]);

  return (
    <div className="hf-page">
      <p className="text-center text-xs text-hf-black opacity-60">{rangeLabel(range)}</p>
      <SourceMetricTabs value={metric} onChange={setMetric} />
      <SegmentedTabs options={VIEWS} value={view} onChange={setView} />

      {loading ? (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">Henter…</p>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-hf-black opacity-60">Ingen registreringer i perioden</p>
      ) : view === "products" ? (
        <SourceItemList items={items} metric={metric} />
      ) : (
        <div className="rounded-2xl bg-hf-tan">
          {groups.map((group, index) => (
            <div
              key={group.productType}
              className={`flex items-center justify-between gap-2 px-4 py-3 ${
                index === groups.length - 1 ? "" : "border-b border-hf-tan-dark"
              }`}
            >
              <span className="min-w-0 truncate text-sm text-hf-black">{group.productType}</span>
              <span className="shrink-0 text-sm font-semibold text-hf-black">
                {formatMetric(group.value, metric)} · {formatShare(group.share)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StatisticsSourcesPage() {
  return (
    <HfScreen title="Største kilder">
      <Suspense fallback={null}>
        <SourcesContent />
      </Suspense>
    </HfScreen>
  );
}
