"use client";

import { useState } from "react";
import { HfSlider } from "@/components/hf/HfSlider";

// Antal personer til en ret: label + tal, der kan trykkes på og skrives
// direkte (samme mønster som gram-tallene i MacroSliderBar), med slideren
// under. Værdien holdes inden for min–max.
export function PersonsSlider({
  label,
  value,
  min = 1,
  max,
  onChange,
  unset = false,
  centered = false,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  // Intet valgt endnu: tallet vises utydeligt. centered: tallet midt for oven.
  unset?: boolean;
  centered?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  function openEditor() {
    setEditValue(String(value));
    setEditing(true);
  }

  function commitEdit() {
    const parsed = parseInt(editValue, 10);
    if (!Number.isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  }

  return (
    <div>
      <div
        className={`mb-2 items-center ${centered ? "grid grid-cols-[1fr_auto_1fr]" : "flex justify-between"}`}
      >
        <span className="hf-type-small text-text-secondary">{label}</span>
        {editing ? (
          <span className="flex items-center rounded bg-hf-white px-1">
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              value={editValue}
              aria-label={label}
              onChange={(event) => setEditValue(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onBlur={commitEdit}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="hf-type-body hf-type-strong w-10 text-right text-hf-black outline-none"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={openEditor}
            aria-label={label}
            className={`hf-type-body hf-type-strong min-w-[36px] rounded px-1 text-hf-black active:bg-hf-tan-dark ${centered ? "text-center" : "text-right"} ${unset ? "opacity-30" : ""}`}
          >
            {value}
          </button>
        )}
        {centered && <span />}
      </div>
      <HfSlider value={value} min={min} max={max} onChange={onChange} aria-label={label} />
    </div>
  );
}
