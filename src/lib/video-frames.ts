// Billeder fra en skærmoptagelse eller skærmbilleder i browseren, til
// migreringen fra MyFitnessPal/Lifesum (docs/DECISIONS.md 2026-10-06).
// Næsten ens billeder (brugeren holdt pause i scroll) springes over, så der
// ikke sendes flere AI-kald end nødvendigt.

const MAX_WIDTH = 900;
const STEP_SECONDS = 1.2;
const SAME_FRAME_DIFF = 6;

function canvasFor(width: number, height: number) {
  const scale = Math.min(1, MAX_WIDTH / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  return canvas;
}

/** 16×16 gråtoner som "fingeraftryk" til at genkende ens billeder. */
function fingerprint(source: CanvasImageSource): number[] {
  const small = document.createElement("canvas");
  small.width = 16;
  small.height = 16;
  const ctx = small.getContext("2d");
  if (!ctx) return [];
  ctx.drawImage(source, 0, 0, 16, 16);
  const data = ctx.getImageData(0, 0, 16, 16).data;
  const out: number[] = [];
  for (let i = 0; i < data.length; i += 4) out.push((data[i] + data[i + 1] + data[i + 2]) / 3);
  return out;
}

function difference(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
  });
}

/** Billeder (JPEG data-URL) fra en video hvert ~1,2 sek., uden næsten-ens dubletter. */
export async function framesFromVideo(file: File, onProgress?: (fraction: number) => void): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Videoen kunne ikke åbnes"));
    });
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const canvas = canvasFor(video.videoWidth || 1, video.videoHeight || 1);
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];

    const frames: string[] = [];
    let previous: number[] = [];
    for (let time = 0.2; time < Math.max(duration, 0.3); time += STEP_SECONDS) {
      await seek(video, Math.min(time, Math.max(0, duration - 0.05)));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const print = fingerprint(canvas);
      if (difference(print, previous) > SAME_FRAME_DIFF) {
        frames.push(canvas.toDataURL("image/jpeg", 0.75));
        previous = print;
      }
      onProgress?.(duration ? Math.min(1, time / duration) : 1);
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Et skærmbillede som nedskaleret JPEG data-URL. */
export async function frameFromImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = canvasFor(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Billedet kunne ikke læses");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.8);
}
