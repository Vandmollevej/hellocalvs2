// Generates the admin designmanual sketches (src/app/admin/designmanual/skitser/data)
// from the images in "Hello Fresh inspiration".
//
//   node scripts/design-sketches/build.mjs                 all images
//   node scripts/design-sketches/build.mjs "IMG_2274.png"  one image (index is rebuilt)
//   SKETCH_SRC="C:\path\to\folder" node scripts/design-sketches/build.mjs
//
// Images not in MANIFEST are included automatically after the listed ones,
// titled by file name (iPhone screenshots 1206 px wide get scale 3, others 1).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { segment } from "./segment.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = process.env.SKETCH_SRC || path.join(ROOT, "Hello Fresh inspiration");
const OUT = path.join(ROOT, "src/app/admin/designmanual/skitser/data");

// file → [title, scale]; the order is the page order
const MANIFEST = [
  ["Startside.png", "Startside", 3],
  ["Loaderbillede.png", "Indlæser", 3],
  ["IMG_2270.png", "Opstart", 3],
  ["IMG_2278.png", "Velkommen (1)", 3],
  ["IMG_2279.png", "Velkommen (2)", 3],
  ["Sproglag.png", "Vælg dit land", 3],
  ["Log-in.png", "Tilmeld dig / Log ind", 3],
  ["IMG_2274.png", "Log ind (Hjælpecenter)", 3],
  ["IMG_2301.png", "Log ind på HelloFresh-konto", 3],
  ["IMG_2302.png", "Log ind (rullet ned)", 3],
  ["Log-ind konto.png", "Log ind med kodeord", 3],
  ["Log-ind konto 2.png", "Log ind med link", 3],
  ["IMG_2304.png", "Opret din konto", 3],
  ["Design af liste-visning.png", "Onboarding: foretrukne proteiner", 3],
  ["Liste visning med billeder.png", "Onboarding: verdenskøkkener", 3],
  ["IMG_1250.PNG", "Onboarding: tom side", 3],
  ["IMG_1251.PNG", "Onboarding: dine mål", 3],
  ["IMG_2294.png", "Onboarding: dine mål (2)", 3],
  ["IMG_1252.PNG", "Onboarding: ingredienserne", 3],
  ["IMG_2292.png", "Onboarding: postnummer", 3],
  ["IMG_2293.png", "Onboarding: hvor mange skal spise", 3],
  ["Oprettelsesflow.png", "Onboarding: hvor mange skal spise (2)", 3],
  ["IMG_2296.png", "Onboarding: ingredienser at undgå", 3],
  ["IMG_2297.png", "Onboarding: smagspræferencer", 3],
  ["IMG_2298.png", "Onboarding: hvor ofte", 3],
  ["IMG_2299.png", "Onboarding: hvor ofte (rullet ned)", 3],
  ["IMG_1253.PNG", "Onboarding: portioner og pris", 3],
  ["IMG_2300.png", "Onboarding: portioner og pris (2)", 3],
  ["IMG_2295.png", "Onboarding: vilkår og betingelser", 3],
  ["IMG_1248.PNG", "Opdag", 3],
  ["IMG_2271.png", "Opdag (indlæser)", 3],
  ["IMG_2289.png", "Opdag: brug det, du har", 3],
  ["IMG_2290.png", "Højt bedømt af fællesskabet", 3],
  ["IMG_2280.png", "Europæisk: opskriftsliste", 3],
  ["IMG_2272.png", "Europæisk: opret konto-ark", 3],
  ["IMG_2281.png", "Opskrift: Auberginepizza", 3],
  ["IMG_2282.png", "Opskrift: beskrivelse og ingredienser", 3],
  ["IMG_2285.png", "Opskrift: ingrediensliste", 3],
  ["IMG_2284.png", "Opskrift: fremgangsmåde", 3],
  ["IMG_2286.png", "Opskrift: næringsværdier", 3],
  ["IMG_1247.PNG", "Kogebog", 3],
  ["IMG_2287.png", "Velkommen til Discover", 3],
  ["IMG_2288.png", "Lav din indkøbsliste", 3],
  ["IMG_2291.png", "Notifikationer", 3],
  ["IMG_1249.PNG", "Indstillinger", 3],
  ["IMG_2275.png", "Privatindstillinger og sprog", 3],
  ["IMG_2276.png", "Hjælpecenter: forside", 3],
  ["IMG_2277.png", "Hjælpecenter: rabatbanner", 3],
  ["IMG_2305.png", "Hjælpecenter: rabatbanner (2)", 3],
  ["IMG_2273.png", "Hjælpecenter: ofte stillede spørgsmål", 3],
  ["IMG_2317.PNG", "Health Access", 3],
  ["IMG_2318.PNG", "Health Access: liste", 3],
  ["Favoritikon.jpg", "Favoritikon (udsnit)", 3],
  ["Sådan skal alle bokse være i farve og billeder vises.jpg", "Kategoriboks (udsnit)", 1],
  ["IMG_2303.webp", "Konfetti-ikon", 1],
  ["Hello Fresh logo.png", "Logo på grøn", 3],
  ["Hellofresh.png", "Logo, bred", 4],
];

const idOf = (file) =>
  "hf-" +
  file
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function nameOf(b, W, H) {
  switch (b.kind) {
    case "surface":
      return b.y === 0 && b.w >= W - 2 ? "Topbar" : b.y + b.h >= H - 2 && b.w >= W - 2 ? "Bundbar" : "Flade";
    case "outline":
      return "Kantboks";
    case "image":
      return "Billede";
    case "text":
      return "Tekst";
    case "line":
      return "Linje";
    case "status":
      return b.side === "left" ? "Statuslinje, klokkeslæt" : "Statuslinje, ikoner";
    default:
      return "Ikon";
  }
}

async function writeSketch(file, title, scale) {
  const id = idOf(file);
  const src = path.join(SRC, file);
  const seg = await segment(src, scale);
  const cssW = seg.width / scale;
  const webp = await sharp(src).resize({ width: Math.round(cssW * 1.5) }).flatten({ background: "#ffffff" }).webp({ quality: 60 }).toBuffer();
  const boxes = seg.boxes.map((b) => {
    const o = { name: b.name || nameOf(b, seg.width, seg.height), kind: b.kind === "status" ? "icon" : b.kind, x: b.x, y: b.y, w: b.w, h: b.h };
    if (b.fill) o.fill = b.fill;
    if (b.border) o.border = b.border;
    if (b.borderWidth && b.borderWidth > 1) o.borderWidth = b.borderWidth;
    if (b.radius) o.radius = b.radius;
    return o;
  });
  const body = [
    `// Genereret af scripts/design-sketches/build.mjs ud fra "Hello Fresh inspiration/${file}". Ret ikke i hånden.`,
    'import type { Sketch } from "../sketch-types";',
    "",
    "const sketch: Sketch = {",
    `  id: ${JSON.stringify(id)},`,
    `  title: ${JSON.stringify(title)},`,
    `  file: ${JSON.stringify(file)},`,
    `  scale: ${scale},`,
    `  width: ${seg.width},`,
    `  height: ${seg.height},`,
    `  background: ${JSON.stringify(seg.background)},`,
    "  boxes: [",
    ...boxes.map((b) => "    " + JSON.stringify(b).replace(/"(\w+)":/g, "$1: ") + ","),
    "  ],",
    `  image: "data:image/webp;base64,${webp.toString("base64")}",`,
    "};",
    "",
    "export default sketch;",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, id + ".ts"), body);
  console.log(id, boxes.length, "boxes", Math.round(webp.length / 1024) + "KB");
}

const only = process.argv[2];
const present = fs.readdirSync(SRC).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const entries = MANIFEST.filter(([file]) => present.includes(file));
for (const file of present.sort()) {
  if (entries.some(([f]) => f === file)) continue;
  const meta = await sharp(path.join(SRC, file)).metadata();
  entries.push([file, file.replace(/\.[^.]+$/, ""), meta.width === 1206 ? 3 : 1]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [file, title, scale] of entries) {
  if (only && only !== file) continue;
  await writeSketch(file, title, scale);
}
const index = [
  "// Genereret af scripts/design-sketches/build.mjs. Rækkefølgen er visningsrækkefølgen.",
  'import type { Sketch } from "../sketch-types";',
  ...entries.map(([file], i) => `import s${i} from "./${idOf(file)}";`),
  "",
  "export const SKETCHES: Sketch[] = [",
  ...entries.map((_, i) => `  s${i},`),
  "];",
  "",
].join("\n");
fs.writeFileSync(path.join(OUT, "index.ts"), index);
console.log("index", entries.length);
