// Pixel-målte skitser af skærmbillederne i mappen "Hello Fresh inspiration".
// Koordinater er rå billedpixels fra iPhone-skærmbilleder i @3x (1206 × 2622),
// så `scale` billedpixels = 1 CSS-pixel. Tallene er målt med et script på
// billedets pixels (farveskift og afgrænsning af hvert element) — ikke aflæst
// med øjet. Tekst og ikoner er gengivet som massive kasser i deres egen farve.

export type SketchBox = {
  /** Kun til hover-titel og måltabel — vises ikke i skitsen. */
  name: string;
  /** Billedpixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Kassens farve. Udeladt = gennemsigtig (kun kant). */
  fill?: string;
  /** 1 CSS-pixel kant. */
  border?: string;
  /** CSS-pixels. */
  radius?: number;
};

export type Sketch = {
  id: string;
  title: string;
  /** Kildefil i "Hello Fresh inspiration/". */
  file: string;
  /** Nedskaleret original i public/. */
  image: string;
  scale: number;
  /** Billedpixels. */
  width: number;
  height: number;
  background: string;
  boxes: SketchBox[];
};

export const SKETCHES: Sketch[] = [
  {
    id: "img-2274",
    title: "Log ind (Hjælpecenter)",
    file: "IMG_2274.png",
    image: "/designmanual/skitser/IMG_2274.webp",
    scale: 3,
    width: 1206,
    height: 2622,
    background: "#FAF8F3",
    boxes: [
      { name: "Appbar inkl. statuslinje", x: 0, y: 0, w: 1206, h: 301, fill: "#067A46" },
      { name: "Klokkeslæt", x: 135, y: 78, w: 174, h: 41, fill: "#000000" },
      { name: "Statusikoner", x: 865, y: 77, w: 235, h: 41, fill: "#000000" },
      { name: "Tilbage-pil", x: 28, y: 206, w: 33, h: 57, fill: "#FFFFFF" },
      { name: "Titel", x: 433, y: 208, w: 341, h: 59, fill: "#FFFFFF" },
      { name: "Logo, frugt", x: 464, y: 346, w: 106, h: 90, fill: "#96DB12" },
      { name: "Logo, ordmærke", x: 585, y: 352, w: 157, h: 77, fill: "#232323" },
      { name: "Overskrift", x: 501, y: 564, w: 203, h: 72, fill: "#232323" },
      { name: "App Store-badge", x: 399, y: 721, w: 405, h: 135, fill: "#000000", border: "#A6A6A6", radius: 8 },
      { name: "App Store-badge, ikon", x: 431, y: 749, w: 62, h: 76, fill: "#FFFFFF" },
      { name: "App Store-badge, tekst", x: 515, y: 748, w: 255, h: 87, fill: "#FFFFFF" },
      { name: "Felt: e-mail", x: 72, y: 1000, w: 1062, h: 144, border: "#7D7561", radius: 4 },
      { name: "Placeholder", x: 112, y: 1054, w: 108, h: 37, fill: "#656565" },
      { name: "Felt: kodeord", x: 72, y: 1192, w: 1062, h: 144, border: "#7D7561", radius: 4 },
      { name: "Placeholder", x: 112, y: 1246, w: 169, h: 37, fill: "#656565" },
      { name: "Vis kodeord-ikon", x: 1035, y: 1230, w: 63, h: 53, fill: "#000000" },
      { name: "Afkrydsningsfelt", x: 72, y: 1426, w: 72, h: 72, fill: "#232323", radius: 4 },
      { name: "Afkrydsning, tekst", x: 171, y: 1444, w: 353, h: 46, fill: "#232323" },
      { name: "Glemt kodeord-link", x: 596, y: 1442, w: 490, h: 41, fill: "#232323" },
      { name: "Primær knap", x: 72, y: 1588, w: 1062, h: 144, fill: "#232323", radius: 8 },
      { name: "Primær knap, tekst", x: 526, y: 1639, w: 154, h: 46, fill: "#FFFFFF" },
      { name: "Skilletekst", x: 565, y: 1818, w: 76, h: 32, fill: "#232323" },
      { name: "Apple-knap", x: 72, y: 2116, w: 1062, h: 120, fill: "#000000", radius: 4 },
      { name: "Apple-knap, ikon", x: 120, y: 2146, w: 50, h: 60, fill: "#FFFFFF" },
      { name: "Apple-knap, tekst", x: 447, y: 2158, w: 385, h: 46, fill: "#FFFFFF" },
      { name: "Facebook-knap", x: 72, y: 2284, w: 1062, h: 120, fill: "#29487D", radius: 4 },
      { name: "Facebook-knap, ikon", x: 108, y: 2308, w: 72, h: 72, fill: "#FFFFFF" },
      { name: "Facebook-knap, tekst", x: 404, y: 2326, w: 472, h: 46, fill: "#FFFFFF" },
      { name: "Bundtekst", x: 248, y: 2494, w: 444, h: 37, fill: "#232323" },
      { name: "Bundtekst, link", x: 730, y: 2494, w: 228, h: 46, fill: "#232323" },
    ],
  },
];
