#!/usr/bin/env node
// Marks every route in a native area's <Area>Routes.kt as ported in the parity
// manifest, pointing at the Kotlin file that defines each screen function.
//   node scripts/native/port-area.mjs native/shared/src/commonMain/kotlin/dk/packroff/hellocal/screens/settings
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = process.argv[2];
const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".kt"));
const routesFile = files.find((f) => /Routes\.kt$/.test(f));
const routesSrc = readFileSync(join(ROOT, dir, routesFile), "utf8");
for (const m of routesSrc.matchAll(/ScreenRoute\(\s*"([^"]+)"[^)]*\)\s*\{\s*(\w+)\(/g)) {
  const [, route, fn] = m;
  const file = files.find((f) => new RegExp(`fun\\s+${fn}\\s*\\(`).test(readFileSync(join(ROOT, dir, f), "utf8")));
  if (!file) {
    console.error(`! ${route}: fandt ikke ${fn}`);
    continue;
  }
  execFileSync("node", [join(ROOT, "scripts/native/parity.mjs"), "--port", route, `${dir}/${file}`], { stdio: "inherit" });
}
