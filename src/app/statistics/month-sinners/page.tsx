"use client";

// "Månedens synder" (G3, docs/DECISIONS.md 2026-09-24): åbnes fra knappen
// under kalenderens månedsvisning med ?month=YYYY-MM (den viste måned).
// Grupperet efter produkttype, største øverst, med varerne under hver
// gruppe og fx "4.820 kcal · 18 %" af månedens samlede indtag.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { SourceMetricTabs } from "@/components/SourceMetricTabs";
import { SourceItemList } from "@/components/SourceRows";
import {
  filterRegistrationsInRange,
  formatMetric,
  formatShare,
  groupSourcesByProductType,
  type SourceMetric,
} from "@/lib/food-classification";
import { useSourceRegistrations } from "@/lib/use-source-registrations";

function monthRange(param: string | null) {
  const match = param?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

function MonthSinnersContent() {
  const searchParams = useSearchParams();
  const range = useMemo(() => monthRange(searchParams.get("month")), [searchParams]);
  const { registrations, loading } = useSourceRegistrations();
  const [metric, setMetric] = useState<SourceMetric>("kcal");

  const groups = useMemo(
    () => groupSourcesByProductType(filterRegistrationsInRange(registrations, range), metric),
    [registrations, range, metric],
  );
  const monthLabel = range.start.toLocaleDateString("da-DK", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-center text-xs text-hf-black opacity-60">{monthLabel}</p>
      <SourceMetricTabs value={metric} onChange={setMetric} />

      {loading ? (
        <p className="py-6 text-center text-sm text-hf-black opacity-60">Henter…</p>
      ) : groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-hf-black opacity-60">Ingen registreringer i denne måned</p>
      ) : (
        groups.map((group) => (
          <section key={group.productType} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className="hf-heading min-w-0 truncate text-sm text-hf-black">{group.productType}</h2>
              <span className="shrink-0 text-xs font-semibold text-hf-black">
                {formatMetric(group.value, metric)} · {formatShare(group.share)}
              </span>
            </div>
            <SourceItemList items={group.items} metric={metric} />
          </section>
        ))
      )}
    </div>
  );
}

export default function MonthSinnersPage() {
  return (
    <HfScreen title="Månedens synder">
      <Suspense fallback={null}>
        <MonthSinnersContent />
      </Suspense>
    </HfScreen>
  );
}
