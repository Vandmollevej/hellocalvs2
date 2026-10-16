// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { nameCandidates, pickProductType } from "./front-text-name-rules.ts";

test("candidates are lowercase words and word pairs from each line", () => {
  const candidates = nameCandidates(["ÄNGLAMARK\nØKOLOGISK LETMÆLK 1 liter", null]);
  assert.ok(candidates.includes("änglamark"));
  assert.ok(candidates.includes("letmælk"));
  assert.ok(candidates.includes("økologisk letmælk"));
  assert.ok(!candidates.includes("1"));
  // Ordpar går aldrig på tværs af linjer.
  assert.ok(!candidates.includes("änglamark økologisk"));
});

test("the most specific known name wins (Letmælk over Mælk)", () => {
  const rows = [
    { name: "Mælk", count: 40 },
    { name: "Letmælk", count: 25 },
    { name: "LETMÆLK", count: 2 },
  ];
  assert.equal(pickProductType(rows), "Letmælk");
});

test("a name needs at least two products and is never the brand", () => {
  assert.equal(pickProductType([{ name: "Letmælk", count: 1 }]), null);
  assert.equal(pickProductType([{ name: "Änglamark", count: 9 }, { name: "Mælk", count: 3 }], ["Änglamark"]), "Mælk");
});
