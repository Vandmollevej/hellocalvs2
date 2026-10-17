"use client";

import { useState } from "react";

// Tallet over en slider (brugerregel 2026-10-17): ser ud som almindelig tekst,
// indtil man trykker på det. Så får det hvid baggrund, og taltastaturet kommer
// frem, så værdien kan skrives præcist. Enter/tryk væk gemmer.
export function TapNumberInput({
  value,
  display,
  unit,
  min,
  max,
  decimals = 0,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: {
  value: number | null;
  // Tekst der vises, når feltet ikke redigeres (fx "325 ml"). Standard: tal + enhed.
  display?: string;
  unit?: string;
  min?: number;
  max?: number;
  decimals?: number;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const format = (n: number) => n.toFixed(decimals).replace(".", ",");
  const text = display ?? (value === null ? "–" : `${format(value)}${unit ? ` ${unit}` : ""}`);

  function commit() {
    const parsed = Number(draft.trim().replace(",", "."));
    if (draft.trim() !== "" && Number.isFinite(parsed)) {
      let next = Number(parsed.toFixed(decimals));
      if (min !== undefined) next = Math.max(min, next);
      if (max !== undefined) next = Math.min(max, next);
      onChange(next);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <span className={`inline-flex items-baseline gap-1 rounded-lg bg-hf-white px-1.5 ${className}`}>
        <input
          autoFocus
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          aria-label={ariaLabel}
          value={draft}
          size={Math.max(2, draft.length + 1)}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
          onBlur={commit}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="min-w-0 bg-transparent text-right outline-none [color:inherit] [font:inherit]"
        />
        {unit && <span>{unit}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        setDraft(value === null ? "" : format(value));
        setEditing(true);
      }}
      className={className}
    >
      {text}
    </button>
  );
}
