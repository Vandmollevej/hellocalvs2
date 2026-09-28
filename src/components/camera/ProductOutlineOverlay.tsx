"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  drawCenterSquare,
  drawOutline,
  loadOutlineSegmenter,
  segmentCenter,
  type OutlineMask,
} from "@/lib/product-outline";
import { scanLog } from "@/lib/scan-debug-log";

// Hvid streg, der følger konturen af varen midt i kameraet, mens brugeren
// sigter (docs/DECISIONS.md 2026-09-28). Logikken ligger i
// src/lib/product-outline.ts; her styres kun takt, synlighed og tegning.

// Mindste pause mellem analyserne — nok til at stregen følger med uden at
// tage al telefonens kraft fra kameraet.
const FRAME_GAP_MS = 120;
// Så mange tomme svar i træk, før stregen fader ud (undgår blink).
const MISSES_BEFORE_HIDE = 3;
const CANVAS_SIZE = 640;
const STROKE_PX = 4;

export function ProductOutlineOverlay({
  videoRef,
  active,
  flowId,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  flowId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const input = document.createElement("canvas");
    let previous: OutlineMask | null = null;
    let misses = 0;

    loadOutlineSegmenter()
      .then((segmenter) => {
        if (cancelled) return;
        const tick = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const startedAt = performance.now();
          if (video && canvas && drawCenterSquare(video, input)) {
            try {
              const mask = segmentCenter(segmenter, input, previous);
              if (mask) {
                previous = mask;
                misses = 0;
                drawOutline(mask, canvas, STROKE_PX);
                setVisible(true);
              } else if (++misses >= MISSES_BEFORE_HIDE) {
                previous = null;
                setVisible(false);
              }
            } catch {
              setVisible(false);
            }
          }
          // Analysen kører på hovedtråden: på en langsom telefon venter vi
          // mindst dobbelt så længe, som den tog, så tryk stadig reagerer.
          const gap = Math.max(FRAME_GAP_MS, 2 * (performance.now() - startedAt));
          timer = setTimeout(() => requestAnimationFrame(tick), gap);
        };
        tick();
      })
      .catch((error) => {
        if (cancelled) return;
        scanLog(flowId, "outline_unavailable", {
          level: "warn",
          message: "Omridset om varen kunne ikke starte (genkendelsen blev ikke indlæst)",
          data: { error: String(error).slice(0, 300) },
        });
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setVisible(false);
    };
  }, [active, videoRef, flowId]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-200"
      style={{ opacity: active && visible ? 1 : 0 }}
    />
  );
}
