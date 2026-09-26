"use client";

// Fanevælger Kalorier | Fedt | Sukker (G3) — design.md "Filter/mode":
// lille pille-kontrol, aktiv fane mørk.

import { SOURCE_METRICS, type SourceMetric } from "@/lib/food-classification";

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2" role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className="hf-choice flex-1"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SourceMetricTabs({ value, onChange }: { value: SourceMetric; onChange: (value: SourceMetric) => void }) {
  return <SegmentedTabs options={SOURCE_METRICS} value={value} onChange={onChange} />;
}
