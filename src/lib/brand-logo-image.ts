import {
  LOGO_MAX_SIDE,
  LOGO_MAX_UPLOAD_BYTES,
  formatBytes,
  hasImageExtension,
  type LogoStep,
} from "@/lib/brand-logo-upload-types";

// Behandler en logofil i browseren, før den sendes til serveren (admin →
// Varedatabase → Logo-upload, docs/DECISIONS.md 2026-10-04):
//   læs → åbn → fjern ensfarvet baggrund → fjern tom kant → nedskalér → PNG.
// Reglerne er de samme som i logo-robottens import (scripts/logo-agent/
// import_logos.py), så et logo ser ens ud, uanset hvilken vej det kom ind.
// Hvert trin rapporteres undervejs (til live-visningen) og gemmes sammen med
// logoet, så processen kan ses bagefter. Kun til brug i browseren.

const MAX_INPUT_BYTES = 25 * 1024 * 1024;
// Arbejdsstørrelse: billedet nedskaleres til højst dette, før baggrund og
// kant behandles (hukommelse + fart). Slutstørrelsen er LOGO_MAX_SIDE.
const MAX_WORK_SIDE = 1600;
// Vektor (SVG) tegnes i denne størrelse, så der er plads til at beskære.
const VECTOR_WORK_SIDE = 1200;
// Pixels med alfa under dette regnes for tomme, når kanten fjernes.
const ALPHA_CUTOFF = 8;
// Et billede regnes for gennemsigtigt, hvis nogen pixel er under dette.
const OPAQUE_ALPHA = 250;
// Sum af forskellene i R, G og B, hvor to farver stadig regnes for "samme baggrund".
const BACKGROUND_TOLERANCE = 100;
// Tæt nok på baggrundens gråtone til at være en rest af et bagt-ind skakbræt.
const CHECKER_TOLERANCE = 4;

export type ProcessedLogo = {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalBytes: number;
  originalType: string;
  steps: LogoStep[];
};

export class LogoProcessError extends Error {
  steps: LogoStep[];
  originalWidth: number | null;
  originalHeight: number | null;

  constructor(message: string, steps: LogoStep[], originalWidth: number | null, originalHeight: number | null) {
    super(message);
    this.steps = steps;
    this.originalWidth = originalWidth;
    this.originalHeight = originalHeight;
  }
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || hasImageExtension(file.name);
}

function isSvg(file: File) {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
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

function hasTransparency(data: Uint8ClampedArray) {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < OPAQUE_ALPHA) return true;
  }
  return false;
}

type Rgb = [number, number, number];

function pixelAt(data: Uint8ClampedArray, index: number): Rgb {
  return [data[index * 4], data[index * 4 + 1], data[index * 4 + 2]];
}

function colorDiff(data: Uint8ClampedArray, index: number, reference: Rgb) {
  return (
    Math.abs(data[index * 4] - reference[0]) +
    Math.abs(data[index * 4 + 1] - reference[1]) +
    Math.abs(data[index * 4 + 2] - reference[2])
  );
}

// Fylder ind fra startpunkterne og sletter alt sammenhængende, der ligner
// `reference` (4-nabo). Returnerer antal nye pixels.
function floodClear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cleared: Uint8Array,
  seeds: number[],
  reference: Rgb,
  tolerance: number,
) {
  const stack = new Int32Array(width * height);
  let top = 0;
  let count = 0;
  const visit = (index: number) => {
    if (cleared[index] || colorDiff(data, index, reference) > tolerance) return;
    cleared[index] = 1;
    count += 1;
    stack[top++] = index;
  };
  for (const seed of seeds) visit(seed);
  while (top > 0) {
    const index = stack[--top];
    const x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
  return count;
}

// Uigennemsigtigt billede med ensfarvet (eller bagt-ind skakbræt-) baggrund:
// baggrunden gøres gennemsigtig ved at fylde ind fra kanten, så hvide flader
// inde i selve logoet beholdes. Returnerer andelen, der blev fjernet, eller
// null hvis hjørnerne ikke har samme farve.
function clearEdgeBackground(canvas: HTMLCanvasElement): number | null {
  const { width, height } = canvas;
  const context = twoD(canvas);
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const corners = [0, width - 1, width * (height - 1), width * height - 1];
  const reference = pixelAt(data, corners[0]);
  if (corners.some((corner) => colorDiff(data, corner, reference) > BACKGROUND_TOLERANCE)) return null;

  const cleared = new Uint8Array(width * height);
  const edge: number[] = [];
  for (let x = 0; x < width; x++) edge.push(x, width * (height - 1) + x);
  for (let y = 0; y < height; y++) edge.push(y * width, y * width + width - 1);
  let total = floodClear(data, width, height, cleared, edge, reference, BACKGROUND_TOLERANCE);

  // Bagt-ind skakbræt (hvid + lysegrå): rester inde i bogstavernes huller
  // hænger ikke sammen med kanten. Den lysegrå firkantfarve findes ellers ikke
  // i logoet, så alle pixels med den farve bruges også som startpunkt.
  const greyCorner = corners.find((corner) => {
    const diff = colorDiff(data, corner, reference);
    return diff > 8 && diff <= BACKGROUND_TOLERANCE;
  });
  if (greyCorner !== undefined) {
    const grey = pixelAt(data, greyCorner);
    const seeds: number[] = [];
    for (let i = 0; i < width * height; i++) {
      if (!cleared[i] && colorDiff(data, i, grey) <= CHECKER_TOLERANCE) seeds.push(i);
    }
    total += floodClear(data, width, height, cleared, seeds, grey, BACKGROUND_TOLERANCE);
  }

  if (total === 0) return null;
  for (let i = 0; i < cleared.length; i++) {
    if (cleared[i]) data[i * 4 + 3] = 0;
  }
  context.putImageData(image, 0, 0);
  return total / (width * height);
}

// Kassen om alle pixels med synligt indhold; null hvis billedet er helt tomt.
function visibleBounds(canvas: HTMLCanvasElement) {
  const { width, height } = canvas;
  const data = twoD(canvas).getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > ALPHA_CUTOFF) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// Halverer trinvis, til målet er inden for en faktor 2, og skalerer så det
// sidste stykke — det giver et skarpere resultat end ét stort spring.
function downscale(source: HTMLCanvasElement, targetWidth: number, targetHeight: number) {
  let current = source;
  while (current.width / 2 >= targetWidth && current.height / 2 >= targetHeight) {
    const half = makeCanvas(current.width / 2, current.height / 2);
    twoD(half).drawImage(current, 0, 0, half.width, half.height);
    current = half;
  }
  const finalCanvas = makeCanvas(targetWidth, targetHeight);
  twoD(finalCanvas).drawImage(current, 0, 0, finalCanvas.width, finalCanvas.height);
  return finalCanvas;
}

function toPng(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function processLogoFile(
  file: File,
  onProgress: (steps: LogoStep[], running: string | null) => void,
): Promise<ProcessedLogo> {
  const steps: LogoStep[] = [];
  let originalWidth: number | null = null;
  let originalHeight: number | null = null;

  const begin = (label: string) => {
    onProgress([...steps], label);
    return performance.now();
  };
  const finish = (started: number, step: Omit<LogoStep, "ms">) => {
    steps.push({ ...step, ms: Math.round(performance.now() - started) });
    onProgress([...steps], null);
  };
  const fail = (started: number, key: string, label: string, message: string): never => {
    finish(started, { key, label, status: "error", detail: message });
    throw new LogoProcessError(message, [...steps], originalWidth, originalHeight);
  };

  // 1. Læs filen
  let started = begin("Læser filen");
  if (!isImageFile(file)) fail(started, "read", "Læser filen", "Filen er ikke et billede");
  if (file.size === 0) fail(started, "read", "Læser filen", "Filen er tom");
  if (file.size > MAX_INPUT_BYTES) fail(started, "read", "Læser filen", `Filen er for stor (${formatBytes(file.size)}, højst 25 MB)`);
  finish(started, { key: "read", label: "Læser filen", status: "ok", detail: `${file.type || "ukendt type"} · ${formatBytes(file.size)}` });

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
    const vector = isSvg(file);
    const longest = Math.max(originalWidth, originalHeight);
    // Vektor tegnes direkte i arbejdsstørrelsen; rasterbilleder i fuld størrelse
    // (dog højst MAX_WORK_SIDE af hensyn til hukommelsen).
    const drawScale = vector ? VECTOR_WORK_SIDE / longest : Math.min(1, MAX_WORK_SIDE / longest);
    const work = makeCanvas(originalWidth * drawScale, originalHeight * drawScale);
    twoD(work).drawImage(image, 0, 0, work.width, work.height);
    finish(started, {
      key: "decode",
      label: "Åbner billedet",
      status: "ok",
      detail: `${originalWidth} × ${originalHeight} px${
        vector ? ` (vektor — tegnes i ${work.width} × ${work.height} px)` : drawScale < 1 ? ` (arbejdskopi ${work.width} × ${work.height} px)` : ""
      }`,
    });

    // 3. Fjern ensfarvet baggrund (kun hvis billedet ikke allerede er gennemsigtigt)
    started = begin("Fjerner baggrund");
    if (hasTransparency(twoD(work).getImageData(0, 0, work.width, work.height).data)) {
      finish(started, { key: "background", label: "Fjerner baggrund", status: "skipped", detail: "Billedet er allerede gennemsigtigt" });
    } else {
      const removed = clearEdgeBackground(work);
      finish(
        started,
        removed === null
          ? { key: "background", label: "Fjerner baggrund", status: "skipped", detail: "Ingen ensfarvet baggrund fra kanten — billedet er uændret" }
          : {
              key: "background",
              label: "Fjerner baggrund",
              status: "ok",
              detail: `Ensfarvet baggrund fra kanten gjort gennemsigtig (${Math.round(removed * 100)} % af billedet)`,
            },
      );
    }

    // 4. Fjern tom (gennemsigtig) kant
    started = begin("Fjerner tom kant");
    const bounds = visibleBounds(work);
    if (!bounds) return fail(started, "trim", "Fjerner tom kant", "Billedet er helt tomt/gennemsigtigt");
    let trimmed = work;
    if (bounds.width === work.width && bounds.height === work.height) {
      finish(started, { key: "trim", label: "Fjerner tom kant", status: "skipped", detail: "Ingen tom kant at fjerne" });
    } else {
      trimmed = makeCanvas(bounds.width, bounds.height);
      twoD(trimmed).drawImage(work, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
      finish(started, {
        key: "trim",
        label: "Fjerner tom kant",
        status: "ok",
        detail: `${work.width} × ${work.height} → ${trimmed.width} × ${trimmed.height} px`,
      });
    }

    // 5. Nedskalér (aldrig forstør)
    started = begin("Nedskalerer");
    const trimmedLongest = Math.max(trimmed.width, trimmed.height);
    let result = trimmed;
    if (trimmedLongest > LOGO_MAX_SIDE) {
      const ratio = LOGO_MAX_SIDE / trimmedLongest;
      result = downscale(trimmed, Math.max(1, Math.round(trimmed.width * ratio)), Math.max(1, Math.round(trimmed.height * ratio)));
      finish(started, {
        key: "scale",
        label: "Nedskalerer",
        status: "ok",
        detail: `${trimmed.width} × ${trimmed.height} → ${result.width} × ${result.height} px (længste side højst ${LOGO_MAX_SIDE})`,
      });
    } else {
      finish(started, {
        key: "scale",
        label: "Nedskalerer",
        status: "skipped",
        detail: `Allerede højst ${LOGO_MAX_SIDE} px — størrelsen er uændret`,
      });
    }

    // 6. Gem som PNG
    started = begin("Gemmer som PNG");
    const blob = await toPng(result);
    if (!blob) return fail(started, "encode", "Gemmer som PNG", "Kunne ikke lave PNG-filen");
    if (blob.size > LOGO_MAX_UPLOAD_BYTES) {
      return fail(started, "encode", "Gemmer som PNG", `PNG-filen er stadig for stor (${formatBytes(blob.size)}, højst ${formatBytes(LOGO_MAX_UPLOAD_BYTES)})`);
    }
    finish(started, {
      key: "encode",
      label: "Gemmer som PNG",
      status: "ok",
      detail: `${result.width} × ${result.height} px · ${formatBytes(blob.size)}`,
    });

    return {
      blob,
      width: result.width,
      height: result.height,
      originalWidth,
      originalHeight,
      originalBytes: file.size,
      originalType: file.type || "ukendt",
      steps: [...steps],
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
