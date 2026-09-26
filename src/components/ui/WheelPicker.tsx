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
  // Værdien der er centreret i hjulet lige nu. Bruges til fed fremhævning
  // mens brugeren scroller, og sendes videre til `onChange` først når
  // arket lukkes (2026-09-24: hvert scroll-stop kaldte før `onChange` med
  // det samme, hvilket gemte til boksen for hver rotation og gjorde arket
  // sløvt/uresponsivt under scroll).
  const [pendingValue, setPendingValue] = useState<number | null>(value);
  const options: number[] = [];
  for (let n = max; n >= min; n -= 1) options.push(n);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const target = value ?? initialScrollValue ?? options[Math.floor(options.length / 2)];
    setPendingValue(target);
    const index = options.indexOf(target);
    if (index >= 0) {
      const raf = requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = index * ITEM_HEIGHT;
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function commitFromScroll() {
    if (!scrollRef.current) return;
    const index = Math.round(scrollRef.current.scrollTop / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    setPendingValue(options[clamped]);
  }

  function handleDone() {
    if (pendingValue !== null) onChange(pendingValue);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hf-type-body flex items-center rounded-xl bg-hf-tan px-4 py-3 text-left text-hf-black"
      >
        {value !== null ? `${value}${unit ? ` ${unit}` : ""}` : "Vælg"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex flex-col justify-end bg-hf-black/40"
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
              <span className="hf-type-body hf-type-strong text-hf-black">{label}</span>
              <button
                type="button"
                onClick={handleDone}
                className="hf-type-body hf-type-strong text-hf-green"
              >
                Færdig
              </button>
            </div>
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 rounded-lg bg-hf-tan"
                aria-hidden="true"
              />
              <div
                ref={scrollRef}
                onScroll={() => {
                  if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
                  scrollTimeout.current = setTimeout(commitFromScroll, 120);
                }}
                className="relative z-10 h-[200px] snap-y snap-mandatory overflow-y-auto"
                style={{ scrollPaddingTop: 80, scrollPaddingBottom: 80 }}
              >
                <div style={{ height: 80 }} />
                {options.map((option) => (
                  <div
                    key={option}
                    className={`hf-type-body-lg flex h-10 snap-center items-center justify-center ${
                      option === pendingValue ? "hf-type-strong text-hf-black" : "text-hf-black opacity-50"
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
