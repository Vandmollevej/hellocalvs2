"use client";

import { IconMinus, IconPlus } from "@tabler/icons-react";
import { HfSlider } from "@/components/hf/HfSlider";
import {
  scaleRange,
  type ScreeningInputType,
  type ScreeningScale,
} from "@/lib/screenings";

// Målefeltet til en screening (docs/DECISIONS.md 2026-10-09): knapper, slider,
// inputfelt eller plus/minus. Bruges både i udfyldningsarket og som levende
// forhåndsvisning i oprettelsesflowet. Laveste/højeste værdi står under feltet.
export function ScreeningInput({
  inputType,
  scale,
  minLabel,
  maxLabel,
  value,
  onChange,
  readOnly = false,
}: {
  inputType: ScreeningInputType;
  scale: ScreeningScale;
  minLabel: string;
  maxLabel: string;
  value: number | null;
  onChange: (value: number) => void;
  readOnly?: boolean;
}) {
  const { min, max, step } = scaleRange(scale);
  const suffix = scale === "PERCENT" ? " %" : "";
  const current = value ?? min;
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));

  // Knapper: 1–5 og 1–10 viser hvert trin; procent viser 0, 10, 20 … 100.
  const buttonValues: number[] =
    scale === "PERCENT"
      ? Array.from({ length: 11 }, (_, i) => i * 10)
      : Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-3" aria-disabled={readOnly || undefined}>
      {inputType === "BUTTONS" && (
        <div className="grid grid-cols-5 gap-2">
          {buttonValues.map((option) => (
            <button
              key={option}
              type="button"
              disabled={readOnly}
              aria-pressed={value === option}
              onClick={() => onChange(option)}
              className="hf-choice h-11 px-0"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {inputType === "SLIDER" && (
        <div className="flex flex-col gap-2">
          <p className="hf-type-page-title text-center text-hf-black">
            {value === null ? "–" : `${value}${suffix}`}
          </p>
          <HfSlider value={current} min={min} max={max} step={step} onChange={onChange} aria-label={`${min}–${max}`} />
        </div>
      )}

      {inputType === "INPUT" && (
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          disabled={readOnly}
          value={value ?? ""}
          onChange={(event) => {
            if (event.target.value === "") return;
            onChange(clamp(Number(event.target.value)));
          }}
          className="hf-field hf-type-input w-full rounded-xl border border-hf-field-border bg-hf-page px-4 text-center outline-none"
          placeholder={`${min}–${max}${suffix}`}
        />
      )}

      {inputType === "STEPPER" && (
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            disabled={readOnly || current <= min}
            aria-label="−"
            onClick={() => onChange(clamp(current - step))}
            className="hf-btn-icon"
          >
            <IconMinus size={22} />
          </button>
          <span className="hf-type-page-title min-w-[4ch] text-center text-hf-black">
            {value === null ? "–" : `${value}${suffix}`}
          </span>
          <button
            type="button"
            disabled={readOnly || current >= max}
            aria-label="+"
            onClick={() => onChange(clamp(current + step))}
            className="hf-btn-icon"
          >
            <IconPlus size={22} />
          </button>
        </div>
      )}

      {(minLabel || maxLabel) && (
        <div className="hf-type-small flex justify-between gap-4 text-text-secondary">
          <span>{minLabel}</span>
          <span className="text-right">{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
