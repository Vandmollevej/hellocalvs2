import { test } from "node:test";
import assert from "node:assert/strict";
import { displayNameForQuery, parseNumberQuery } from "./danish-number.ts";

const apple = { name: "Standardnavn", nameSingular: "Rødt æble", namePlural: "Røde æbler" };

test("søgeord uden artikel vælger den tilsvarende titel", () => {
  assert.equal(displayNameForQuery(apple, parseNumberQuery("æble")), "Rødt æble");
  assert.equal(displayNameForQuery(apple, parseNumberQuery("ÆBLER")), "Røde æbler");
});

test("artikler bevarer deres eksplicitte ental eller flertal", () => {
  assert.equal(displayNameForQuery(apple, parseNumberQuery("et æble")), "Rødt æble");
  assert.equal(displayNameForQuery(apple, parseNumberQuery("nogle æbler")), "Røde æbler");
});

test("fælles ord, delord og manglende former beholder standardtitlen", () => {
  const milk = { name: "Mælk standard", nameSingular: "Mælk", namePlural: "Mælk" };
  assert.equal(displayNameForQuery(milk, parseNumberQuery("mælk")), "Mælk standard");
  assert.equal(displayNameForQuery(apple, parseNumberQuery("æb")), "Standardnavn");
  assert.equal(displayNameForQuery({ name: "Ris" }, parseNumberQuery("ris")), "Ris");
});
