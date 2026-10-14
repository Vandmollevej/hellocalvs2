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

// Varen i rammen vælges automatisk (brugerens krav 2026-10-14): kameraet
// fryser ikke længere med grønne cirkler, som brugeren skal trykke på. Det
// objekt, der dækker rammens midte, er varen — dækker flere, vinder det
// største (etiketten på kartonen taber til kartonen). En boks, der er hele
// billedet, er baggrund og tæller ikke. Dækker intet objekt midten, bruges
// det nærmeste, hvis det står i rammen; ellers hele billedet (null).
const WHOLE_PHOTO_FRACTION = 0.85;
const MAX_FOCUS_DISTANCE = 0.3;

function contains(object: ObjectBox, x: number, y: number): boolean {
  return object.x <= x && x <= object.x + object.width && object.y <= y && y <= object.y + object.height;
}

function area(object: ObjectBox): number {
  return object.width * object.height;
}

function isWholePhoto(object: ObjectBox): boolean {
  return object.width >= WHOLE_PHOTO_FRACTION && object.height >= WHOLE_PHOTO_FRACTION;
}

function focusDistance(object: ObjectBox, x: number, y: number): number {
  return Math.hypot(object.x + object.width / 2 - x, object.y + object.height / 2 - y);
}

export function pickObjectInFocus(objects: ObjectBox[], focus = { x: 0.5, y: 0.5 }): ObjectBox | null {
  const candidates = objects.filter((object) => !isWholePhoto(object));
  if (candidates.length < 2) return null;
  const covering = candidates.filter((object) => contains(object, focus.x, focus.y));
  if (covering.length) return covering.reduce((best, object) => (area(object) > area(best) ? object : best));
  const nearest = candidates.reduce((best, object) =>
    focusDistance(object, focus.x, focus.y) < focusDistance(best, focus.x, focus.y) ? object : best,
  );
  return focusDistance(nearest, focus.x, focus.y) <= MAX_FOCUS_DISTANCE ? nearest : null;
}
