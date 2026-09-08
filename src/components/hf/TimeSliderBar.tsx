"use client";

import { useRef, useState } from "react";

const MINUTES_PER_DAY = 24 * 60;

function formatTime(minutes: number) {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function parseTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

// Fejlretninger/FEJLLISTE.md #11D: samme slider-sprog som
// MacroSliderBar (tynd bane, grøn fyldning, hvid/grøn cirkel-håndtag) —
// genbrugt her til klokkeslæt (0-1439 minutter) i stedet for gram.
// Værdien vises som tekst UDENFOR selve sliderens ende (venstre for en
// "stå op"-slider, højre for en "sengetid"-slider), jf. brugerens eksplicitte
// layout-krav, i stedet for MacroSliderBar's værdi-ovenpå-sliderens layout.
export function TimeSliderBar({
  minutes,
  onChange,
  labelSide,
}: {
  minutes: number;
  onChange: (value: number) => void;
  labelSide: "left" | "right";
}) {
  const pct = (minutes / MINUTES_PER_DAY) * 100;
  const trackRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(formatTime(minutes));

  function updateFromPointer(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    // Snapper til nærmeste kvarter — et minuts præcision er unødvendigt fint
    // for et fingertryk på en 402px-bred bane.
    const snapped = Math.round((ratio * MINUTES_PER_DAY) / 15) * 15;
    onChange(Math.min(MINUTES_PER_DAY - 1, snapped));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.buttons === 0) return;
    updateFromPointer(event.clientX);
  }

  function commitEdit() {
    const parsed = parseTime(editValue);
    if (parsed !== null) onChange(parsed);
    else setEditValue(formatTime(minutes));
    setEditing(false);
  }

  const valueDisplay = editing ? (
    <input
      autoFocus
      inputMode="numeric"
      value={editValue}
      onChange={(event) => setEditValue(event.target.value)}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={commitEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      className="w-12 rounded bg-hf-white text-center text-[13px] font-bold text-hf-black outline-none"
    />
  ) : (
    <button
      type="button"
      onClick={() => {
        setEditValue(formatTime(minutes));
        setEditing(true);
      }}
      className="rounded px-1 text-[13px] font-bold text-hf-black active:bg-hf-tan-dark"
    >
      {formatTime(minutes)}
    </button>
  );

  const track = (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className="relative flex h-5 flex-1 touch-none items-center"
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

  return (
    <div className="flex items-center gap-2">
      {labelSide === "left" && valueDisplay}
      {track}
      {labelSide === "right" && valueDisplay}
    </div>
  );
}
