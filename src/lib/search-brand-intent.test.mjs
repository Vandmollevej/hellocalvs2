// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { queryNamesBrand, queryNamesSubbrand, queryWithoutNames } from "./search-brand-intent.ts";

const brands = ["Arla", "Øllingegaard", "Coca-Cola", "Let"];

test("bred søgning nævner intet brand", () => {
  assert.equal(queryNamesBrand("letmælk", brands), false);
  assert.equal(queryNamesBrand("mælk", brands), false);
  assert.equal(queryNamesBrand("arl", brands), false);
  assert.equal(queryNamesBrand("", brands), false);
});

test("brand som helt ord tæller som brand-søgning", () => {
  assert.equal(queryNamesBrand("arla", brands), true);
  assert.equal(queryNamesBrand("Arla letmælk", brands), true);
  assert.equal(queryNamesBrand("letmælk arla", brands), true);
  assert.equal(queryNamesBrand("Øllingegaard skummetmælk", brands), true);
  assert.equal(queryNamesBrand("coca cola zero", brands), true);
  assert.equal(queryNamesBrand("let mælk", brands), true);
});

test("subbrand tæller alene eller med brandet foran", () => {
  assert.equal(queryNamesSubbrand("cheasy", "Cheasy", "Arla"), true);
  assert.equal(queryNamesSubbrand("arla cheasy skyr", "Cheasy", "Arla"), true);
  assert.equal(queryNamesSubbrand("chea", "Cheasy", "Arla"), false);
  assert.equal(queryNamesSubbrand("go", "Go", "Arla"), false);
  assert.equal(queryNamesSubbrand("skyr", null, "Arla"), false);
});

test("resten af søgningen uden brand/subbrand", () => {
  assert.equal(queryWithoutNames("Arla skyr", ["Arla"]), "skyr");
  assert.equal(queryWithoutNames("skyr arla", ["Arla"]), "skyr");
  assert.equal(queryWithoutNames("arla cheasy skyr", ["Arla Cheasy", "Arla", "Cheasy"]), "skyr");
  assert.equal(queryWithoutNames("arla", ["Arla"]), "");
});
