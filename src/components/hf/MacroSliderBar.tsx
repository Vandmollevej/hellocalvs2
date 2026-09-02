"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Adjustable macro bar: slider + text field to override the value.
// Extracted from src/app/voice/page.tsx's MacroBar for reuse in the Add flow.
export function MacroSliderBar({
  label,
  grams,
  max,
  onChange,
}: {
  label: string;
  grams: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const pct = Math.min(100, (grams / max) * 100);
  const trackRef = useRef<HTMLDivElement>(null);
  const gramsRef = useRef(grams);
  const holdIntervalRef = useRef<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(grams));

  useEffect(() => {
    gramsRef.current = grams;
  }, [grams]);

  useEffect(() => stopHold, []);

  function stopHold() {
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }

  function updateFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = (clientX - rect.left) / rect.width;

    if (ratio >= 1) {
      if (holdIntervalRef.current === null) {
        onChange(Math.max(max, gramsRef.current));
        holdIntervalRef.current = window.setInterval(() => {
          onChange(gramsRef.current + 1);
        }, 150);
      }
      return;
    }

    stopHold();
    onChange(Math.max(0, Math.round(ratio * max)));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.buttons === 0) return;
    updateFromPointer(event.clientX);
  }

  function openEditor() {
    setEditValue(String(grams));
    setEditing(true);
  }

  function commitEdit() {
    const parsed = parseFloat(editValue.replace(",", "."));
    if (!Number.isNaN(parsed)) onChange(Math.max(0, Math.round(parsed)));
    setEditing(false);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] text-hf-black opacity-70">{label}</span>
        <button
          type="button"
          onClick={openEditor}
          className="min-w-[36px] rounded px-1 text-right text-base font-bold text-hf-black active:bg-hf-tan-dark"
        >
          {grams} g
        </button>
      </div>
      <div
        ref={trackRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        className="relative flex h-5 touch-none items-center"
      >
        <div className="relative h-1 w-full rounded bg-hf-tan-dark">
          <div className="absolute inset-y-0 left-0 rounded bg-hf-green" style={{ width: `${pct}%` }} />
        </div>
        <div
          className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hf-green bg-hf-white"
          style={{ left: `${pct}%`, top: "50%" }}
        />
      </div>

      {editing &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => setEditing(false)}
          >
            <div onClick={(event) => event.stopPropagation()} className="mb-6 w-[280px] rounded-2xl bg-hf-white p-4 shadow-lg">
              <p className="text-xs font-bold text-hf-black">{label}</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitEdit();
                  }}
                  className="w-full rounded-xl border border-hf-tan-dark px-3 py-2.5 text-lg outline-none focus:border-hf-green"
                />
                <span className="text-sm text-hf-black opacity-70">g</span>
              </div>
              <button
                type="button"
                onClick={commitEdit}
                className="mt-3 w-full rounded-xl bg-hf-green py-2.5 text-sm font-bold text-hf-white"
              >
                Gem
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
