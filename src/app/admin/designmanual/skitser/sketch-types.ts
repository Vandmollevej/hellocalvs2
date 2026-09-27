// Pixel-målte skitser af billederne i mappen "Hello Fresh inspiration".
// Data i ./data er genereret af et script, der læser billedets pixels
// (farveskift og afgrænsning af hvert element) — ikke aflæst med øjet.
// Koordinater er rå billedpixels; `scale` billedpixels = 1 CSS-pixel
// (3 for iPhone-skærmbilleder i @3x).

export type SketchBoxKind = "surface" | "outline" | "image" | "text" | "icon" | "line";

export type SketchBox = {
  /** Kun til hover-titel og måltabel — vises ikke i skitsen. */
  name: string;
  kind: SketchBoxKind;
  /** Billedpixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Kassens farve (gennemsnitsfarve for billeder). Udeladt = gennemsigtig. */
  fill?: string;
  border?: string;
  /** CSS-pixels, standard 1. */
  borderWidth?: number;
  /** CSS-pixels. */
  radius?: number;
};

export type Sketch = {
  id: string;
  title: string;
  /** Kildefil i "Hello Fresh inspiration/". */
  file: string;
  scale: number;
  /** Billedpixels. */
  width: number;
  height: number;
  background: string;
  boxes: SketchBox[];
  /** Nedskaleret original som data-URL, så den kun vises bag admin-login. */
  image: string;
};
