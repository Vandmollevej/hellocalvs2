// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanBackPhotoAnalysis, fineReadFindings, wordSimilarity } from "./back-photo-ai.ts";

test("finlæsningen foreslår rettelser, hvor samme ord står forskelligt", () => {
  const stored = "Glutenfri havremel, boghvedemel, SOIASAUCE, krydderler, salt";
  const fine = "Glutenfri havremel, boghvedemel, SOJASAUCE, krydderier, salt";
  const findings = fineReadFindings(stored, fine);
  assert.deepEqual(
    findings.map((finding) => [finding.word, finding.suggestion]),
    [
      ["SOIASAUCE", "SOJASAUCE"],
      ["krydderler", "krydderier"],
    ],
  );
  assert.equal(stored.slice(findings[0].start, findings[0].end), "SOIASAUCE");
});

test("store/små bogstaver og ens tekst giver ingen forslag", () => {
  assert.deepEqual(fineReadFindings("hvedemel, SUKKER, salt", "Hvedemel, sukker, salt"), []);
});

test("en helt anden liste (andet sprog) sammenlignes ikke", () => {
  assert.deepEqual(fineReadFindings("hvedemel, sukker, salt, gær", "Weizenmehl, Zucker, Salz, Hefe"), []);
});

test("ord, der ikke ligner hinanden, foreslås ikke", () => {
  const findings = fineReadFindings("hvedemel, sukker, salt, gær, vand, olie", "hvedemel, sukker, peber, gær, vand, olie");
  assert.deepEqual(findings, []);
});

test("ordlighed", () => {
  assert.equal(wordSimilarity("krydderler", "krydderier"), 0.9);
  assert.equal(wordSimilarity("Salt", "salt"), 1);
});

test("AI-svaret ryddes: tal, tekster og mærker", () => {
  const analysis = cleanBackPhotoAnalysis({
    labels: [{ key: "Ø-mærket", name: "Ø-mærket", text: null, category: "ORGANIC", box: null, confidence: 0.95 }],
    ingredientsText: "  hvedemel,\n sukker ",
    nutritionText: "",
    otherText: null,
    textConfidence: 3,
    overallConfidence: "x",
  });
  assert.equal(analysis.labels[0].key, "oe-maerket");
  assert.equal(analysis.ingredientsText, "hvedemel, sukker");
  assert.equal(analysis.nutritionText, null);
  assert.equal(analysis.textConfidence, 1);
  assert.equal(analysis.overallConfidence, 0);
});
