"use client";

import { useEffect, useRef, useState } from "react";

const ITEM_HEIGHT = 40;
const MIN_YEAR = 1900;
const DEFAULT_YEAR = 1990;
// Nobody logs calories from birth: the latest pickable birth date is this many
// years before today, and a saved date later than that is treated as unset.
export const BIRTH_DATE_MIN_AGE_YEARS = 10;
const MONTHS = ["jan.", "feb.", "mar.", "apr.", "maj", "jun.", "jul.", "aug.", "sep.", "okt.", "nov.", "dec."];

type Parts = { year: number; month: number; day: number };

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function latestParts(): Parts {
  const now = new Date();
  const year = now.getFullYear() - BIRTH_DATE_MIN_AGE_YEARS;
  const month = now.getMonth() + 1;
  return { year, month, day: Math.min(now.getDate(), daysInMonth(year, month)) };
}

function parse(value: string | null): Parts | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function format({ year, month, day }: Parts) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Clamps the day to the month's length and the whole date to the latest
// allowed birth date, so a future or too-recent date can never be picked.
function normalize(parts: Parts): Parts {
  const day = Math.min(parts.day, daysInMonth(parts.year, parts.month));
  const next = { ...parts, day };
  const latest = latestParts();
  return format(next) > format(latest) ? latest : next;
}

// Fødselsdato-vælger (2026-09-22): the native date input opens on today when
// empty, which is useless for a birth date. This wheel sheet opens on the saved
// date, or on 1 Jan 1990 when none is saved, and only commits on "Færdig".
export function BirthDatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState<Parts | null>(null);
  const parsed = parse(value);
  const saved = parsed && format(parsed) <= format(latestParts()) ? parsed : null;
  const maxYear = latestParts().year;

  const years: number[] = [];
  for (let n = maxYear; n >= MIN_YEAR; n -= 1) years.push(n);
  const months = MONTHS.map((_, index) => index + 1);
  const days: number[] = [];
  if (draft) for (let n = 1; n <= daysInMonth(draft.year, draft.month); n += 1) days.push(n);

  function update(patch: Partial<Parts>) {
    setDraft((current) => (current ? normalize({ ...current, ...patch }) : current));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDraft(normalize(saved ?? { year: DEFAULT_YEAR, month: 1, day: 1 }))}
        className="flex items-center rounded-xl bg-hf-tan px-4 py-3 text-left text-[15px] text-hf-black"
      >
        {saved ? `${saved.day}. ${MONTHS[saved.month - 1]} ${saved.year}` : "Vælg"}
      </button>

      {draft && (
        <div
          className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Luk"
            className="flex-1"
            onClick={() => setDraft(null)}
          />
          <div className="rounded-t-2xl bg-hf-cream pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[15px] font-bold text-hf-black">{label}</span>
              <button
                type="button"
                onClick={() => {
                  onChange(format(draft));
                  setDraft(null);
                }}
                className="text-[15px] font-semibold text-hf-green"
              >
                Færdig
              </button>
            </div>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 h-10 -translate-y-1/2 rounded-lg bg-hf-tan"
                aria-hidden="true"
              />
              <div className="relative grid grid-cols-[1fr_1.4fr_1.4fr]">
                <WheelColumn
                  options={days}
                  selected={draft.day}
                  render={(day) => `${day}.`}
                  onSelect={(day) => update({ day })}
                />
                <WheelColumn
                  options={months}
                  selected={draft.month}
                  render={(month) => MONTHS[month - 1]}
                  onSelect={(month) => update({ month })}
                />
                <WheelColumn
                  options={years}
                  selected={draft.year}
                  render={(year) => String(year)}
                  onSelect={(year) => update({ year })}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function WheelColumn({
  options,
  selected,
  render,
  onSelect,
}: {
  options: number[];
  selected: number;
  render: (option: number) => string;
  onSelect: (option: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = options.indexOf(selected);

  // Keeps the wheel aligned when the value is set or clamped from outside
  // (initial open, shorter month, future date).
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || selectedIndex < 0) return;
    if (Math.round(element.scrollTop / ITEM_HEIGHT) !== selectedIndex) {
      element.scrollTop = selectedIndex * ITEM_HEIGHT;
    }
  }, [selectedIndex, options.length]);

  function commitFromScroll() {
    if (!scrollRef.current) return;
    const index = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    if (options[clamped] !== selected) onSelect(options[clamped]);
  }

  return (
    <div
      ref={scrollRef}
      onScroll={() => {
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(commitFromScroll, 120);
      }}
      className="h-[200px] snap-y snap-mandatory overflow-y-auto"
      style={{ scrollPaddingTop: 80, scrollPaddingBottom: 80 }}
    >
      <div style={{ height: 80 }} />
      {options.map((option) => (
        <div
          key={option}
          className={`flex h-10 snap-center items-center justify-center text-[17px] ${
            option === selected ? "font-bold text-hf-black" : "text-hf-black opacity-50"
          }`}
        >
          {render(option)}
        </div>
      ))}
      <div style={{ height: 80 }} />
    </div>
  );
}
