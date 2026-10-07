"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  COUNTRY_OPTIONS,
  REGION_GROUPS,
  STATS_PRESETS,
  STATS_TIERS,
  type StatsFilterInput,
} from "@/lib/admin-stats-range";

// Hvide knapper med sort kant (brugerønske 2026-10-07).
const PILL = "rounded-full border border-black bg-white px-3 py-1 text-black hover:bg-hf-tan";
const PILL_ACTIVE = "font-semibold ring-1 ring-black";

// Filterlinje øverst på /admin/statistics: periode, land/region og
// abonnementstype. Filteret ligger i URL'en (kan genindlæses/bogmærkes).
export function StatsFilters({ filter, fromDay, toDay }: { filter: StatsFilterInput; fromDay: string; toDay: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(filter.from ?? fromDay);
  const [to, setTo] = useState(filter.to ?? toDay);
  const regionOptions = [{ value: "all", label: "Alle" }, ...REGION_GROUPS, ...COUNTRY_OPTIONS];
  const regionLabel = (value: string) => regionOptions.find((o) => o.value === value)?.label ?? "Alle";
  const [regionText, setRegionText] = useState(regionLabel(filter.region));

  function apply(next: Partial<StatsFilterInput>) {
    const merged = { ...filter, ...next };
    const params = new URLSearchParams();
    if (merged.preset !== "month") params.set("preset", merged.preset);
    if (merged.preset === "custom") {
      params.set("from", merged.from ?? from);
      params.set("to", merged.to ?? to);
    }
    if (merged.region !== "all") params.set("region", merged.region);
    if (merged.tier !== "all") params.set("tier", merged.tier);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {STATS_PRESETS.filter((p) => p.value !== "custom").map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => apply({ preset: preset.value })}
            className={`${PILL} ${filter.preset === preset.value ? PILL_ACTIVE : ""}`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-text-secondary">
          Fra
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className="hf-field rounded-md border border-border-strong bg-surface-1 px-2 text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-text-secondary">
          Til
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="hf-field rounded-md border border-border-strong bg-surface-1 px-2 text-text-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => apply({ preset: "custom", from, to })}
          className={`${PILL} ${filter.preset === "custom" ? PILL_ACTIVE : ""}`}
        >
          Vis periode
        </button>
        <label className="flex flex-col gap-1 text-text-secondary">
          Land / region
          <input
            type="text"
            list="stats-region-options"
            value={regionText}
            placeholder="Skriv for at søge"
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              const text = event.target.value;
              setRegionText(text);
              const match = regionOptions.find((o) => o.label.toLowerCase() === text.trim().toLowerCase());
              if (match) apply({ region: match.value });
            }}
            onBlur={() => setRegionText(regionLabel(filter.region))}
            className="hf-field rounded-md border border-border-strong bg-surface-1 px-2 text-text-primary"
          />
          <datalist id="stats-region-options">
            {regionOptions.map((o) => (
              <option key={o.value} value={o.label} />
            ))}
          </datalist>
        </label>
        <div className="flex flex-col gap-1 text-text-secondary">
          Abonnement
          <div className="flex gap-1.5">
            {STATS_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => apply({ tier: tier.value })}
                className={`${PILL} ${filter.tier === tier.value ? PILL_ACTIVE : ""}`}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
