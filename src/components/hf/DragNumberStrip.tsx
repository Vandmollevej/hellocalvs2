"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { sliderHaptic } from "@/lib/haptics";

// Vandret tal-hjul (brugerens krav 2026-10-16): det store tal i et talfelt
// trækkes til siderne. Under trækket vises nabotallene mindre og mere
// utydelige i siderne — samme stil som forsidens tal-hjul (StatsWheel), bare
// vandret, og alle tal står på samme grundlinje som det store tal. Enheden
// (fx "g") skjules, mens hjulet er fremme, og kommer tilbage, når nabotallene
// er faldet ud. Et tryk uden træk virker som før (fx skriv tallet).

/** Nabotal på hver side. */
const SIDE_ITEMS = 3;
/** Fingerbevægelse (px) pr. trin — og afstanden fra midten til første nabo. */
const STEP_PX = 56;
/** Afstanden mellem naboerne bliver lidt mindre udadtil, ligesom de skrumper. */
const SPACING_SHRINK = 5;
/** Skalering pr. trin væk fra midten. */
const SCALE_STEP = 0.18;
/** Hvor langt ude et tal er helt faldet ud. */
const FADE_OUT_AT = SIDE_ITEMS + 0.5;
const FADE_MS = 300;
/** Bevægelse før et træk tæller (så et tryk stadig er et tryk). */
const DRAG_SLOP = 6;

function offsetAt(distance: number) {
  const d = Math.abs(distance);
  return Math.sign(distance) * (STEP_PX * d - SPACING_SHRINK * d * d);
}

export function DragNumberStrip({
  value,
  step,
  min,
  format,
  onChange,
  className = "",
  children,
}: {
  value: number;
  step: number;
  min: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
  /** Den normale visning (tal + enhed), skjult mens hjulet er fremme. */
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<"idle" | "drag" | "fade">("idle");
  const [fraction, setFraction] = useState(0);
  const gesture = useRef<{ id: number; x: number; y: number; start: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: value, dragging: false };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const dx = event.clientX - g.x;
    if (!g.dragging) {
      const dy = event.clientY - g.y;
      if (Math.abs(dx) < DRAG_SLOP || Math.abs(dx) < Math.abs(dy)) {
        if (Math.abs(dy) > DRAG_SLOP) gesture.current = null; // lodret: lad siden scrolle
        return;
      }
      g.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      if (document.activeElement instanceof HTMLElement && event.currentTarget.contains(document.activeElement)) {
        document.activeElement.blur();
      }
      setPhase("drag");
    }
    // Finger til venstre = tallet glider til venstre = større tal ind fra højre.
    const raw = -dx / STEP_PX;
    let whole = Math.round(raw);
    const lowest = Math.ceil((min - g.start) / step);
    let frac = raw - whole;
    if (whole <= lowest) {
      whole = lowest;
      frac = Math.max(0, raw - whole);
    }
    const next = g.start + whole * step;
    setFraction(frac);
    if (next !== value) {
      sliderHaptic();
      onChange(next);
    }
  }

  function endGesture(event: React.PointerEvent<HTMLDivElement>) {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    if (!g.dragging) return;
    suppressClick.current = true;
    setFraction(0);
    setPhase("fade");
    fadeTimer.current = setTimeout(() => setPhase("idle"), FADE_MS);
  }

  const active = phase !== "idle";
  const items: { key: number; distance: number; label: string }[] = [];
  if (active) {
    for (let k = -SIDE_ITEMS; k <= SIDE_ITEMS; k++) {
      const itemValue = value + k * step;
      if (itemValue < min) continue;
      items.push({ key: k, distance: k - fraction, label: format(itemValue) });
    }
  }

  return (
    <div
      className={`relative touch-pan-y select-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <div style={{ visibility: active ? "hidden" : "visible" }}>{children}</div>
      {active && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {items.map(({ key, distance, label }) => {
            const d = Math.abs(distance);
            const scale = 1 - SCALE_STEP * Math.min(d, SIDE_ITEMS);
            const centre = d < 0.5;
            const opacity =
              phase === "fade" && key !== 0 ? 0 : Math.max(0, 1 - d / FADE_OUT_AT) * (centre ? 1 : 0.75);
            return (
              <span
                key={key}
                className={`hf-type-page-title absolute bottom-0 left-1/2 whitespace-nowrap text-hf-black ${
                  phase === "fade" ? "transition-[transform,opacity] ease-out" : ""
                }`}
                style={{
                  transitionDuration: `${FADE_MS}ms`,
                  // Skaleret om grundlinjen (28 px linje: 3 px halv linjeafstand +
                  // ca. 5 px underlængde), så alle tal står på linje med det store.
                  transformOrigin: "50% calc(100% - 8px)",
                  transform: `translateX(-50%) translateX(${offsetAt(distance)}px) scale(${scale})`,
                  opacity,
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
