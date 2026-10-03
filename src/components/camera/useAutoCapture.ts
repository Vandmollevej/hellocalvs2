"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  FOCUS_SAMPLE_SIZE,
  FocusTracker,
  laplacianVariance,
  meanAbsDifference,
  sampleVideoCenter,
} from "@/lib/focus-detection";

const SAMPLE_INTERVAL_MS = 200;
// Giver brugeren tid til at få varen på plads, før vi må udløse.
const ARM_DELAY_MS = 1200;
// Sidste udvej: uanset skarphed og bevægelse tages billedet efter så lang
// tid — der er ingen "Tag billede"-knap (brugerens krav 2026-10-02).
const MAX_WAIT_MS = 8000;

// Måler fokus løbende og kalder onFocused én gang, når varen er skarp og stille.
// Returnerer fremskridt 0–1 til en visuel indikator.
export function useAutoCapture(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  onFocused: () => void,
): number {
  const [progress, setProgress] = useState(0);
  const onFocusedRef = useRef(onFocused);
  useEffect(() => {
    onFocusedRef.current = onFocused;
  }, [onFocused]);

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement("canvas");
    const tracker = new FocusTracker();
    const armedAt = Date.now() + ARM_DELAY_MS;
    let previous: Float32Array | null = null;
    let fired = false;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (fired || !video) return;
      const gray = sampleVideoCenter(video, canvas);
      if (!gray) return;
      const motion = previous ? meanAbsDifference(gray, previous) : Infinity;
      previous = gray;
      const value = tracker.push({
        sharpness: laplacianVariance(gray, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE),
        motion,
      });
      setProgress(value);
      const now = Date.now();
      if ((value >= 1 && now >= armedAt) || now >= armedAt + MAX_WAIT_MS) {
        fired = true;
        onFocusedRef.current();
      }
    }, SAMPLE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      setProgress(0);
    };
  }, [enabled, videoRef]);

  return enabled ? progress : 0;
}
