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
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
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
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
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
              className="w-10 text-right text-base font-bold text-hf-black outline-none"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={openEditor}
            aria-label={label}
            className="min-w-[36px] rounded px-1 text-right text-base font-bold text-hf-black active:bg-hf-tan-dark"
          >
            {value}
          </button>
        )}
      </div>
      <HfSlider value={value} min={min} max={max} onChange={onChange} aria-label={label} />
    </div>
  );
}
