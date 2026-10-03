import { FOCUS_SAMPLE_SIZE, grayscale, laplacianVariance } from "@/lib/focus-detection";

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
const TAKE_PHOTO_TIMEOUT_MS = 2500;
const VIDEO_FRAMES = 3;
const VIDEO_FRAME_GAP_MS = 70;
const JPEG_QUALITY = 0.9;

function imageCaptureConstructor(): ImageCaptureConstructor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ImageCapture?: ImageCaptureConstructor }).ImageCapture ?? null;
}

// Uden stillbillede-funktion er videostrømmen selve fotoet, så den bedes om
// højest mulig opløsning. "ideal" falder selv tilbage på ældre telefoner.
export function cameraVideoConstraints(): MediaTrackConstraints {
  const still = imageCaptureConstructor() !== null;
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

function centerSharpness(source: HTMLCanvasElement): number {
  const sample = document.createElement("canvas");
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
  const canvas = document.createElement("canvas");
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
      const canvas = render(bitmap, bitmap.width, bitmap.height, crop, MAX_SIDE);
      return canvas ? toStill(canvas, "photo") : null;
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}

async function sharpestVideoFrame(video: HTMLVideoElement, crop: StillCrop, maxSide: number): Promise<Still | null> {
  let bestCanvas: HTMLCanvasElement | null = null;
  let bestSharpness = -1;
  for (let index = 0; index < VIDEO_FRAMES; index++) {
    if (index) await wait(VIDEO_FRAME_GAP_MS);
    if (!video.videoWidth || !video.videoHeight) continue;
    const canvas = render(video, video.videoWidth, video.videoHeight, crop, maxSide);
    if (!canvas) continue;
    const sharpness = centerSharpness(canvas);
    if (sharpness > bestSharpness) {
      bestSharpness = sharpness;
      bestCanvas = canvas;
    }
  }
  return bestCanvas ? toStill(bestCanvas, "video") : null;
}

// Ét videobillede med det samme (stregkodefotoet — må ikke forsinke flowet).
export function captureVideoFrame(video: HTMLVideoElement | null, maxSide = MAX_SIDE): Still | null {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = render(video, video.videoWidth, video.videoHeight, "none", maxSide);
  return canvas ? toStill(canvas, "video") : null;
}

// Fotoet til forside/energi/indhold: kameraets stillbillede, ellers det
// skarpeste af tre videobilleder.
export async function captureStill(video: HTMLVideoElement | null, crop: StillCrop): Promise<Still | null> {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  return (await takePhoto(video, crop)) ?? (await sharpestVideoFrame(video, crop, MAX_SIDE));
}
