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

// Filterlinje øverst på /admin/statistics: periode, land/region og
// abonnementstype. Filteret ligger i URL'en (kan genindlæses/bogmærkes).
export function StatsFilters({ filter, fromDay, toDay }: { filter: StatsFilterInput; fromDay: string; toDay: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(filter.from ?? fromDay);
  const [to, setTo] = useState(filter.to ?? toDay);

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
    <div className="hf-panel hf-type-small">
      <div className="flex flex-wrap gap-1.5">
        {STATS_PRESETS.filter((p) => p.value !== "custom").map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => apply({ preset: preset.value })}
            className={`hf-choice ${filter.preset === preset.value ? "is-selected" : ""}`}
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
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-text-secondary">
          Til
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-text-primary"
          />
        </label>
        <button
          type="button"
          onClick={() => apply({ preset: "custom", from, to })}
          className="hf-btn-primary h-10 px-4"
        >
          Vis periode
        </button>
        <label className="flex flex-col gap-1 text-text-secondary">
          Land / region
          <select
            value={filter.region}
            onChange={(event) => apply({ region: event.target.value })}
            className="rounded-md border border-border-strong bg-surface-1 px-2 py-1 text-text-primary"
          >
            <option value="all">Alle</option>
            <optgroup label="Regioner">
              {REGION_GROUPS.map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Lande">
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.value} value={country.value}>
                  {country.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <div className="flex flex-col gap-1 text-text-secondary">
          Abonnement
          <div className="flex flex-wrap gap-1.5">
            {STATS_TIERS.map((tier) => (
              <button
                key={tier.value}
                type="button"
                onClick={() => apply({ tier: tier.value })}
                className={`hf-choice ${filter.tier === tier.value ? "is-selected" : ""}`}
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
