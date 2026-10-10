// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findConversionIn, gramsToMeasure, volumeToGrams } from "./kitchen-conversion-units.ts";

const data = JSON.parse(readFileSync(new URL("../data/kitchen-conversions.json", import.meta.url), "utf8"));
const find = (name) => findConversionIn(data.items, name)?.id ?? null;

test("tabellen er gyldig: unikke id'er, grupper findes, tal i fornuftigt spænd", () => {
  const groups = new Set(data.groups.map((group) => group.id));
  const ids = new Set();
  for (const item of data.items) {
    assert.ok(!ids.has(item.id), item.id);
    ids.add(item.id);
    assert.ok(groups.has(item.group), item.group);
    assert.ok(item.gramsPerDl >= 30 && item.gramsPerDl <= 150, item.name);
    assert.ok(item.keywords.length > 0, item.name);
  }
});

test("længste nøgleord vinder, og kun hele ord", () => {
  assert.equal(find("Kokosmælk"), "kokosmaelk");
  assert.equal(find("Arla Letmælk 1,5 % (1 l)"), "letmaelk");
  assert.equal(find("Mælk"), "soedmaelk");
  assert.equal(find("Ekstra jomfru olivenolie"), "olivenolie");
  assert.equal(find("Saftevand"), "saftevand");
  assert.equal(find("Sukkerærter"), null);
  assert.equal(find("Melis"), null);
  assert.equal(find("2 æggehvider"), "aeggehvide");
  assert.equal(find("Coca-Cola Zero"), "sodavand-uden-sukker");
  assert.equal(find(""), null);
});

test("dl → gram og gram → dl", () => {
  const milk = data.items.find((item) => item.id === "soedmaelk");
  assert.equal(volumeToGrams(2, "dl", milk), 206);
  assert.equal(volumeToGrams(1, "spsk", milk), 15.45);
  assert.equal(volumeToGrams(2, "stk", milk), null);
  assert.deepEqual(gramsToMeasure(206, milk), { amount: 2, unit: "dl" });
  assert.deepEqual(gramsToMeasure(60, milk), { amount: 0.6, unit: "dl" });
  assert.deepEqual(gramsToMeasure(31, milk), { amount: 2, unit: "spsk" });
  assert.deepEqual(gramsToMeasure(5, milk), { amount: 1, unit: "tsk" });
  const flour = data.items.find((item) => item.id === "hvedemel");
  assert.equal(volumeToGrams(3, "dl", flour), 180);
});
