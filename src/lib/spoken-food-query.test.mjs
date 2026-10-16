import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpokenFoodQuery } from "./spoken-food-query.ts";

const q = (text) => parseSpokenFoodQuery(text).query;

test("talte sætninger giver kun varen", () => {
  assert.equal(q("Jeg har spist en bakke pomfritter"), "pomfritter");
  assert.equal(q("jeg har lige spist 2 skiver rugbrød til frokost"), "rugbrød");
  assert.equal(q("Jeg har drukket et glas mælk"), "mælk");
  assert.equal(q("jeg spiste en banan"), "banan");
  assert.equal(q("I just had a bowl of oatmeal for breakfast"), "oatmeal");
  assert.equal(q("Ich habe einen Apfel gegessen"), "Apfel");
  assert.equal(q("jag har ätit en kanelbulle"), "kanelbulle");
  assert.equal(parseSpokenFoodQuery("Jeg har spist en bakke pomfritter").spoken, true);
});

test("almindelige søgninger røres ikke", () => {
  assert.deepEqual(parseSpokenFoodQuery("pomfritter"), { query: "pomfritter", spoken: false });
  assert.equal(q("Mælk"), "Mælk");
  assert.equal(q("arla letmælk"), "arla letmælk");
  assert.equal(parseSpokenFoodQuery("Tre Stjerner").spoken, false);
  assert.equal(q("jeg har spist"), "jeg har spist");
});
