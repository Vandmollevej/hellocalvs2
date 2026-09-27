import type { Sketch, SketchBox } from "./sketch-data";

// Omregner skitsens billedpixels til CSS-pixels og placerer målteksten inde i
// hver kasse, så den ikke dækker de kasser, der ligger inden i den.

export type Rect = { x: number; y: number; w: number; h: number };

export type LaidOutBox = SketchBox & {
  rect: Rect;
  label: string;
  labelColor: string;
  fontSize: number;
  /** Måltekstens midtpunkt i skitsens koordinater (CSS-pixels). */
  labelCenter: { x: number; y: number };
  /** Målteksten får kassens farve som baggrund, når den ikke kan stå frit. */
  pill: boolean;
};

const PAD = 4;
const CHAR_WIDTH = 0.62;

export function toCssRect(box: SketchBox, scale: number): Rect {
  return { x: box.x / scale, y: box.y / scale, w: box.w / scale, h: box.h / scale };
}

export function sizeLabel(rect: Rect): string {
  const w = Math.round(rect.w);
  const h = Math.round(rect.h);
  return rect.w >= 60 ? `${w} × ${h}` : `${w}×${h}`;
}

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastColor(hex: string): string {
  return luminance(hex) > 0.55 ? "#232323" : "#FFFFFF";
}

function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function labelCandidates(rect: Rect, lw: number, lh: number): { x: number; y: number }[] {
  const cx = rect.w / 2;
  const cy = rect.h / 2;
  const left = PAD + lw / 2;
  const right = rect.w - PAD - lw / 2;
  const top = PAD + lh / 2;
  const bottom = rect.h - PAD - lh / 2;
  return [
    { x: cx, y: cy },
    { x: right, y: cy },
    { x: left, y: cy },
    { x: cx, y: top },
    { x: cx, y: bottom },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: top },
    { x: left, y: bottom },
  ];
}

export function layoutSketch(sketch: Sketch): LaidOutBox[] {
  const rects = sketch.boxes.map((box) => toCssRect(box, sketch.scale));

  return sketch.boxes.map((box, index) => {
    const rect = rects[index];
    const label = sizeLabel(rect);
    const fontSize = Math.max(7, Math.min(11, rect.h * 0.7, rect.w / (label.length * CHAR_WIDTH)));
    const lw = label.length * fontSize * CHAR_WIDTH;
    const lh = fontSize + 2;

    // Kasser senere i listen, der ligger helt inden i denne, må ikke dækkes.
    const children = rects
      .slice(index + 1)
      .filter((child) => contains(rect, child))
      .map((child) => ({ x: child.x - rect.x - 1, y: child.y - rect.y - 1, w: child.w + 2, h: child.h + 2 }));
    // Første frie plads vinder; ellers den plads, der dækker mindst.
    let best = { x: rect.w / 2, y: rect.h / 2 };
    let bestOverlap = Infinity;
    for (const c of labelCandidates(rect, lw, lh)) {
      const labelRect = { x: c.x - lw / 2, y: c.y - lh / 2, w: lw, h: lh };
      const overlap = children.reduce((sum, child) => sum + overlapArea(labelRect, child), 0);
      if (overlap < bestOverlap) {
        best = c;
        bestOverlap = overlap;
      }
      if (overlap === 0) break;
    }

    return {
      ...box,
      rect,
      label,
      labelColor: contrastColor(box.fill ?? sketch.background),
      fontSize,
      labelCenter: { x: rect.x + best.x, y: rect.y + best.y },
      pill: bestOverlap > 0 || lw > rect.w - 2 || lh > rect.h,
    };
  });
}
