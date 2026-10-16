// Kør: npm test  (node --test)
//
// Scan-appen (Oprettelses-appen, `src/app/scan/**`) tager ALDRIG billeder
// automatisk (bruger 2026-10-14): medarbejderen trykker selv på udløseren,
// også med en Bluetooth-udløser i den anden hånd. Det virker, fordi appen
// åbner telefonens eget kamera via `<input type="file" capture="environment">`
// — Bluetooth-udløsere trykker på kameraets egen udløserknap. Hello Cals
// automatiske kameraflow (`src/components/camera/**`, ingen "Tag billede"-knap)
// må derfor aldrig bruges i scan-appen. Testen fejler, hvis nogen skifter til
// et levende kamera i siden eller glemmer `capture` på et filfelt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir) {
  return readdirSync(`${root}${dir}`).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(`${root}${path}`).isDirectory()) return walk(path);
    return /\.(tsx?|mjs)$/.test(name) ? [path] : [];
  });
}

// Alt, scan-appen er bygget af: siderne, dens egne komponenter og de delte
// fotofelter ("Opret vare" bruger Hello Cals 2×2-gitter).
const SCAN_APP_FILES = [
  ...walk("src/app/scan"),
  ...walk("src/components/scan"),
  "src/components/hf/CreateProductMediaGrid.tsx",
];

// Kode, der betyder et levende kamera i siden og automatisk udløsning.
const LIVE_CAMERA = [
  "@/components/camera/",
  "useAutoCapture",
  "useLiveFrames",
  "getUserMedia",
  "decodeFromVideo",
  "decodeFromConstraints",
  "decodeOnceFromVideo",
  "@/lib/camera-still",
  "@/lib/barcode-frame-scanner",
];

test("scan-appen bruger kun telefonens eget kamera (manuel udløser)", () => {
  let fileInputs = 0;
  for (const path of SCAN_APP_FILES) {
    const source = readFileSync(`${root}${path}`, "utf8");
    for (const needle of LIVE_CAMERA) {
      assert.ok(!source.includes(needle), `${path} bruger ${needle} — scan-appen må ikke scanne/fotografere automatisk`);
    }
    assert.ok(!/<video\b/.test(source), `${path} har et <video>-element — scan-appen må ikke vise et levende kamera`);
    for (const match of source.matchAll(/<input\b[^>]*type="file"[^>]*>/gs)) {
      fileInputs += 1;
      assert.match(match[0], /capture="environment"/, `${path}: filfeltet skal åbne telefonens kamera (capture="environment")`);
      assert.match(match[0], /accept="image\/\*"/, `${path}: filfeltet skal kun tage billeder`);
    }
  }
  // Hyldebilledet + de fire bokse i "Opret vare" (+ ekstra billeder).
  assert.ok(fileInputs >= 3, `fandt kun ${fileInputs} filfelter i scan-appen`);
});
