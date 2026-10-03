"use client";

import { useState } from "react";

// Mængdetekst man kan trykke direkte i og overskrive med et antal gram —
// samme tryk-for-at-redigere-mønster som MacroSliderBar.
export function InlineGramsInput({
  label,
  grams,
  onChange,
  className = "",
}: {
  label: string;
  grams: number;
  onChange: (grams: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(grams));

  function commit() {
    const parsed = parseFloat(editValue.replace(",", "."));
    if (!Number.isNaN(parsed) && parsed > 0) onChange(Math.round(parsed));
    setEditing(false);
  }

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 rounded bg-hf-white px-1 ${className}`}>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          value={editValue}
          onChange={(event) => setEditValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-12 bg-transparent text-right font-semibold text-hf-black outline-none"
        />
        <span className="font-semibold text-hf-black">g</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        setEditValue(String(grams));
        setEditing(true);
      }}
      className={`rounded underline decoration-dotted underline-offset-2 active:bg-hf-tan-dark ${className}`}
    >
      {label}
    </button>
  );
}
