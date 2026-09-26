"use client";

// "Månedens synder" (G3, docs/DECISIONS.md 2026-09-24): åbnes fra knappen
// under kalenderens månedsvisning med ?month=YYYY-MM (den viste måned).
// Grupperet efter produkttype, største øverst, med varerne under hver
// gruppe og fx "4.820 kcal · 18 %" af månedens samlede indtag.

import { Suspense, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
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
import { useTranslation } from "@/i18n/LocaleProvider";

function monthRange(param: string | null) {
  const match = param?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();
  const year = match ? Number(match[1]) : now.getFullYear();
  const month = match ? Number(match[2]) - 1 : now.getMonth();
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1) };
}

function monthParam(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Samme pileknap som kalenderens PeriodButton (src/app/calendar/page.tsx),
// så datolinjen ser præcis ens ud på begge sider.
function MonthNavButton({ direction, onClick }: { direction: "previous" | "next"; onClick: () => void }) {
  const { t } = useTranslation();
  const Icon = direction === "previous" ? IconChevronLeft : IconChevronRight;
  return (
    <button
      type="button"
      aria-label={t("calendar.periodNavAriaLabel", {
        direction: direction === "previous" ? t("calendar.previous") : t("calendar.next"),
        period: t("calendar.periodMonth"),
      })}
      onClick={onClick}
      className="hf-btn-icon text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
    >
      <Icon size={22} />
    </button>
  );
}

function MonthSinnersContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = useMemo(() => monthRange(searchParams.get("month")), [searchParams]);
  const { registrations, loading } = useSourceRegistrations();
  const [metric, setMetric] = useState<SourceMetric>("kcal");

  const groups = useMemo(
    () => groupSourcesByProductType(filterRegistrationsInRange(registrations, range), metric),
    [registrations, range, metric],
  );
  const monthLabel = range.start.toLocaleDateString("da-DK", { month: "long", year: "numeric" });

  function moveMonth(direction: number) {
    const target = new Date(range.start.getFullYear(), range.start.getMonth() + direction, 1);
    router.replace(`${pathname}?month=${monthParam(target)}`, { scroll: false });
  }

  return (
    <div className="hf-page">
      <div className="flex items-center justify-center gap-3">
        <MonthNavButton direction="previous" onClick={() => moveMonth(-1)} />
        <div className="flex min-h-11 max-w-full items-center justify-center px-3 text-hf-black">
          <span className="hf-type-body hf-type-strong whitespace-nowrap capitalize">{monthLabel}</span>
        </div>
        <MonthNavButton direction="next" onClick={() => moveMonth(1)} />
      </div>
      <SourceMetricTabs value={metric} onChange={setMetric} />

      {loading ? (
        <p className="hf-type-body text-text-secondary py-8 text-center">Henter…</p>
      ) : groups.length === 0 ? (
        <p className="hf-type-body text-text-secondary py-8 text-center">Ingen registreringer i denne måned</p>
      ) : (
        groups.map((group) => (
          <section key={group.productType} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <h2 className="hf-type-body hf-heading min-w-0 truncate text-hf-black">{group.productType}</h2>
              <span className="hf-type-small hf-type-strong shrink-0 text-hf-black">
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
