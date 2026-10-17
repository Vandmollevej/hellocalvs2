"use client";

import { useEffect, useState } from "react";

// Fælles visningsvælger (2/4/12 firkanter = 1/2/12 varer pr. side) for alle
// billedsider i admin: Billedforslag, Logoer og Dubletter. Valget huskes pr.
// side i browseren.

export const REVIEW_SIZES = [
  { squares: 2, perPage: 1, label: "2 firkanter: én vare pr. side i fuld størrelse" },
  { squares: 4, perPage: 2, label: "4 firkanter: to varer pr. side" },
  { squares: 12, perPage: 12, label: "12 firkanter: tolv varer pr. side (4 kolonner, 3 rækker)" },
] as const;

export function useReviewSize(storageKey: string) {
  const [sizeIdx, setSizeIdx] = useState(2);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const saved = Number(raw);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- husket valg (kun i browseren)
      if (raw !== null && saved >= 0 && saved <= 2) setSizeIdx(saved);
    } catch {}
  }, [storageKey]);

  const choose = (idx: number) => {
    setSizeIdx(idx);
    try {
      window.localStorage.setItem(storageKey, String(idx));
    } catch {}
  };

  return { sizeIdx, perPage: REVIEW_SIZES[sizeIdx].perPage, choose };
}

function SizeIcon({ squares }: { squares: number }) {
  const cols = squares >= 12 ? 4 : 2;
  const rows = squares / cols;
  const gap = squares >= 12 ? 1.5 : rows > 2 ? 1.5 : 2.5;
  const side = Math.min((24 - gap * (cols - 1)) / cols, (24 - gap * (rows - 1)) / rows);
  const top = (24 - (rows * side + (rows - 1) * gap)) / 2;
  const left = (24 - (cols * side + (cols - 1) * gap)) / 2;
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      {Array.from({ length: squares }).map((_, i) => (
        <rect key={i} x={left + (i % cols) * (side + gap)} y={top + Math.floor(i / cols) * (side + gap)} width={side} height={side} rx={1} />
      ))}
    </svg>
  );
}

export function ReviewSizePicker({ sizeIdx, onChoose }: { sizeIdx: number; onChoose: (idx: number) => void }) {
  return (
    <div className="hf-pick-size" role="group" aria-label="Størrelse">
      {REVIEW_SIZES.map((size, idx) => (
        <button
          key={size.squares}
          type="button"
          title={size.label}
          aria-label={size.label}
          aria-pressed={sizeIdx === idx}
          onClick={() => onChoose(idx)}
          className="hf-choice hf-choice--icon"
        >
          <SizeIcon squares={size.squares} />
        </button>
      ))}
    </div>
  );
}
