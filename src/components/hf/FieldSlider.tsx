"use client";

import { HfSlider } from "@/components/hf/HfSlider";

// Slider til et talfelt der gemmer sin værdi som tekst (global regel
// 2026-10-16: intet talfelt uden slider). Tomt felt vises i bunden af banen.
export function FieldSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  "aria-label": ariaLabel,
}: {
  value: string | number | null | undefined;
  min: number;
  max: number;
  step?: number;
  onChange: (value: string) => void;
  onCommit?: () => void;
  "aria-label"?: string;
}) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  const current = Number.isFinite(parsed) && String(value ?? "") !== "" ? Math.min(max, Math.max(min, parsed)) : min;
  return (
    <HfSlider
      value={current}
      min={min}
      max={max}
      step={step}
      onChange={(next) => onChange(String(next))}
      onCommit={onCommit}
      aria-label={ariaLabel}
    />
  );
}
