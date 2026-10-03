"use client";

import { IconCheck } from "@tabler/icons-react";

// Hvid afkrydsningsboks i billedets øverste højre hjørne. Forælderen skal
// være `relative`. Valgt viser boksen nummeret (1 = før, 2 = efter), eller et
// flueben uden nummer.
export function PhotoSelectBox({
  checked,
  number,
  label,
  onToggle,
  tabIndex,
  disabled,
}: {
  checked: boolean;
  number?: number;
  label: string;
  onToggle?: () => void;
  tabIndex?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={tabIndex}
      disabled={disabled}
      onClick={(event) => {
        // Kortet under boksen åbner fuldskærm — det skal et flueben ikke.
        event.stopPropagation();
        onToggle?.();
      }}
      className="hf-photo-check"
    >
      <span className="hf-photo-check__box" aria-hidden>
        {checked ? number ?? <IconCheck size={16} stroke={3} /> : null}
      </span>
    </button>
  );
}
