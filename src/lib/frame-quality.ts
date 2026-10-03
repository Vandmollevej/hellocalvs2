// Lys- og fokusvurdering af kamerabilledet (docs/DECISIONS.md 2026-10-02):
// gennemsnitlig lysstyrke og skarphed (Laplace-varians, samme mål som
// automatisk fotografering) i midten af billedet. Et problem meldes først,
// når det har stået på et stykke tid, så teksten ikke blinker.

import { laplacianVariance } from "@/lib/focus-detection";

export type FrameIssue = "dark" | "blurry";

// Gennemsnitlig luminans (0–255), under hvilken billedet regnes for underbelyst.
const DARK_MEAN_LUMINANCE = 60;
// Skarphed under dette regnes for ude af fokus (MIN_SHARPNESS i focus-detection er 60).
const BLURRY_SHARPNESS = 40;
// Et næsten ensfarvet billede (fx en væg) har lav skarphed uden at være ude
// af fokus — her meldes intet.
const MIN_CONTRAST_STDDEV = 12;
const ISSUE_HOLD_MS = 1500;

export function assessFrame(gray: Float32Array, width: number, height: number): FrameIssue | null {
  if (!gray.length) return null;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < gray.length; i++) {
    sum += gray[i];
    sumSq += gray[i] * gray[i];
  }
  const mean = sum / gray.length;
  if (mean < DARK_MEAN_LUMINANCE) return "dark";
  const stddev = Math.sqrt(Math.max(0, sumSq / gray.length - mean * mean));
  if (stddev < MIN_CONTRAST_STDDEV) return null;
  if (laplacianVariance(gray, width, height) < BLURRY_SHARPNESS) return "blurry";
  return null;
}

// Melder kun et problem, der har stået uændret i ISSUE_HOLD_MS.
export class FrameIssueTracker {
  private candidate: FrameIssue | null = null;
  private since = 0;

  push(issue: FrameIssue | null, now: number): FrameIssue | null {
    if (issue !== this.candidate) {
      this.candidate = issue;
      this.since = now;
    }
    return issue && now - this.since >= ISSUE_HOLD_MS ? issue : null;
  }
}
