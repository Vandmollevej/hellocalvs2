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

type Handle = "wake" | "bedtime";

// Fejlretninger/FEJLLISTE.md #11D, opdateret 2026-09-10 efter brugerens
// eksplicitte krav: ÉN linje pr. dag, der repræsenterer alle 24 timer, med to
// håndtag (stå-op og sengetid) man trækker direkte på samme bane — ikke to
// separate 0-100%-slidere som tidligere (TimeSliderBar).
export function SleepRangeSlider({
  wakeMinutes,
  bedtimeMinutes,
  onChangeWake,
  onChangeBedtime,
}: {
  wakeMinutes: number;
  bedtimeMinutes: number;
  onChangeWake: (value: number) => void;
  onChangeBedtime: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<Handle | null>(null);
  const [editing, setEditing] = useState<Handle | null>(null);
  const [editValue, setEditValue] = useState("");

  const wakePct = (wakeMinutes / MINUTES_PER_DAY) * 100;
  const bedtimePct = (bedtimeMinutes / MINUTES_PER_DAY) * 100;

  function minutesFromClientX(clientX: number) {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    // Snapper til nærmeste kvarter — et minuts præcision er unødvendigt fint
    // for et fingertryk på en bane, der spænder alle 24 timer.
    return Math.min(MINUTES_PER_DAY - 1, Math.round((ratio * MINUTES_PER_DAY) / 15) * 15);
  }

  function updateHandle(handle: Handle, clientX: number) {
    const value = minutesFromClientX(clientX);
    if (handle === "wake") onChangeWake(value);
    else onChangeBedtime(value);
  }

  function handlePointerDown(handle: Handle, event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = handle;
    updateHandle(handle, event.clientX);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const handle = draggingRef.current;
    if (!handle || event.buttons === 0) return;
    updateHandle(handle, event.clientX);
  }

  function handlePointerUp() {
    draggingRef.current = null;
  }

  function startEditing(handle: Handle) {
    setEditValue(formatTime(handle === "wake" ? wakeMinutes : bedtimeMinutes));
    setEditing(handle);
  }

  function commitEdit() {
    if (!editing) return;
    const parsed = parseTime(editValue);
    if (parsed !== null) {
      if (editing === "wake") onChangeWake(parsed);
      else onChangeBedtime(parsed);
    }
    setEditing(null);
  }

  // Sengetid er om aftenen (høj minutværdi) og stå-op er om morgenen (lav
  // minutværdi), så søvnperioden pakker over midnat: markeringen består af to
  // stykker (sengetid→24:00 og 00:00→stå-op), medmindre håndtagene af en
  // eller anden grund er blevet krydset den anden vej.
  const wrapsMidnight = bedtimePct > wakePct;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-0.5">
        {editing === "wake" ? (
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
            onClick={() => startEditing("wake")}
            className="rounded px-1 text-[13px] font-bold text-hf-black active:bg-hf-tan-dark"
          >
            {formatTime(wakeMinutes)}
          </button>
        )}
        {editing === "bedtime" ? (
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
            onClick={() => startEditing("bedtime")}
            className="rounded px-1 text-[13px] font-bold text-hf-black active:bg-hf-tan-dark"
          >
            {formatTime(bedtimeMinutes)}
          </button>
        )}
      </div>

      <div
        ref={trackRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-5 touch-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded bg-hf-tan-dark" />

        {wrapsMidnight ? (
          <>
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-r bg-hf-green"
              style={{ left: `${bedtimePct}%`, right: 0 }}
            />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-l bg-hf-green"
              style={{ left: 0, width: `${wakePct}%` }}
            />
          </>
        ) : (
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded bg-hf-green"
            style={{ left: `${bedtimePct}%`, width: `${wakePct - bedtimePct}%` }}
          />
        )}

        <div
          onPointerDown={(event) => handlePointerDown("bedtime", event)}
          className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-hf-green bg-hf-white"
          style={{ left: `${bedtimePct}%`, top: "50%" }}
        />
        <div
          onPointerDown={(event) => handlePointerDown("wake", event)}
          className="absolute h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-hf-green bg-hf-white"
          style={{ left: `${wakePct}%`, top: "50%" }}
        />
      </div>
    </div>
  );
}
