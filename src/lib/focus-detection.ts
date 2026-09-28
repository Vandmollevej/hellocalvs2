// Automatisk fotografering: måler skarphed (varians af Laplace-filter) og
// bevægelse (forskel mellem to billeder) i midten af videobilledet. Når
// billedet er skarpt og stillestående i nogle målinger i træk, er varen i fokus.

const SAMPLE_SIZE = 160;
// Andel af billedets bredde/højde der måles på (varen ligger i rammen i midten).
const CENTER_FRACTION = 0.76;
const MIN_SHARPNESS = 60;
// Skarpheden skal være tæt på den bedste set, så vi ikke tager billedet midt i fokuseringen.
const RELATIVE_SHARPNESS = 0.8;
const MAX_MOTION = 6;
const REQUIRED_STABLE_SAMPLES = 4;

export type FocusSample = { sharpness: number; motion: number };

export function grayscale(data: Uint8ClampedArray): Float32Array {
  const gray = new Float32Array(data.length / 4);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return gray;
}

export function laplacianVariance(gray: Float32Array, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const value = gray[i - width] + gray[i + width] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      sum += value;
      sumSq += value * value;
      count++;
    }
  }
  if (!count) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

export function meanAbsDifference(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || !a.length) return Infinity;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

// Holder styr på målingerne og afgør, hvornår billedet skal tages.
export class FocusTracker {
  private bestSharpness = 0;
  private stableCount = 0;

  reset() {
    this.bestSharpness = 0;
    this.stableCount = 0;
  }

  // Returnerer fremskridt 0–1; 1 betyder "i fokus — tag billedet nu".
  push({ sharpness, motion }: FocusSample): number {
    this.bestSharpness = Math.max(this.bestSharpness * 0.98, sharpness);
    const sharp = sharpness >= MIN_SHARPNESS && sharpness >= this.bestSharpness * RELATIVE_SHARPNESS;
    this.stableCount = sharp && motion <= MAX_MOTION ? this.stableCount + 1 : 0;
    return Math.min(1, this.stableCount / REQUIRED_STABLE_SAMPLES);
  }
}

// Udtager et lille gråtonebillede fra midten af videoen.
export function sampleVideoCenter(video: HTMLVideoElement, canvas: HTMLCanvasElement): Float32Array | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const side = Math.min(video.videoWidth, video.videoHeight) * CENTER_FRACTION;
  const sx = (video.videoWidth - side) / 2;
  const sy = (video.videoHeight - side) / 2;
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, sx, sy, side, side, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return grayscale(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
}

export const FOCUS_SAMPLE_SIZE = SAMPLE_SIZE;
