// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareTexts, findCopy } from "./recipe-copy-check.ts";

const original =
  "Hak løget fint og steg det i olie i fem minutter. Tilsæt kødet og brun det let. Hæld tomaterne i og lad det simre i tyve minutter.";

test("identisk tekst giver 100 % sammenfald", () => {
  const result = compareTexts(original, original);
  assert.equal(result.ratio, 1);
  assert.deepEqual(result.candidateRanges, [[0, result.candidateWords.length]]);
});

test("helt forskellig tekst giver 0 %", () => {
  const result = compareTexts(original, "Bland mel, æg og mælk til en glat dej og bag pandekager på panden.");
  assert.equal(result.ratio, 0);
  assert.deepEqual(result.candidateRanges, []);
});

test("lidt omskrevet tekst flagges over 80 %, tydeligt omskrevet ikke", () => {
  const nearCopy = original.replace("fem", "5").replace("tyve", "20");
  const hit = findCopy(nearCopy, [{ kind: "shared", id: "a", name: "Original", text: original }]);
  assert.ok(hit && hit.ratio >= 0.8);
  assert.equal(hit.source.id, "a");
  const rewritten =
    "Skær løg i små stykker, svits dem blødt i lidt fedt. Kom hakket kød i panden. Tilføj flåede tomater og kog retten længe ved svag varme.";
  assert.equal(findCopy(rewritten, [{ kind: "shared", id: "a", name: "Original", text: original }]), null);
});
