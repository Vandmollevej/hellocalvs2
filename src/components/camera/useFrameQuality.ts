"use client";

import { useEffect, useState, type RefObject } from "react";
import { FOCUS_SAMPLE_SIZE, sampleVideoCenter } from "@/lib/focus-detection";
import { assessFrame, FrameIssueTracker, type FrameIssue } from "@/lib/frame-quality";

const SAMPLE_INTERVAL_MS = 300;

// Vurderer løbende lys og fokus i kamerabilledet; returnerer et vedvarende
// problem ("dark"/"blurry") eller null.
export function useFrameQuality(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): FrameIssue | null {
  const [issue, setIssue] = useState<FrameIssue | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = document.createElement("canvas");
    const tracker = new FrameIssueTracker();
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      const gray = sampleVideoCenter(video, canvas);
      if (!gray) return;
      const next = tracker.push(assessFrame(gray, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE), Date.now());
      setIssue((current) => (current === next ? current : next));
    }, SAMPLE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      setIssue(null);
    };
  }, [enabled, videoRef]);

  return enabled ? issue : null;
}
