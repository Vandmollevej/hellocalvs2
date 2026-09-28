// Levende omrids om varen i kameraets midte (docs/DECISIONS.md 2026-09-28).
// MediaPipes InteractiveSegmenter ("magic touch") kører på telefonen: den får
// et nedskaleret, kvadratisk udsnit af videoen og et "positivt punkt" midt i
// billedet og svarer med en maske for det objekt, punktet rammer. Masken
// udglattes over tid og tegnes som en hvid streg, der følger varens kontur.
// Biblioteket hentes først, når kameraet bruges (CDN, ikke i app-bundlen).

const MEDIAPIPE_VERSION = "1.0.1";
const MEDIAPIPE_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/latest/interactive_segmentation.task";

// Kanten af udsnittet, der analyseres (px). Lille = hurtigt på telefonen.
export const OUTLINE_INPUT_SIZE = 320;
// Andel af billedet, masken skal fylde, for at stregen vises: under er det
// støj, over er det bordet/baggrunden, ikke en vare.
const MIN_AREA = 0.01;
const MAX_AREA = 0.8;
// Vægt på den nye maske i udglatningen (resten er de forrige billeder).
const SMOOTHING = 0.55;

type MpMask = {
  readonly width: number;
  readonly height: number;
  getAsFloat32Array(): Float32Array;
  close(): void;
};

type MpSegmenter = {
  setImage(image: TexImageSource): void;
  segment(strokes: readonly unknown[]): MpMask;
  close(): void;
};

type MpVision = {
  FilesetResolver: { forVisionTasks(basePath?: string): Promise<unknown> };
  InteractiveSegmenter: {
    createFromOptions(fileset: unknown, options: Record<string, unknown>): Promise<MpSegmenter>;
  };
};

const BRUSH_POSITIVE = 1;
const CENTER_STROKE = [{ brushMode: BRUSH_POSITIVE, point: [{ x: 0.5, y: 0.5 }], isCompleted: true }];

let segmenterPromise: Promise<MpSegmenter> | null = null;

async function createSegmenter(): Promise<MpSegmenter> {
  const url = `${MEDIAPIPE_BASE}/vision_bundle.mjs`;
  const vision = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)) as MpVision;
  const fileset = await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE_BASE}/wasm`);
  try {
    return await vision.InteractiveSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    });
  } catch {
    return vision.InteractiveSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
    });
  }
}

// Én segmenter pr. side — den genbruges mellem trinnene og kameraåbninger.
export function loadOutlineSegmenter(): Promise<MpSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = createSegmenter().catch((error) => {
      segmenterPromise = null;
      throw error;
    });
  }
  return segmenterPromise;
}

// Det kvadratiske midterudsnit af videoen — præcis det, kamerafeltet viser
// (object-cover i en kvadratisk boks).
export function drawCenterSquare(video: HTMLVideoElement, target: HTMLCanvasElement): boolean {
  const { videoWidth: width, videoHeight: height } = video;
  if (!width || !height) return false;
  const side = Math.min(width, height);
  target.width = OUTLINE_INPUT_SIZE;
  target.height = OUTLINE_INPUT_SIZE;
  const ctx = target.getContext("2d");
  if (!ctx) return false;
  ctx.drawImage(video, (width - side) / 2, (height - side) / 2, side, side, 0, 0, OUTLINE_INPUT_SIZE, OUTLINE_INPUT_SIZE);
  return true;
}

export type OutlineMask = { width: number; height: number; values: Float32Array };

// Kører modellen og udglatter med den forrige maske. null = intet brugbart
// objekt i midten (for lille, for stort eller punktet rammer ikke noget).
export function segmentCenter(
  segmenter: MpSegmenter,
  input: HTMLCanvasElement,
  previous: OutlineMask | null,
): OutlineMask | null {
  segmenter.setImage(input);
  const mask = segmenter.segment(CENTER_STROKE);
  try {
    const { width, height } = mask;
    const raw = mask.getAsFloat32Array();
    const values = new Float32Array(raw.length);
    const blend = previous && previous.width === width && previous.height === height ? previous.values : null;
    let area = 0;
    for (let index = 0; index < raw.length; index++) {
      const value = blend ? SMOOTHING * raw[index] + (1 - SMOOTHING) * blend[index] : raw[index];
      values[index] = value;
      if (value > 0.5) area++;
    }
    const center = values[Math.floor(height / 2) * width + Math.floor(width / 2)];
    const fraction = area / (width * height);
    if (center < 0.5 || fraction < MIN_AREA || fraction > MAX_AREA) return null;
    return { width, height, values };
  } finally {
    mask.close();
  }
}

// Tegner masken som en ring (udvidet maske minus selve masken) i hvidt med
// en let skygge, så stregen også ses mod lyse baggrunde.
export function drawOutline(mask: OutlineMask, target: HTMLCanvasElement, strokePx: number) {
  const ctx = target.getContext("2d");
  if (!ctx) return;
  const shape = document.createElement("canvas");
  shape.width = mask.width;
  shape.height = mask.height;
  const shapeCtx = shape.getContext("2d");
  if (!shapeCtx) return;
  const image = shapeCtx.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.values.length; index++) {
    // Blød kant omkring 0,5, så den opskalerede streg ikke bliver trappet.
    const alpha = Math.min(1, Math.max(0, (mask.values[index] - 0.35) / 0.3));
    const offset = index * 4;
    image.data[offset] = 255;
    image.data[offset + 1] = 255;
    image.data[offset + 2] = 255;
    image.data[offset + 3] = Math.round(alpha * 255);
  }
  shapeCtx.putImageData(image, 0, 0);

  const ring = document.createElement("canvas");
  ring.width = target.width;
  ring.height = target.height;
  const ringCtx = ring.getContext("2d");
  if (!ringCtx) return;
  ringCtx.imageSmoothingEnabled = true;
  ringCtx.imageSmoothingQuality = "high";
  const steps = 16;
  for (let step = 0; step < steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    ringCtx.drawImage(shape, Math.cos(angle) * strokePx, Math.sin(angle) * strokePx, ring.width, ring.height);
  }
  ringCtx.globalCompositeOperation = "destination-out";
  ringCtx.drawImage(shape, 0, 0, ring.width, ring.height);

  ctx.clearRect(0, 0, target.width, target.height);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = strokePx * 2;
  ctx.drawImage(ring, 0, 0);
  ctx.restore();
}
