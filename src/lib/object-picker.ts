// Flere objekter i kameraet (docs/DECISIONS.md 2026-09-28): AI finder de
// mulige objekter, kameraet markerer dem med grønne cirkler, og brugerens
// valg beskærer billedet til det objekt, før resten af flowet kører.

export type ObjectBox = { label: string; x: number; y: number; width: number; height: number };

const MAX_OBJECTS = 6;
const MIN_SIDE = 0.04;
// Luft omkring objektet i det beskårne billede.
const CROP_MARGIN = 0.15;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// Klipper boksene ind i billedet og smider for små/ugyldige væk.
export function normalizeObjectBoxes(objects: ObjectBox[]): ObjectBox[] {
  return objects
    .map((object) => {
      const x = clamp01(Number(object.x) || 0);
      const y = clamp01(Number(object.y) || 0);
      return {
        label: String(object.label ?? "").slice(0, 60),
        x,
        y,
        width: Math.min(clamp01(Number(object.width) || 0), 1 - x),
        height: Math.min(clamp01(Number(object.height) || 0), 1 - y),
      };
    })
    .filter((object) => object.width >= MIN_SIDE && object.height >= MIN_SIDE)
    .slice(0, MAX_OBJECTS);
}

// Tom liste ved fejl — så fortsætter kameraet bare med hele billedet.
export async function detectObjects(photo: string): Promise<ObjectBox[]> {
  try {
    const res = await fetch("/api/ai/detect-objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { objects?: ObjectBox[] };
    return Array.isArray(data.objects) ? normalizeObjectBoxes(data.objects) : [];
  } catch {
    return [];
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// Beskærer fotoet til det valgte objekt (med lidt luft). Fejler det, bruges
// hele fotoet.
export async function cropToObject(photo: string, box: ObjectBox, quality = 0.9): Promise<string> {
  try {
    const image = await loadImage(photo);
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const marginX = box.width * CROP_MARGIN;
    const marginY = box.height * CROP_MARGIN;
    const left = Math.round(clamp01(box.x - marginX) * w);
    const top = Math.round(clamp01(box.y - marginY) * h);
    const right = Math.round(clamp01(box.x + box.width + marginX) * w);
    const bottom = Math.round(clamp01(box.y + box.height + marginY) * h);
    if (right - left < 8 || bottom - top < 8) return photo;
    const canvas = document.createElement("canvas");
    canvas.width = right - left;
    canvas.height = bottom - top;
    canvas.getContext("2d")?.drawImage(image, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return photo;
  }
}
