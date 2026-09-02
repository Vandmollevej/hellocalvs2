"use client";

import { useEffect, useRef, useState } from "react";

const ITEM_HEIGHT = 40;

// iOS-style scroll-wheel picker (item 9, 2026-09-02): used for fødselsår and
// højde instead of a plain number input. Shows "Vælg" until a value is
// picked, and opens scrolled to `initialScrollValue` (1990 for birth year).
export function WheelPicker({
  label,
  value,
  min,
  max,
  unit,
  initialScrollValue,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  unit?: string;
  initialScrollValue?: number;
  onChange: (value: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: number[] = [];
  for (let n = max; n >= min; n -= 1) options.push(n);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const target = value ?? initialScrollValue ?? options[Math.floor(options.length / 2)];
    const index = options.indexOf(target);
    if (index >= 0) {
      scrollRef.current.scrollTop = index * ITEM_HEIGHT;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function commitFromScroll() {
    if (!scrollRef.current) return;
    const index = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    onChange(options[clamped]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center rounded-xl bg-hf-tan px-4 py-3 text-left text-[15px] text-hf-black"
      >
        {value !== null ? `${value}${unit ? ` ${unit}` : ""}` : "Vælg"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Luk"
            className="flex-1"
            onClick={() => setOpen(false)}
          />
          <div className="rounded-t-2xl bg-hf-cream pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[15px] font-bold text-hf-black">{label}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                      option === value ? "font-bold text-hf-black" : "text-hf-black opacity-50"
                    }`}
                  >
                    {option}
                    {unit ? ` ${unit}` : ""}
                  </div>
                ))}
                <div style={{ height: 80 }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
