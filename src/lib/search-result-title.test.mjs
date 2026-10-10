// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { searchResultTitle } from "./search-result-title.ts";

test("brand og subbrand står først", () => {
  assert.equal(searchResultTitle({ name: "Instant kaffe", brand: "Nescafé", subbrand: "Gold" }), "Nescafé Gold Instant kaffe");
  assert.equal(searchResultTitle({ name: "Skyr naturel", brand: "Arla" }), "Arla Skyr naturel");
  assert.equal(searchResultTitle({ name: "Gulerødder" }), "Gulerødder");
});

test("brand og subbrand i navnet flyttes frem uden gentagelse", () => {
  assert.equal(searchResultTitle({ name: "Gold", brand: "Nescafé", subbrand: "Gold" }), "Nescafé Gold");
  assert.equal(searchResultTitle({ name: "Gold Instant kaffe", brand: "Nescafé", subbrand: "Gold" }), "Nescafé Gold Instant kaffe");
  assert.equal(searchResultTitle({ name: "Instant kaffe, Gold", brand: "Nescafe", subbrand: "Gold" }), "Nescafe Gold Instant kaffe");
  assert.equal(searchResultTitle({ name: "Nescafe Gold Instant kaffe", brand: "Nescafé", subbrand: "Gold" }), "Nescafé Gold Instant kaffe");
  assert.equal(searchResultTitle({ name: "Arla Skyr", brand: "Arla" }), "Arla Skyr");
});

test("subbrand der begynder med brandet gentager ikke brandet", () => {
  assert.equal(searchResultTitle({ name: "Protein Drik vanilje", brand: "Arla", subbrand: "Arla Protein" }), "Arla Protein Drik vanilje");
  assert.equal(searchResultTitle({ name: "Arla Protein Drik", brand: "Arla", subbrand: "Arla Protein" }), "Arla Protein Drik");
});

test("kun hele ord flyttes", () => {
  assert.equal(searchResultTitle({ name: "Letmælk", brand: "Let" }), "Let Letmælk");
  assert.equal(searchResultTitle({ name: "Arlas mælk", brand: "Arla" }), "Arla Arlas mælk");
});
