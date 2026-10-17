// Klasse-regel (bruger 2026-10-17): ALT indhold skal kunne rulles fri af
// bundcirklen. Enhver fil, der tegner <BottomNav />, skal give sin rulleflade
// afstandsklassen .hf-screen-scroll--arc (eller lægge knapperne i HfScreen-footeren).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

test("every screen with the bottom menu reserves room for the half-circle", () => {
  const offenders = walk("src")
    .filter((p) => !p.endsWith("BottomNav.tsx"))
    .filter((p) => {
      const s = readFileSync(p, "utf8");
      if (!s.includes("<BottomNav")) return false;
      // Forsiden: rullefladen ligger i DailyList.
      if (s.includes("<DailyList")) return !readFileSync("src/components/DailyList.tsx", "utf8").includes("hf-screen-scroll--arc");
      return !s.includes("hf-screen-scroll--arc");
    });
  assert.deepEqual(offenders, [], "Rulleflader over bundmenuen mangler .hf-screen-scroll--arc");
});

test("the clearance class is a spacer taller than the half-circle", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.hf-screen-scroll--arc::after\s*\{[^}]*height:\s*calc\(40px \+ 1rem\)/);
});
