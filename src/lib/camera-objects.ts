// Flere objekter i kameraet (docs/DECISIONS.md 2026-09-28): når forsidefotoet
// viser flere mulige produkter, markeres hvert med en grøn cirkel, og brugeren
// trykker på det, der skal være fokus. Fotoet beskæres så til det valgte
// objekt (med luft omkring), før resten af flowet læser det.

export type ObjectBox = { x: number; y: number; w: number; h: number };
export type CameraObject = { label: string; box: ObjectBox };

// Luft omkring det valgte objekt, som andel af objektets egen størrelse.
const CROP_PADDING = 0.15;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

// Normaliserer og frasorterer bokse, der er for små eller ugyldige.
export function cleanObjects(raw: CameraObject[]): CameraObject[] {
  return raw
    .map((item) => {
      const x = clamp01(item.box.x);
      const y = clamp01(item.box.y);
      return {
        label: item.label.slice(0, 80),
        box: { x, y, w: Math.min(clamp01(item.box.w), 1 - x), h: Math.min(clamp01(item.box.h), 1 - y) },
      };
    })
    .filter((item) => item.box.w >= 0.05 && item.box.h >= 0.05)
    .slice(0, 8);
}

// Kvadratisk forhåndsvisning (object-cover) → brøker af den synlige flade.
export function boxToViewFraction(box: ObjectBox, imageWidth: number, imageHeight: number) {
  const side = Math.min(imageWidth, imageHeight);
  const offsetX = (imageWidth - side) / 2;
  const offsetY = (imageHeight - side) / 2;
  const cx = (box.x + box.w / 2) * imageWidth;
  const cy = (box.y + box.h / 2) * imageHeight;
  const radius = (Math.max(box.w * imageWidth, box.h * imageHeight) / 2) * 1.05;
  return {
    cx: (cx - offsetX) / side,
    cy: (cy - offsetY) / side,
    r: radius / side,
  };
}

export async function detectCameraObjects(photo: string, headers: HeadersInit): Promise<CameraObject[]> {
  try {
    const response = await fetch("/api/products/detect-objects", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ photo }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { objects?: CameraObject[] };
    return Array.isArray(data.objects) ? cleanObjects(data.objects) : [];
  } catch {
    return [];
  }
}

// Beskærer fotoet til det valgte objekt med luft omkring.
export async function cropToObject(photo: string, box: ObjectBox): Promise<string> {
  const image = new Image();
  image.src = photo;
  await image.decode();
  const padX = box.w * CROP_PADDING;
  const padY = box.h * CROP_PADDING;
  const x0 = clamp01(box.x - padX) * image.naturalWidth;
  const y0 = clamp01(box.y - padY) * image.naturalHeight;
  const x1 = clamp01(box.x + box.w + padX) * image.naturalWidth;
  const y1 = clamp01(box.y + box.h + padY) * image.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(x1 - x0));
  canvas.height = Math.max(1, Math.round(y1 - y0));
  canvas.getContext("2d")?.drawImage(image, x0, y0, x1 - x0, y1 - y0, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
