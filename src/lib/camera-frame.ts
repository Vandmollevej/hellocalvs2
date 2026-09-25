// Browser-only helpers for the automatic "Produkt" camera tab: grabbing the
// square part of the video the user actually sees (the viewfinder uses
// `object-cover` in a square box), and a tiny grayscale thumbnail used to
// decide when the camera is held still and the scene has changed, so frames
// are only sent to AI when it is worth it.

const THUMB_SIZE = 24;

function squareCrop(video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

// JPEG data URL of the centred square (what `object-cover` shows), scaled
// down to `maxSize` px to keep the upload and the AI call small.
export function captureSquareFrame(video: HTMLVideoElement, maxSize = 768): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const { sx, sy, side } = squareCrop(video);
  const size = Math.min(maxSize, side);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
}

// 24×24 grayscale thumbnail of the same square, or null before the video has
// real frames.
export function sampleThumbnail(video: HTMLVideoElement, canvas: HTMLCanvasElement): Uint8Array | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const { sx, sy, side } = squareCrop(video);
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(video, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
  const { data } = context.getImageData(0, 0, THUMB_SIZE, THUMB_SIZE);
  const gray = new Uint8Array(THUMB_SIZE * THUMB_SIZE);
  for (let i = 0; i < gray.length; i += 1) {
    gray[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  }
  return gray;
}

// Mean absolute pixel difference (0–255) between two thumbnails.
export function thumbnailDifference(a: Uint8Array, b: Uint8Array): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

export function meanLuma(thumbnail: Uint8Array): number {
  let total = 0;
  for (const value of thumbnail) total += value;
  return total / thumbnail.length;
}
