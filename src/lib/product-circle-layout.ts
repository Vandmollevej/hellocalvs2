// Fritskrabet vare + cirklen bagved som ÉT billede (bruger 2026-10-16: kun
// hjemmesiden). Alle billeder på en hjemmeside kan hentes, så et fritlagt
// produktbillede må ikke kunne hentes uden cirklen — cirklen er bagt ind.
// Cirklen har fast diameter (CIRCLE_DIAMETER px) og bliver aldrig mindre:
// varen er 110 % af cirklen (stående: bunden i cirklens bund og toppen 10 %
// over; liggende: fra cirklens venstre kant og 10 % ud over højre), og
// lærredet vokser, så varen aldrig beskæres. Samme mål som før i CSS.
// Layout-reglen læses af AddProductView: bredere end højt = liggende.

export const CIRCLE_DIAMETER = 540;
export const CIRCLE_COLOR = "#eee9df"; // --hf-color-card (bg-hf-tan)
const OVERSHOOT = 1.1;

export type CircleLayout = {
  width: number;
  height: number;
  circle: { left: number; top: number };
  item: { left: number; top: number; width: number; height: number };
};

export function circleLayout(itemWidth: number, itemHeight: number, d = CIRCLE_DIAMETER): CircleLayout {
  const big = Math.round(d * OVERSHOOT);
  const landscape = itemWidth > itemHeight;
  const ratio = itemWidth / Math.max(1, itemHeight);
  if (landscape) {
    const w = big;
    const h = Math.max(1, Math.round(w / ratio));
    const height = Math.max(d, h);
    return {
      width: big,
      height,
      circle: { left: 0, top: Math.round((height - d) / 2) },
      item: { left: 0, top: Math.round((height - h) / 2), width: w, height: h },
    };
  }
  const h = big;
  const w = Math.max(1, Math.round(h * ratio));
  const width = Math.max(d, w);
  return {
    width,
    height: big,
    circle: { left: Math.round((width - d) / 2), top: big - d },
    item: { left: Math.round((width - w) / 2), top: 0, width: w, height: h },
  };
}

