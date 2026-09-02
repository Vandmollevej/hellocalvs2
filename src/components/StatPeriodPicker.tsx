"use client";

import { useState } from "react";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { STAT_PERIODS, selectionLabel, selectionRange, type StatPeriodSelection } from "@/lib/stat-periods";

function toInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Globalt periodevalg for hele statistiksiden: hurtige presets + en
 * kalender-dropdown til fra-til (default "I dag"). Gælder for alle tal på
 * siden, ikke længere ét valg pr. kort. */
export function StatPeriodPicker({
  selection,
  onChange,
}: {
  selection: StatPeriodSelection;
  onChange: (selection: StatPeriodSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const range = selectionRange(selection);
  const [customFrom, setCustomFrom] = useState(() => toInputValue(range.start));
  const [customTo, setCustomTo] = useState(() => {
    const inclusiveEnd = new Date(range.end);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    return toInputValue(inclusiveEnd);
  });

  function applyCustomRange() {
    const start = fromInputValue(customFrom);
    const end = fromInputValue(customTo);
    end.setDate(end.getDate() + 1);
    if (start.getTime() >= end.getTime()) return;
    onChange({ kind: "custom", start, end });
    setOpen(false);
  }

  return (
    <div className="relative z-50">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-9 items-center gap-1.5 rounded-full border border-hf-tan-dark bg-hf-white px-3 text-sm font-semibold text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
      >
        <IconCalendar size={16} stroke={2} />
        {selectionLabel(selection)}
        <IconChevronDown size={16} stroke={2.5} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Luk periodevælger"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-hf-tan-dark bg-hf-white p-3 text-hf-black shadow-xl">
            <div className="flex flex-col gap-1">
              {STAT_PERIODS.map((period) => {
                const active = selection.kind === "preset" && selection.key === period.key;
                return (
                  <button
                    key={period.key}
                    type="button"
                    onClick={() => {
                      onChange({ kind: "preset", key: period.key });
                      setOpen(false);
                    }}
                    className={`min-h-9 rounded-xl px-3 text-left text-sm font-semibold ${
                      active ? "bg-hf-green text-hf-white" : "hover:bg-hf-cream"
                    }`}
                  >
                    {period.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 border-t border-hf-tan-dark pt-2">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide opacity-60">Vælg periode</p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="Fra dato"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="min-h-9 flex-1 rounded-xl border border-hf-tan-dark bg-hf-cream px-2 text-sm"
                />
                <span className="text-xs opacity-60">til</span>
                <input
                  type="date"
                  aria-label="Til dato"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="min-h-9 flex-1 rounded-xl border border-hf-tan-dark bg-hf-cream px-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={applyCustomRange}
                className="hf-btn-primary mt-2 flex min-h-9 w-full items-center justify-center text-sm"
              >
                Brug periode
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
