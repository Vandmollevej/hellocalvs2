// Kør: npm test  (node --test)
//
// Vagt (fundet 2026-10-17): instrumentation.ts lå i projektroden, men appen
// bruger src/app, og så leder Next kun i src/. Standalone-buildet fik derfor
// ingen instrumentation-fil, startScheduler() kørte aldrig, og INGEN af
// appens planlagte job (reparation af nye varer, vedligehold, oversættelser
// osv.) har nogensinde kørt i produktion.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const at = (path) => new URL(path, import.meta.url);

test("instrumentation ligger i src/ ved siden af src/app", () => {
  assert.ok(existsSync(at("../app")), "src/app findes");
  assert.ok(existsSync(at("../instrumentation.ts")), "src/instrumentation.ts mangler");
  assert.ok(!existsSync(at("../../instrumentation.ts")), "instrumentation.ts i roden ignoreres af Next — flyt den til src/");
});

test("instrumentation starter scheduleren", () => {
  const source = readFileSync(at("../instrumentation.ts"), "utf8");
  assert.match(source, /startScheduler\(\)/);
});

test("eskaleringen sender ikke én mail pr. gammel sag (vindue 48-72 t)", () => {
  const scheduler = readFileSync(at("./scheduler.ts"), "utf8");
  assert.equal((scheduler.match(/createdAt: \{ lt: cutoff, gte: windowStart \}/g) ?? []).length, 2);
});
