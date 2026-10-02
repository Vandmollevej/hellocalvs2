import { FOCUS_SAMPLE_SIZE, laplacianVariance, sampleVideoCenter } from "@/lib/focus-detection";

// Bedste-af-tre (brugerens krav 2026-10-02: tiden under scanningen skal
// bruges på et bedre billede, ikke kun på animation). Browseren giver ingen
// eksponeringsstyring på iPhone, så ægte HDR-bracketing er ikke muligt; i
// stedet tages tre billeder lige efter hinanden, og det skarpeste (højeste
// Laplace-varians i midten) bruges. Tone-udjævningen sker i billedrobotten
// (scripts/image-agent/cutout.py: auto_exposure + level_lighting).

export type BurstFrame = { url: string; width: number; height: number; sharpness: number };

const BURST_COUNT = 3;
const BURST_GAP_MS = 70;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement, sample: HTMLCanvasElement): BurstFrame | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const gray = sampleVideoCenter(video, sample);
  const sharpness = gray ? laplacianVariance(gray, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE) : 0;
  return { url: canvas.toDataURL("image/jpeg", 0.92), width: canvas.width, height: canvas.height, sharpness };
}

// Hele videobilledet i fuld opløsning — bevidst ingen beskæring
// (docs/DECISIONS.md 2026-09-17). Tager BURST_COUNT billeder og returnerer
// det skarpeste; fejler et enkelt, bruges de øvrige.
export async function captureBestFrame(video: HTMLVideoElement | null): Promise<BurstFrame | null> {
  if (!video) return null;
  const canvas = document.createElement("canvas");
  const sample = document.createElement("canvas");
  let best: BurstFrame | null = null;
  for (let index = 0; index < BURST_COUNT; index++) {
    if (index > 0) await wait(BURST_GAP_MS);
    const frame = grabFrame(video, canvas, sample);
    if (frame && (!best || frame.sharpness > best.sharpness)) best = frame;
  }
  return best;
}
