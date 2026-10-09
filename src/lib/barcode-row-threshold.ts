// Local (sliding-window) thresholding of one scan line of luminance values,
// for the live barcode decode on `/camera?mode=product`.
//
// ZXing binarises a 1D scan line with ONE black point for the whole row
// (GlobalHistogramBinarizer.getBlackRow). A shadow across part of the
// barcode — a hand, the phone itself, a shelf edge — makes the white spaces
// in the shaded part darker than the black bars in the lit part, so no
// single threshold separates bars from spaces and the row never decodes
// (user report 2026-10-06: a milk carton with a small shadow could not be
// read, while other scanner apps read it at once).
//
// Here every pixel is compared with the mean of its own neighbourhood
// instead, so only the local contrast between a bar and its surrounding
// spaces matters, not the brightness elsewhere on the row. Pure arithmetic,
// no ZXing types — `barcode-local-binarizer.ts` plugs it into ZXing.

// Window width as a fraction of the row: must cover several bars AND
// spaces around any pixel (the widest EAN element is 4 modules, up to ~40 px
// on the 960 px decode canvas), yet stay far smaller than a shadow's soft
// edge so the mean follows the lighting.
export const LOCAL_WINDOW_FRACTION = 0.1;
export const MIN_LOCAL_WINDOW = 32;
// A pixel is dark only if it is at least this much (0–255) below the local
// mean. Uniform areas — quiet zones, plain packaging, black print — are
// then white, so sensor noise doesn't turn into stray bars.
export const MIN_DARK_CONTRAST = 8;

// Returns one byte per pixel: 1 = dark (bar), 0 = light (space).
export function thresholdRowLocally(luminances: ArrayLike<number>, width: number): Uint8Array {
  const dark = new Uint8Array(width);
  if (width < 3) return dark;
  const window = Math.max(MIN_LOCAL_WINDOW, Math.round(width * LOCAL_WINDOW_FRACTION));
  const half = window >> 1;

  // Prefix sums → O(1) window mean per pixel.
  const prefix = new Float64Array(width + 1);
  for (let x = 0; x < width; x += 1) prefix[x + 1] = prefix[x] + (luminances[x] & 0xff);

  // Same 3-pixel sharpening as ZXing's own row binariser, so soft (slightly
  // out-of-focus) bar edges still land on the right side of the threshold.
  let left = luminances[0] & 0xff;
  let centre = luminances[1] & 0xff;
  for (let x = 1; x < width - 1; x += 1) {
    const right = luminances[x + 1] & 0xff;
    const from = Math.max(0, x - half);
    const to = Math.min(width, x + half + 1);
    const mean = (prefix[to] - prefix[from]) / (to - from);
    if ((centre * 4 - left - right) / 2 < mean - MIN_DARK_CONTRAST) dark[x] = 1;
    left = centre;
    centre = right;
  }
  return dark;
}
