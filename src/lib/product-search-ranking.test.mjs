// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SEARCH_RANKING_WEIGHTS,
  rankProducts,
  textSimilarity,
} from "./product-search-ranking.ts";

const product = (id, name, brand = null, subbrand = null, extra = {}) => ({
  id,
  name,
  brand: brand ? { name: brand } : null,
  subbrand,
  barcodes: [],
  ...extra,
});

const order = (products, query, weights = DEFAULT_SEARCH_RANKING_WEIGHTS) =>
  rankProducts(products, query, "DK", 12, 20, weights).map((entry) => entry.product.id);

test("brand og subbrand er søgbar tekst, også når de kun vises som logo", () => {
  // 4. argument = varens øvrige felter (subbrand, varetype …), jf. productDetailsText.
  assert.ok(textSimilarity("cheasy", "Skyr naturel", "Arla", "Cheasy") >= 0.78);
  assert.ok(textSimilarity("arla cheasy skyr", "Skyr naturel", "Arla", "Cheasy") >= 0.78);
  assert.ok(textSimilarity("cheasy skyr", "Skyr naturel", "Arla", "Cheasy") >= 0.78);
  assert.ok(textSimilarity("arla", "Letmælk", "Arla") >= 0.94);
});

test("brand i søgningen står øverst, også når produkttypen passer bedre på en anden vare", () => {
  const products = [
    product("generic-skyr", "Skyr"),
    product("thise-skyr", "Skyr naturel", "Thise"),
    product("arla-milk", "Letmælk", "Arla"),
    product("arla-skyr", "Skyr vanilje", "Arla"),
  ];
  const ids = order(products, "arla skyr");
  assert.deepEqual(ids.slice(0, 2), ["arla-skyr", "arla-milk"]);
});

test("brandets varer slår en vare, hvis navn begynder med brandordet", () => {
  const products = [
    product("other", "Arla-inspireret ost", "Rema 1000"),
    product("arla-butter", "Smør", "Arla"),
  ];
  assert.deepEqual(order(products, "arla"), ["arla-butter", "other"]);
});

test("brandets varer står øverst trods popularitet, region og personlig historik hos andre", () => {
  const popular = {
    regionSearchStats: [{ region: "DK", searchCount: 9999, clickCount: 9999 }],
    regionHourStats: [{ region: "DK", hour: 12, clickCount: 9999 }],
    originCountryCode: "DK",
    isVerified: true,
    personalSearchCount: 999,
    personalClickCount: 999,
  };
  const products = [
    product("popular-skyr", "Arla skyr kopi", null, null, popular),
    product("arla-cream", "Piskefløde", "Arla"),
  ];
  const maxed = Object.fromEntries(
    Object.keys(DEFAULT_SEARCH_RANKING_WEIGHTS).map((key) => [key, 100])
  );
  maxed.brandInQuery = 20;
  assert.equal(order(products, "arla skyr", maxed)[0], "arla-cream");
});

test("subbrand i søgningen står øverst", () => {
  const products = [
    product("lookalike", "Cheasy-lignende skiveost", "Rema 1000"),
    product("cheasy", "Skiveost 17+", "Arla", "Cheasy"),
  ];
  assert.deepEqual(order(products, "cheasy"), ["cheasy", "lookalike"]);
});

test("brand + subbrand slår kun brand", () => {
  const products = [
    product("arla-plain", "Skyr", "Arla"),
    product("arla-cheasy", "Hytteost", "Arla", "Cheasy"),
  ];
  assert.equal(order(products, "arla cheasy skyr")[0], "arla-cheasy");
});

test("vægt 0 slår brand-reglen fra", () => {
  const products = [
    product("other", "Arla-inspireret ost", "Rema 1000"),
    product("arla-butter", "Smør", "Arla"),
  ];
  const off = { ...DEFAULT_SEARCH_RANKING_WEIGHTS, brandInQuery: 0 };
  assert.deepEqual(order(products, "arla", off), ["other", "arla-butter"]);
});

test("bred søgning uden brand ændres ikke: generisk vare først", () => {
  const products = [
    product("arla-letmaelk", "Letmælk", "Arla"),
    product("generic-letmaelk", "Letmælk"),
  ];
  assert.equal(order(products, "letmælk")[0], "generic-letmaelk");
});
