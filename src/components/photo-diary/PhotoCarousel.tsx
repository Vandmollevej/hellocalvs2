"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatPhotoDay, formatPhotoTime, wrapIndex, type DiaryPhoto } from "@/lib/photo-diary";

// Mål fra HelloFresh-appens "Kogebog"-karrusel (brugerens skærmbillede
// 2026-09-25): det høje kort er 160 × 333 pt i en 361 pt bred karrusel
// (393 pt skærm minus 2 × 16 pt gutter) med 16 pt mellem kortene. Så står
// det midterste billede helt, og naboerne på hver side ses kun delvist.
const CARD_WIDTH_PERCENT = (160 / 361) * 100;
const CARD_ASPECT = "160 / 333";
const CARD_GAP_PX = 16;
// Kort der renderes på hver side af det midterste — nok til at dække
// karrusellen, også midt i et træk.
const SIDE_CARDS = 3;
const MAX_STEPS = SIDE_CARDS - 1;
const SETTLE_MS = 300;
const DRAG_START_PX = 6;
const FLICK_PX_PER_MS = 0.3;
const MOMENTUM_MS = 150;
const EDGE_RESISTANCE = 0.3;

type Gesture = {
  pointerId: number;
  startX: number;
  startOffset: number;
  lastX: number;
  lastT: number;
  velocity: number;
  dragging: boolean;
  scale: number;
};

// Vandret karrusel med billederne ældst til venstre og nyest til højre.
// Med 3+ billeder kører den i loop: til højre for det nyeste kommer det
// ældste igen. Kun et vindue af kort omkring midten renderes, så loopet
// ikke kræver kopier af hele listen.
export function PhotoCarousel({
  photos,
  index,
  onIndexChange,
  onOpen,
}: {
  // Ældste først.
  photos: DiaryPhoto[];
  // Billedet i midten.
  index: number;
  onIndexChange: (index: number) => void;
  onOpen: (index: number) => void;
}) {
  const { t } = useTranslation();
  const count = photos.length;
  const loop = count >= 3;

  // `pos` er en virtuel plads, der kan løbe uden for 0…count-1 i loop;
  // billedet er photos[wrapIndex(pos)].
  const [pos, setPos] = useState(index);
  const [syncedIndex, setSyncedIndex] = useState(index);
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const posRef = useRef(pos);
  const offsetRef = useRef(0);
  const gestureRef = useRef<Gesture | null>(null);
  const settleRef = useRef<{ delta: number; timer: number } | null>(null);
  const suppressClickRef = useRef(false);

  // Skifter siden billede udefra (fuldskærmsvisningen, sletning, nyt
  // billede), flyttes midten til den nærmeste plads med det billede.
  if (index !== syncedIndex) {
    setSyncedIndex(index);
    if (count > 0 && wrapIndex(pos, count) !== index) {
      let delta = index - wrapIndex(pos, count);
      if (loop && delta > count / 2) delta -= count;
      if (loop && delta < -count / 2) delta += count;
      setPos(loop ? pos + delta : index);
    }
  }

  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  useEffect(() => {
    return () => {
      if (settleRef.current) window.clearTimeout(settleRef.current.timer);
    };
  }, []);

  function stepPx() {
    const width = viewportRef.current?.offsetWidth ?? 0;
    return (width * CARD_WIDTH_PERCENT) / 100 + CARD_GAP_PX;
  }

  function applyOffset(value: number) {
    offsetRef.current = value;
    setOffset(value);
  }

  function commitSettle(nextOffset = 0) {
    const settle = settleRef.current;
    if (!settle) return;
    window.clearTimeout(settle.timer);
    settleRef.current = null;
    const next = posRef.current + settle.delta;
    posRef.current = next;
    setAnimating(false);
    applyOffset(nextOffset);
    setPos(next);
    if (settle.delta !== 0) onIndexChange(wrapIndex(next, count));
  }

  function settle(delta: number) {
    const target = -delta * stepPx();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    settleRef.current = { delta, timer: window.setTimeout(() => commitSettle(), SETTLE_MS + 60) };
    if (reduceMotion || Math.abs(target - offsetRef.current) < 0.5) {
      commitSettle();
      return;
    }
    setAnimating(true);
    applyOffset(target);
  }

  // Et nyt træk midt i en glidning: gør glidningen færdig med det samme og
  // fortsæt fra der, hvor kortene står lige nu, så intet hopper.
  function interruptSettle(): number {
    const settle = settleRef.current;
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!settle || !track || !viewport) return offsetRef.current;
    const width = viewport.offsetWidth;
    const step = stepPx();
    const baseTranslate = (width * (100 - CARD_WIDTH_PERCENT)) / 200 - SIDE_CARDS * step;
    const visualTranslate = new DOMMatrixReadOnly(getComputedStyle(track).transform).m41;
    const nextOffset = visualTranslate - baseTranslate + settle.delta * step;
    commitSettle(nextOffset);
    return nextOffset;
  }

  function clampDragOffset(raw: number) {
    const step = stepPx();
    if (loop) {
      const limit = (MAX_STEPS - 0.2) * step;
      return Math.max(-limit, Math.min(limit, raw));
    }
    // Uden loop gør kanterne modstand i stedet for at stoppe brat.
    const current = posRef.current;
    const max = current * step;
    const min = -(count - 1 - current) * step;
    if (raw > max) return max + (raw - max) * EDGE_RESISTANCE;
    if (raw < min) return min + (raw - min) * EDGE_RESISTANCE;
    return raw;
  }

  function targetDelta(velocity: number) {
    const step = stepPx();
    const current = offsetRef.current;
    let delta = Math.round(-(current + velocity * MOMENTUM_MS) / step);
    if (delta === 0 && Math.abs(velocity) > FLICK_PX_PER_MS && Math.abs(current) > 10) {
      delta = velocity < 0 ? 1 : -1;
    }
    if (loop) return Math.max(-MAX_STEPS, Math.min(MAX_STEPS, delta));
    const next = Math.max(0, Math.min(count - 1, posRef.current + delta));
    return next - posRef.current;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    suppressClickRef.current = false;
    if (count < 2 || gestureRef.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const startOffset = settleRef.current ? interruptSettle() : offsetRef.current;
    const scale = viewport.getBoundingClientRect().width / viewport.offsetWidth || 1;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      dragging: false,
      scale,
    };

    function onMove(moveEvent: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture || moveEvent.pointerId !== gesture.pointerId) return;
      const dx = (moveEvent.clientX - gesture.startX) / gesture.scale;
      if (!gesture.dragging) {
        if (Math.abs(dx) < DRAG_START_PX) return;
        gesture.dragging = true;
      }
      const dt = moveEvent.timeStamp - gesture.lastT;
      if (dt > 0) gesture.velocity = (moveEvent.clientX - gesture.lastX) / gesture.scale / dt;
      gesture.lastX = moveEvent.clientX;
      gesture.lastT = moveEvent.timeStamp;
      applyOffset(clampDragOffset(gesture.startOffset + dx));
    }

    function onEnd(endEvent: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture || endEvent.pointerId !== gesture.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      gestureRef.current = null;
      // Et stillestående fingertryk til sidst betyder ingen fart.
      const velocity = endEvent.timeStamp - gesture.lastT > 80 ? 0 : gesture.velocity;
      if (gesture.dragging) suppressClickRef.current = true;
      if (endEvent.type === "pointercancel") settle(0);
      else if (gesture.dragging || offsetRef.current !== 0) settle(targetDelta(velocity));
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  }

  function onClickCapture(event: React.MouseEvent) {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (count < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    if (settleRef.current) commitSettle();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    if (!loop) {
      const next = posRef.current + direction;
      if (next < 0 || next > count - 1) return;
    }
    settle(direction);
  }

  if (count === 0) return null;

  const slots: number[] = [];
  for (let v = pos - SIDE_CARDS; v <= pos + SIDE_CARDS; v++) slots.push(v);
  const baseCalc = `${(100 - CARD_WIDTH_PERCENT) / 2}% - ${SIDE_CARDS} * (${CARD_WIDTH_PERCENT}% + ${CARD_GAP_PX}px)`;

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-roledescription="carousel"
      aria-label={t("photoDiary.title")}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
      className="touch-pan-y select-none overflow-hidden [-webkit-touch-callout:none]"
    >
      <div
        ref={trackRef}
        className="flex w-full"
        style={{
          gap: CARD_GAP_PX,
          transform: `translateX(calc(${baseCalc} + ${offset}px))`,
          transition: animating ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)` : "none",
        }}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && event.propertyName === "transform") commitSettle();
        }}
      >
        {slots.map((v) => {
          const inRange = loop || (v >= 0 && v < count);
          const style = { flex: `0 0 ${CARD_WIDTH_PERCENT}%` };
          if (!inRange) return <div key={v} aria-hidden style={style} />;
          const photoIndex = wrapIndex(v, count);
          const photo = photos[photoIndex];
          const isCenter = v === pos;
          return (
            <div key={v} className="flex min-w-0 flex-col gap-2" style={style} aria-hidden={!isCenter}>
              <button
                type="button"
                tabIndex={isCenter ? 0 : -1}
                onClick={() => onOpen(photoIndex)}
                aria-label={`${t("photoDiary.photoAlt")}, ${formatPhotoDay(photo.takenAt)}`}
                className="block w-full overflow-hidden rounded-2xl bg-hf-tan"
                style={{ aspectRatio: CARD_ASPECT }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-full w-full object-cover"
                />
              </button>
              <div>
                <p className="hf-type-card-title truncate">{formatPhotoDay(photo.takenAt)}</p>
                <p className="hf-type-caption">
                  {t("common.clockPrefix")} {formatPhotoTime(photo.takenAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
