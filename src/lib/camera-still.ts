import { FOCUS_SAMPLE_SIZE, grayscale, laplacianVariance } from "@/lib/focus-detection";
import { isWebKit } from "./camera-webkit";

// Rigtige stillbilleder i kameraflowet (docs/DECISIONS.md 2026-10-02). Et
// 1080p-videobillede var for uskarpt til små ingredienslister. Fotoet tages
// derfor med kameraets stillbillede-funktion (ImageCapture.takePhoto), når
// browseren har den — helt automatisk, uden tryk. Ellers bruges det skarpeste
// af tre videobilleder fra en strøm i højest mulig opløsning.

export type Still = {
  url: string;
  width: number;
  height: number;
  // "photo" = kameraets stillbillede, "video" = billede fra videostrømmen.
  source: "photo" | "video";
  // Laplace-varians i midten af fotoet (samme mål som useAutoCapture).
  sharpness: number;
};

// "square" = kun det kvadrat, brugeren så i søgeren (midten af billedet).
export type StillCrop = "none" | "square";

type PhotoCapabilitiesLike = { imageWidth?: { max?: number }; imageHeight?: { max?: number } };
type ImageCaptureLike = {
  takePhoto(settings?: { imageWidth?: number; imageHeight?: number }): Promise<Blob>;
  getPhotoCapabilities?: () => Promise<PhotoCapabilitiesLike>;
};
type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

// OpenAI skalerer selv større billeder ned, så mere end dette er spildt upload.
const MAX_SIDE = 2048;
const MAX_SENSOR_SIDE = 4096;
// Hele kamerabilledet til bagsidebilledet (docs/DECISIONS.md 2026-10-15):
// ubeskåret og i op til sensorens opløsning, så små mærker og tekst kan læses.
const FULL_MAX_SIDE = MAX_SENSOR_SIDE;
const TAKE_PHOTO_TIMEOUT_MS = 2500;
const VIDEO_FRAMES = 3;
const VIDEO_FRAME_GAP_MS = 70;
const JPEG_QUALITY = 0.9;

// Sættes, når takePhoto() har fejlet eller hængt én gang: så prøves den ikke
// igen i denne side (et hængt kald fryser videoen).
let takePhotoBroken = false;

export function stillPhotoSupported(): boolean {
  return imageCaptureConstructor() !== null;
}

function imageCaptureConstructor(): ImageCaptureConstructor | null {
  if (typeof window === "undefined" || takePhotoBroken || isWebKit()) return null;
  return (window as unknown as { ImageCapture?: ImageCaptureConstructor }).ImageCapture ?? null;
}

// Uden stillbillede-funktion (og altid på WebKit/iPhone) er videostrømmen
// selve fotoet, så den bedes om højest mulig opløsning. "ideal" falder selv
// tilbage på ældre telefoner.
export function cameraVideoConstraints(): MediaTrackConstraints {
  const still = stillPhotoSupported();
  return {
    facingMode: { ideal: "environment" },
    width: { ideal: still ? 1920 : 3840 },
    height: { ideal: still ? 1080 : 2160 },
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

// Lærrederne genbruges (docs/DECISIONS.md 2026-10-14): den levende scanning
// tegner flere billeder i sekundet, og et nyt lærred pr. billede fyldte
// iPhones grafikhukommelse op, indtil kameraet gik i sort. Hvert resultat
// serialiseres (toDataURL) med det samme, så ét lærred rækker.
let renderCanvas: HTMLCanvasElement | null = null;
let sampleCanvas: HTMLCanvasElement | null = null;

function centerSharpness(source: HTMLCanvasElement): number {
  const sample = sampleCanvas ?? (sampleCanvas = document.createElement("canvas"));
  sample.width = FOCUS_SAMPLE_SIZE;
  sample.height = FOCUS_SAMPLE_SIZE;
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return 0;
  const side = Math.min(source.width, source.height) * 0.76;
  context.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE);
  const gray = grayscale(context.getImageData(0, 0, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE).data);
  return Math.round(laplacianVariance(gray, FOCUS_SAMPLE_SIZE, FOCUS_SAMPLE_SIZE));
}

// Beskærer (evt.) til søgerens kvadrat og skalerer ned til MAX_SIDE.
function render(
  image: CanvasImageSource,
  width: number,
  height: number,
  crop: StillCrop,
  maxSide: number,
): HTMLCanvasElement | null {
  const side = Math.min(width, height);
  const sw = crop === "square" ? side : width;
  const sh = crop === "square" ? side : height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = renderCanvas ?? (renderCanvas = document.createElement("canvas"));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, (width - sw) / 2, (height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toStill(canvas: HTMLCanvasElement, source: Still["source"]): Still {
  return {
    url: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    width: canvas.width,
    height: canvas.height,
    source,
    sharpness: centerSharpness(canvas),
  };
}

async function takePhoto(video: HTMLVideoElement, crop: StillCrop): Promise<Still | null> {
  return takePhotoBitmap(video, (bitmap) => {
    const canvas = render(bitmap, bitmap.width, bitmap.height, crop, MAX_SIDE);
    return canvas ? toStill(canvas, "photo") : null;
  });
}

async function takePhotoBitmap<T>(video: HTMLVideoElement, fromBitmap: (bitmap: ImageBitmap) => T | null): Promise<T | null> {
  const ImageCapture = imageCaptureConstructor();
  const track = (video.srcObject as MediaStream | null)?.getVideoTracks()[0];
  if (!ImageCapture || !track || track.readyState !== "live") return null;
  try {
    const capture = new ImageCapture(track);
    const capabilities = await capture.getPhotoCapabilities?.().catch(() => null);
    const maxWidth = capabilities?.imageWidth?.max;
    const maxHeight = capabilities?.imageHeight?.max;
    const settings =
      maxWidth && maxHeight
        ? { imageWidth: Math.min(maxWidth, MAX_SENSOR_SIDE), imageHeight: Math.min(maxHeight, MAX_SENSOR_SIDE) }
        : undefined;
    const blob = await withTimeout(capture.takePhoto(settings), TAKE_PHOTO_TIMEOUT_MS);
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      // Et stillbillede, der ligger ned, mens søgeren står op (eller omvendt),
      // er ikke blevet drejet rigtigt — så bruges videobilledet i stedet.
      const portrait = bitmap.height >= bitmap.width;
      if (portrait !== video.videoHeight >= video.videoWidth) return null;
      // Aldrig et stillbillede, der er mindre end videobilledet.
      if (Math.min(bitmap.width, bitmap.height) < Math.min(video.videoWidth, video.videoHeight)) return null;
      return fromBitmap(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    takePhotoBroken = true;
    return null;
  }
}

async function sharpestVideoFrame(video: HTMLVideoElement, crop: StillCrop, maxSide: number): Promise<Still | null> {
  let best: Still | null = null;
  for (let index = 0; index < VIDEO_FRAMES; index++) {
    if (index) await wait(VIDEO_FRAME_GAP_MS);
    if (!video.videoWidth || !video.videoHeight) continue;
    const canvas = render(video, video.videoWidth, video.videoHeight, crop, maxSide);
    if (!canvas) continue;
    // Serialiseres straks: lærredet genbruges af næste billede.
    const still = toStill(canvas, "video");
    if (!best || still.sharpness > best.sharpness) best = still;
  }
  return best;
}

// Ét videobillede med det samme (stregkodefotoet — må ikke forsinke flowet —
// og den levende scannings billeder, docs/DECISIONS.md 2026-10-02).
export function captureVideoFrame(
  video: HTMLVideoElement | null,
  maxSide = MAX_SIDE,
  crop: StillCrop = "none",
): Still | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = render(video, video.videoWidth, video.videoHeight, crop, maxSide);
  return canvas ? toStill(canvas, "video") : null;
}

// Fotoet til forside/energi/indhold: kameraets stillbillede, ellers det
// skarpeste af tre videobilleder.
export async function captureStill(video: HTMLVideoElement | null, crop: StillCrop): Promise<Still | null> {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  return (await takePhoto(video, crop)) ?? (await sharpestVideoFrame(video, crop, MAX_SIDE));
}

// Fotoet (evt. beskåret til søgerens kvadrat) og hele kamerabilledet fra
// SAMME billede (docs/DECISIONS.md 2026-10-15): energi/indhold sender
// kvadratet til oprettelsens AI og gemmer det hele, ubeskårne billede til
// nattens engangsanalyse (mærkninger på bagsiden, finlæsning).
export type StillPair = { still: Still; full: Still };

function renderPair(
  image: CanvasImageSource,
  width: number,
  height: number,
  crop: StillCrop,
  fullCrop: StillCrop,
  source: Still["source"],
): StillPair | null {
  const cropped = render(image, width, height, crop, MAX_SIDE);
  if (!cropped) return null;
  const still = toStill(cropped, source);
  const whole = render(image, width, height, fullCrop, FULL_MAX_SIDE);
  return whole ? { still, full: toStill(whole, source) } : null;
}

// Det skarpeste af tre videobilleder; billederne holdes som ImageBitmap, så
// det hele billede er netop det valgte (ellers tegnes videoen igen straks).
async function sharpestVideoFramePair(video: HTMLVideoElement, crop: StillCrop, fullCrop: StillCrop): Promise<StillPair | null> {
  let best: { still: Still; bitmap: ImageBitmap | null } | null = null;
  for (let index = 0; index < VIDEO_FRAMES; index++) {
    if (index) await wait(VIDEO_FRAME_GAP_MS);
    if (!video.videoWidth || !video.videoHeight) continue;
    const bitmap = await createImageBitmap(video).catch(() => null);
    const canvas = bitmap
      ? render(bitmap, bitmap.width, bitmap.height, crop, MAX_SIDE)
      : render(video, video.videoWidth, video.videoHeight, crop, MAX_SIDE);
    if (!canvas) {
      bitmap?.close();
      continue;
    }
    const still = toStill(canvas, "video");
    if (!best || still.sharpness > best.still.sharpness) {
      best?.bitmap?.close();
      best = { still, bitmap };
    } else {
      bitmap?.close();
    }
  }
  if (!best) return null;
  try {
    const whole = best.bitmap
      ? render(best.bitmap, best.bitmap.width, best.bitmap.height, fullCrop, FULL_MAX_SIDE)
      : render(video, video.videoWidth, video.videoHeight, fullCrop, FULL_MAX_SIDE);
    return whole ? { still: best.still, full: toStill(whole, "video") } : null;
  } finally {
    best.bitmap?.close();
  }
}

// `fullCrop`: energi/indhold gemmer hele, ubeskårne billede; forsiden gemmer
// søgerens kvadrat i fuld opløsning (brugerens krav 2026-10-15).
export async function captureStillWithFull(
  video: HTMLVideoElement | null,
  crop: StillCrop,
  fullCrop: StillCrop = "none",
): Promise<StillPair | null> {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  return (
    (await takePhotoBitmap(video, (bitmap) => renderPair(bitmap, bitmap.width, bitmap.height, crop, fullCrop, "photo"))) ??
    (await sharpestVideoFramePair(video, crop, fullCrop))
  );
}
