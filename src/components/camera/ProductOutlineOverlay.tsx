"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  drawCenterSquare,
  drawFill,
  drawOutline,
  loadOutlineSegmenter,
  segmentCenter,
  type OutlineMask,
} from "@/lib/product-outline";
import { scanLog } from "@/lib/scan-debug-log";

// Hvid streg, der følger konturen af varen midt i kameraet, mens brugeren
// sigter (docs/DECISIONS.md 2026-09-28). Logikken ligger i
// src/lib/product-outline.ts; her styres kun takt, synlighed og tegning.
// Med `fill` (docs/DECISIONS.md 2026-10-02) stopper analysen, og den sidst
// fundne kontur fyldes helt hvid — varen "står hvid" et øjeblik, når et trin
// er klaret. Findes ingen kontur, fyldes midterrammen i stedet.

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
  fill,
  flowId,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  active: boolean;
  fill: boolean;
  flowId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<OutlineMask | null>(null);
  const [visible, setVisible] = useState(false);
  // Om der findes en kontur at fylde — holdes adskilt fra `visible`, som
  // slukkes, når analysen stopper (det sker netop, når udfyldningen vises).
  const [hasMask, setHasMask] = useState(false);
  const filled = fill ? (hasMask ? "mask" : "frame") : null;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const input = document.createElement("canvas");
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
              const mask = segmentCenter(segmenter, input, maskRef.current);
              if (mask) {
                maskRef.current = mask;
                misses = 0;
                drawOutline(mask, canvas, STROKE_PX);
                setHasMask(true);
                setVisible(true);
              } else if (++misses >= MISSES_BEFORE_HIDE) {
                maskRef.current = null;
                setHasMask(false);
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

  // Udfyldningen tegnes af den kontur, der sidst blev set; findes ingen,
  // fyldes midterrammen i stedet (ren DOM-tegning, ingen state).
  useEffect(() => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (filled === "mask" && canvas && mask) drawFill(mask, canvas);
  }, [filled]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        aria-hidden
        className={`pointer-events-none absolute inset-0 h-full w-full ${filled === "mask" ? "hf-scan-fill" : "transition-opacity duration-200"}`}
        style={{ opacity: filled === "mask" ? undefined : active && visible ? 1 : 0 }}
      />
      {filled === "frame" && <div aria-hidden className="hf-scan-fill pointer-events-none absolute inset-[12%] bg-hf-white rounded-card" />}
    </>
  );
}
