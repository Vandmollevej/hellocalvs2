// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_FIX_CONFIDENCE,
  applySafeCorrections,
  contextAround,
  createDictionary,
  findSpellingIssues,
  locate,
  replaceAt,
  suggestWord,
} from "./spelling-engine.ts";

test("katalogets ordforråd: et ord i mindst 3 varer er kendt, i 1 vare ikke", () => {
  const common = createDictionary({ frequency: new Map([["kardemomme", 12]]) });
  assert.equal(suggestWord("kardemomme", common), null);
  const known = createDictionary({ frequency: new Map([["kardemomme", 12]]) });
  const fix = suggestWord("kardernomme", known);
  assert.equal(fix?.suggestion, "kardemomme");
  assert.equal(fix?.reason, "look_alike");
  assert.ok(fix.confidence >= AUTO_FIX_CONFIDENCE);
});

test("ord i kun én vare uden forveksling røres ikke", () => {
  const dictionary = createDictionary({ frequency: new Map([["yuzu", 1]]) });
  assert.equal(suggestWord("yuzu", dictionary), null);
});

test("admins afgørelser: lært rettelse (store bogstaver bevares) og rigtigt ord", () => {
  const dictionary = createDictionary({ corrections: [["soiabønne", "sojabønne"]], knownWords: ["gochujang"] });
  assert.deepEqual(suggestWord("SOIABØNNE", dictionary), { word: "SOIABØNNE", suggestion: "SOJABØNNE", confidence: 1, reason: "learned" });
  assert.equal(suggestWord("gochujang", dictionary), null);
});

test("lige gode forslag giver intet forslag; det udbredte ord vinder ellers", () => {
  // "seil" → "sejl" (i/j) eller "sell" (i/l): lige gode uden ordforråd.
  assert.equal(suggestWord("seil", createDictionary({ knownWords: ["sejl", "sell"] })), null);
  const corpus = createDictionary({ frequency: new Map([["sejl", 20], ["sell", 3]]) });
  assert.equal(suggestWord("seil", corpus)?.suggestion, "sejl");
});

test("volapyk og næringstabel er fund, men kun næringstabellen slettes uden et menneske", () => {
  const text = "Chili, vand, salt, ee, 699k1, citronsyre £202. ee .06 kcal | Fnergi";
  const findings = findSpellingIssues(text, createDictionary());
  assert.deepEqual(
    findings.map((finding) => [finding.reason, finding.word]),
    [
      ["junk", "ee"],
      ["junk", "699k1"],
      ["e_number", "£202"],
      ["nutrition", " ee .06 kcal | Fnergi"],
    ],
  );
  const result = applySafeCorrections(text, createDictionary());
  assert.equal(result.text, "Chili, vand, salt, ee, 699k1, citronsyre E202.");
  assert.deepEqual(result.uncertain.map((finding) => finding.word), ["ee", "699k1"]);
});

test("sletning midt i listen rydder kommaerne op", () => {
  const text = "vand, ee, salt";
  assert.equal(replaceAt(text, 6, 8, ""), "vand, salt");
});

test("sammenhæng omkring ordet klippes ved hele ord", () => {
  const text = "Chili, vand, vegetabilsk olie, bordsalt, SOIASAUCE, mononatriumglutamat (MSG), brygget sauce";
  const start = text.indexOf("SOIASAUCE");
  const context = contextAround(text, start, start + 9, 20);
  assert.equal(context.word, "SOIASAUCE");
  assert.ok(context.before.startsWith("…") && context.after.endsWith("…"));
});

test("ordet findes igen nærmest sin gamle placering", () => {
  const text = "salt, ee, vand, ee, olie";
  assert.equal(locate(text, "ee", 16), 16);
  assert.equal(locate(text, "ee", 0), 6);
  assert.equal(locate("vandee, olie", "ee", 0), null);
});

test("robottens rapport: ukendt ord i kun én vare meldes uden forslag, når kataloget er stort", () => {
  const frequency = new Map(Array.from({ length: 250 }, (_, index) => [`ord${"x".repeat(index % 7)}${index}`, 5]));
  frequency.set("diastarkfosfat", 1);
  const dictionary = createDictionary({ frequency });
  const findings = findSpellingIssues("Vand, diastarkfosfat, salt", dictionary, { reportUnknown: true });
  assert.deepEqual(findings.map((finding) => [finding.reason, finding.word, finding.suggestion]), [["unknown", "diastarkfosfat", null]]);
  assert.deepEqual(findSpellingIssues("Vand, diastarkfosfat, salt", dictionary), []);
});

test("tal, der ligner bogstaver, er en forveksling — ikke volapyk", () => {
  const fix = suggestWord("SENNEPSFR0", createDictionary());
  assert.equal(fix?.suggestion, "SENNEPSFRØ");
  assert.equal(fix?.reason, "look_alike");
  assert.equal(suggestWord("699k1", createDictionary())?.reason, "junk");
});

test("grundlistens ord er sikre, selv når kataloget kun har dem i få varer", () => {
  const dictionary = createDictionary({ frequency: new Map([["sojasauce", 1], ["citronsyre", 3]]) });
  assert.ok(suggestWord("SOIASAUCE", dictionary).confidence >= AUTO_FIX_CONFIDENCE);
  assert.ok(suggestWord("cltronsyre", dictionary).confidence >= AUTO_FIX_CONFIDENCE);
});
