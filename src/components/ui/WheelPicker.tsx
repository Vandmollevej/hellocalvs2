"use client";

import { useEffect, useState } from "react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useWheelSnap } from "./useWheelSnap";

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

  const { scrollRef } = useWheelSnap(ITEM_HEIGHT, commitFromScroll, open);

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

  function commitFromScroll(index: number) {
    const clamped = Math.max(0, Math.min(options.length - 1, index));
    setPendingValue(options[clamped]);
  }

  // Arket lukker selv (glid ud) via BottomSheetCloseButton; her gemmes kun værdien.
  function handleDone() {
    if (pendingValue !== null) onChange(pendingValue);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hf-type-body hf-field flex items-center rounded-xl bg-hf-tan px-4 text-left text-hf-black"
      >
        {value !== null ? `${value}${unit ? ` ${unit}` : ""}` : "Vælg"}
      </button>

      {/* Bundark (KRAV.md): portales til <body> af BottomSheet, så tryk på
          "Færdig" aldrig sendes videre til åbne-knappen, når hjulet ligger i
          et <label> (Profil, 2026-10-03). Swipe ned/scrim = annullér: værdien
          gemmes kun med "Færdig". */}
      {open && (
        <BottomSheet ariaLabel={label} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 px-4 pb-4">
            <div data-sheet-no-drag className="relative">
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-10 -translate-y-1/2 rounded-lg bg-hf-tan"
                aria-hidden="true"
              />
              <div
                ref={scrollRef}
                className="relative z-10 h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain"
                style={{ scrollPaddingTop: ITEM_HEIGHT * 2, scrollPaddingBottom: ITEM_HEIGHT * 2 }}
              >
                <div style={{ height: ITEM_HEIGHT * 2 }} />
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
                <div style={{ height: ITEM_HEIGHT * 2 }} />
              </div>
            </div>
            <BottomSheetCloseButton onClick={handleDone} className="hf-control hf-btn-primary w-full px-4">
              Færdig
            </BottomSheetCloseButton>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
