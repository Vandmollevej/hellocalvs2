import { formatBytes, formatDimensions } from "@/lib/brand-logo-upload-types";
import { isImageFile } from "@/lib/brand-logo-image";
import {
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_SIDE,
  type ImageStep,
} from "@/lib/product-image-upload-types";

// Gør et produktbillede klar i browseren, før det sendes til serveren (admin →
// Varedatabase → Billed-upload, docs/DECISIONS.md 2026-10-04):
//   læs → åbn → tjek gennemsigtighed → nedskalér hvis over 2000 px → gør klar.
// Billedet ændres kun, når det er nødvendigt: et PNG/JPEG/WebP inden for
// grænserne sendes uændret (butiksbilleder bruges uændret, retina). Hvert
// trin rapporteres undervejs og gemmes sammen med billedet. Kun til browseren.

const MAX_INPUT_BYTES = 40 * 1024 * 1024;
// Prøvestørrelse til at finde gennemsigtighed, når billedet ikke skal ændres.
const ALPHA_SAMPLE_SIDE = 800;
const OPAQUE_ALPHA = 250;

export type ProcessedProductImage = {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  originalType: string;
  hasAlpha: boolean;
  steps: ImageStep[];
};

export class ProductImageProcessError extends Error {
  steps: ImageStep[];
  originalWidth: number | null;
  originalHeight: number | null;

  constructor(message: string, steps: ImageStep[], originalWidth: number | null, originalHeight: number | null) {
    super(message);
    this.steps = steps;
    this.originalWidth = originalWidth;
    this.originalHeight = originalHeight;
  }
}

const MIME_BY_EXTENSION: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const KEEPABLE = new Set(["image/png", "image/jpeg", "image/webp"]);
// Formater, der kan have gennemsigtighed.
const CAN_HAVE_ALPHA = new Set(["image/png", "image/webp", "image/gif", "image/svg+xml", "image/avif"]);

function sourceMime(file: File) {
  if (file.type) return file.type === "image/jpg" ? "image/jpeg" : file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "";
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image"));
    image.src = url;
  });
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function twoD(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return context;
}

function canvasHasAlpha(canvas: HTMLCanvasElement) {
  const data = twoD(canvas).getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < OPAQUE_ALPHA) return true;
  }
  return false;
}

// Halverer trinvis, til målet er inden for en faktor 2 (skarpere end ét stort spring).
function downscale(source: HTMLImageElement, targetWidth: number, targetHeight: number) {
  let current: CanvasImageSource = source;
  let width = source.naturalWidth;
  let height = source.naturalHeight;
  while (width / 2 >= targetWidth && height / 2 >= targetHeight) {
    const half = makeCanvas(width / 2, height / 2);
    twoD(half).drawImage(current, 0, 0, half.width, half.height);
    current = half;
    width = half.width;
    height = half.height;
  }
  const result = makeCanvas(targetWidth, targetHeight);
  twoD(result).drawImage(current, 0, 0, result.width, result.height);
  return result;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function processProductImage(
  file: File,
  onProgress: (steps: ImageStep[], running: string | null) => void,
): Promise<ProcessedProductImage> {
  const steps: ImageStep[] = [];
  let originalWidth: number | null = null;
  let originalHeight: number | null = null;

  const begin = (label: string) => {
    onProgress([...steps], label);
    return performance.now();
  };
  const finish = (started: number, step: Omit<ImageStep, "ms">) => {
    steps.push({ ...step, ms: Math.round(performance.now() - started) });
    onProgress([...steps], null);
  };
  const fail = (started: number, key: string, label: string, message: string): never => {
    finish(started, { key, label, status: "error", detail: message });
    throw new ProductImageProcessError(message, [...steps], originalWidth, originalHeight);
  };

  // 1. Læs filen
  let started = begin("Læser filen");
  if (!isImageFile(file)) fail(started, "read", "Læser filen", "Filen er ikke et billede");
  if (file.size === 0) fail(started, "read", "Læser filen", "Filen er tom");
  if (file.size > MAX_INPUT_BYTES) fail(started, "read", "Læser filen", `Filen er for stor (${formatBytes(file.size)}, højst 40 MB)`);
  const mime = sourceMime(file);
  finish(started, { key: "read", label: "Læser filen", status: "ok", detail: `${mime || "ukendt type"} · ${formatBytes(file.size)}` });

  // 2. Åbn billedet
  started = begin("Åbner billedet");
  const objectUrl = URL.createObjectURL(file);
  try {
    let image: HTMLImageElement;
    try {
      image = await loadImage(objectUrl);
    } catch {
      return fail(started, "decode", "Åbner billedet", "Billedet kan ikke åbnes (beskadiget eller ukendt format)");
    }
    originalWidth = image.naturalWidth;
    originalHeight = image.naturalHeight;
    if (!originalWidth || !originalHeight) {
      return fail(started, "decode", "Åbner billedet", "Billedet mangler en størrelse (SVG uden width/height?)");
    }
    finish(started, { key: "decode", label: "Åbner billedet", status: "ok", detail: formatDimensions(originalWidth, originalHeight) });

    const longest = Math.max(originalWidth, originalHeight);
    const needsResize = longest > PRODUCT_IMAGE_MAX_SIDE;
    const vector = mime === "image/svg+xml";
    // Vektor har ingen fast pixelstørrelse: tegnes i 1600 px.
    const resizeTo = vector ? 1600 : needsResize ? PRODUCT_IMAGE_MAX_SIDE : null;

    // 3. Tjek gennemsigtighed (fritlagt billede)
    started = begin("Tjekker gennemsigtighed");
    let hasAlpha = false;
    let sample: HTMLCanvasElement | null = null;
    if (!CAN_HAVE_ALPHA.has(mime) && mime !== "") {
      finish(started, { key: "alpha", label: "Tjekker gennemsigtighed", status: "skipped", detail: "Formatet har ingen gennemsigtighed — ikke fritlagt" });
    } else {
      const scale = Math.min(1, ALPHA_SAMPLE_SIDE / longest);
      sample = makeCanvas(originalWidth * scale, originalHeight * scale);
      twoD(sample).drawImage(image, 0, 0, sample.width, sample.height);
      hasAlpha = canvasHasAlpha(sample);
      finish(started, {
        key: "alpha",
        label: "Tjekker gennemsigtighed",
        status: "ok",
        detail: hasAlpha ? "Fritlagt (gennemsigtig baggrund) — vises med grå tern i sammenligningen" : "Ikke fritlagt (ingen gennemsigtig baggrund)",
      });
    }

    // 4. Størrelse
    started = begin("Tjekker størrelse");
    let canvas: HTMLCanvasElement | null = null;
    if (resizeTo !== null) {
      const ratio = resizeTo / longest;
      canvas = downscale(image, Math.max(1, Math.round(originalWidth * ratio)), Math.max(1, Math.round(originalHeight * ratio)));
      if (vector) hasAlpha = hasAlpha || canvasHasAlpha(canvas);
      finish(started, {
        key: "scale",
        label: vector ? "Tegner vektor" : "Nedskalerer",
        status: "ok",
        detail: `${formatDimensions(originalWidth, originalHeight)} → ${formatDimensions(canvas.width, canvas.height)}${vector ? "" : ` (længste side højst ${PRODUCT_IMAGE_MAX_SIDE})`}`,
      });
    } else {
      finish(started, {
        key: "scale",
        label: "Tjekker størrelse",
        status: "skipped",
        detail: `Højst ${PRODUCT_IMAGE_MAX_SIDE} px på længste side — størrelsen er uændret`,
      });
    }

    // 5. Gør klar til upload
    started = begin("Gør klar til upload");
    const baseName = file.name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
    if (canvas === null && KEEPABLE.has(mime) && file.size <= PRODUCT_IMAGE_MAX_BYTES) {
      finish(started, {
        key: "encode",
        label: "Gør klar til upload",
        status: "skipped",
        detail: `Originalfilen sendes uændret (${mime.replace("image/", "").toUpperCase()}, ${formatBytes(file.size)})`,
      });
      return {
        blob: file,
        fileName: file.name,
        width: originalWidth,
        height: originalHeight,
        originalWidth,
        originalHeight,
        originalBytes: file.size,
        originalType: mime,
        hasAlpha,
        steps: [...steps],
      };
    }

    // Skal genkodes (nedskaleret, eller et format serveren ikke gemmer som det er).
    if (canvas === null) {
      canvas = makeCanvas(originalWidth, originalHeight);
      twoD(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
    }
    let blob: Blob | null;
    let extension: string;
    let outputType: string;
    const prefersPng = hasAlpha || mime === "image/png" || mime === "image/gif" || mime === "image/svg+xml" || mime === "image/bmp" || mime === "";
    if (prefersPng) {
      outputType = "image/png";
      extension = "png";
      blob = await toBlob(canvas, outputType);
      if (blob && blob.size > PRODUCT_IMAGE_MAX_BYTES && !hasAlpha) {
        outputType = "image/jpeg";
        extension = "jpg";
        blob = await toBlob(canvas, outputType, 0.92);
      }
    } else {
      outputType = "image/jpeg";
      extension = "jpg";
      blob = await toBlob(canvas, outputType, 0.92);
    }
    if (!blob) return fail(started, "encode", "Gør klar til upload", "Kunne ikke lave billedfilen");
    if (blob.size > PRODUCT_IMAGE_MAX_BYTES) {
      return fail(started, "encode", "Gør klar til upload", `Billedet er stadig for stort (${formatBytes(blob.size)}, højst ${formatBytes(PRODUCT_IMAGE_MAX_BYTES)})`);
    }
    finish(started, {
      key: "encode",
      label: "Gør klar til upload",
      status: "ok",
      detail: `Gemt som ${extension.toUpperCase()} · ${formatDimensions(canvas.width, canvas.height)} · ${formatBytes(blob.size)}`,
    });
    return {
      blob,
      fileName: `${baseName}.${extension}`,
      width: canvas.width,
      height: canvas.height,
      originalWidth,
      originalHeight,
      originalBytes: file.size,
      originalType: mime || "ukendt",
      hasAlpha,
      steps: [...steps],
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
