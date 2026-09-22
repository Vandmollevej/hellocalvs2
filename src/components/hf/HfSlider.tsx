"use client";

import { useRef } from "react";

// Global Hello Cal-slider (én værdi): samme bane, farver og runde 18 px-greb
// som SleepRangeSlider og MacroSliderBar. Brug altid denne i stedet for en
// native <input type="range">, så der kun findes ét sliderdesign i appen.
export function HfSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  "aria-label": ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  "aria-label"?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;

  function clamp(next: number) {
    return Math.min(max, Math.max(min, Math.round((next - min) / step) * step + min));
  }

  function updateFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = clamp(min + ratio * (max - min));
    if (next !== value) onChange(next);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.buttons === 0) return;
    updateFromPointer(event.clientX);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = value + step;
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = value - step;
    else if (event.key === "Home") next = min;
    else if (event.key === "End") next = max;
    if (next === null) return;
    event.preventDefault();
    onChange(clamp(next));
  }

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onKeyDown={handleKeyDown}
      className="relative flex h-5 touch-none items-center outline-none"
    >
      <div className="relative h-1 w-full rounded bg-hf-tan-dark">
        <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${pct}%` }} />
      </div>
      <div
        className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hf-green bg-hf-white"
        style={{ left: `${pct}%`, top: "50%" }}
      />
    </div>
  );
}
