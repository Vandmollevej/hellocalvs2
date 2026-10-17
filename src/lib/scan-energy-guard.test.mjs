// Kør: npm test  (node --test)
//
// Vagt for brugerens krav 2026-10-16 (Änglamark-letmælken fik "∼ 0 kalorier",
// fordi OpenAI-kreditten var brugt op, og flowet gik videre alligevel):
// - energi-trinnet klares først, når energien er læst (web + native),
// - scannede varer får aldrig et energiskøn,
// - overvågningen slår alarm, når OpenAI afviser kald.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const webFlow = read("../components/camera/ProductCaptureFlow.tsx");
const nativeFlow = read("../../native/shared/src/commonMain/kotlin/dk/packroff/hellocal/screens/capture/ProductCaptureFlow.kt");
const enrichment = read("./quick-product-enrichment.ts");
const frida = read("./frida-estimates.ts");
const uptime = read("../../.github/workflows/uptime.yml");

test("web: energi-trinnet venter på verifyEnergy, før trinnet markeres klaret", () => {
  const gate = webFlow.indexOf('need === "nutrition" && !(await verifyEnergy(');
  const markDone = webFlow.indexOf("markDone(need);");
  assert.ok(gate > 0, "verifyEnergy-porten mangler i shootLabel");
  assert.ok(gate < markDone, "trinnet markeres klaret før energien er læst");
});

test("native: energi-trinnet læser energien, før trinnet markeres klaret", () => {
  const gate = nativeFlow.indexOf("readEnergy(jpegDataUrl(bytes))");
  const completed = nativeFlow.indexOf("val completed = done + current", gate);
  assert.ok(gate > 0 && completed > gate, "native-porten mangler eller står efter trinnet er klaret");
});

test("scannede varer får aldrig et energiskøn", () => {
  assert.doesNotMatch(enrichment, /applyFridaEstimateTo|estimateNutritionFromType/);
  assert.equal((frida.match(/quickEnrichmentJob: \{ is: null \}/g) ?? []).length, 2);
});

test("overvågningen slår alarm, når OpenAI-kreditten er brugt op", () => {
  assert.match(uptime, /quota\) echo "::error::OpenAI/);
});

test("gemte scan-fotos opgives ikke, mens OpenAI-kreditten er tom", () => {
  const recovery = read("./quick-enrichment-jobs.ts");
  const gate = recovery.indexOf('ai.state === "quota"');
  const first = recovery.indexOf("await reopenBrokenProducts(now)");
  assert.ok(gate > 0 && gate < first, "genoptagelsen skal vente på kredit, før den bruger forsøg");
  assert.match(recovery, /repairRound/);
  // Forsiden læses igen, når AI'en aldrig har læst den, selv med et lokalt navn.
  assert.match(recovery, /aiAnalyses: \{ none: \{ kind: "FRONT" \} \}/);
});
