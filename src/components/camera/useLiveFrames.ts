"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { captureVideoFrame, type Still, type StillCrop } from "@/lib/camera-still";
import {
  FOCUS_SAMPLE_SIZE,
  FocusTracker,
  laplacianVariance,
  meanAbsDifference,
  sampleVideoCenter,
} from "@/lib/focus-detection";

const SAMPLE_INTERVAL_MS = 200;
// Giver brugeren tid til at få varen på plads, før første billede tages.
const ARM_DELAY_MS = 1200;

export type LiveFrame = Still;

// Levende billedtagning (docs/DECISIONS.md 2026-10-02): måler skarphed og
// stilstand i videoens midte og afleverer et videobillede, hver gang varen er
// i fokus og modtageren er klar (`canTake`). Kameraet fryser aldrig; flere
// billeder efter hinanden er meningen. `minProgress` (0–1) er hvor sikker
// fokus-måleren skal være, før et billede tages: 1 = fire stille målinger i
// træk, 0,5 = to. Billedet beskæres evt. til søgerens kvadrat (`crop`) og
// skaleres til højst `maxSide` px (OCR-hastighed). Returnerer fremskridt 0–1
// til rammens indikator.
export function useLiveFrames(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  minProgress: number,
  crop: StillCrop,
  maxSide: number,
  canTake: () => boolean,
  onFrame: (frame: LiveFrame) => void,
): number {
  const [progress, setProgress] = useState(0);
  const callbacks = useRef({ canTake, onFrame });
  useEffect(() => {
    callbacks.current = { canTake, onFrame };
  }, [canTake, onFrame]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement("canvas");
    const tracker = new FocusTracker();
    const armedAt = Date.now() + ARM_DELAY_MS;
    let previous: Float32Array | null = null;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const gray = sampleVideoCenter(video, canvas);
      if (!gray) return;
      const motion = previous ? meanAbsDifference(gray, previous) : Infinity;
      previous = gray;
      const sharpness = laplacianVariance(gray, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE);
      const value = tracker.push({ sharpness, motion });
      setProgress(value);
      if (value < minProgress || Date.now() < armedAt || !callbacks.current.canTake()) return;
      const frame = captureVideoFrame(video, maxSide, crop);
      if (frame) callbacks.current.onFrame({ ...frame, sharpness });
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      setProgress(0);
    };
  }, [enabled, minProgress, crop, maxSide, videoRef]);

  return enabled ? progress : 0;
}
