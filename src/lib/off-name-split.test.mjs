// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CALIBRATION,
  buildVocabIndex,
  calibrate,
  compactKey,
  parseQuantity,
  splitOffProduct,
} from "./off-name-split.ts";
import {
  offNutritionFromRaw,
  offSplitInputFromRaw,
  pickOffRaw,
  productFiltersFromOff,
} from "./off-record.ts";

const vocab = buildVocabIndex(
  JSON.parse(readFileSync(fileURLToPath(new URL("../data/off-vocab.json", import.meta.url)), "utf8")),
);

const split = (input) => splitOffProduct(input, vocab);

test("compactKey folds case, accents and punctuation", () => {
  assert.equal(compactKey("Änglamark"), "ænglamark");
  assert.equal(compactKey("Coca-Cola Zero"), "cocacolazero");
  assert.equal(compactKey("Butcher's"), "butchers");
  assert.equal(compactKey("Fillet"), "filet");
});

test("quantity: bilka-style text", () => {
  assert.deepEqual(parseQuantity("500g"), { text: "500 g", packCount: null, issue: null });
  assert.equal(parseQuantity("1,5 L")?.text, "1.5 l");
  assert.equal(parseQuantity("6 x 11 g")?.text, "6 x 11 g");
  assert.equal(parseQuantity("6 x 11 g")?.packCount, 6);
  assert.equal(parseQuantity("2pcs")?.text, "2 stk");
  assert.equal(parseQuantity("pr bøtte / beholder / cup - 500g Nettovægt")?.text, "500 g");
  assert.equal(parseQuantity(null, 330, "ml")?.text, "330 ml");
  assert.equal(parseQuantity(""), null);
});

test("organic is read in other languages, Danish 'biologisk' is not organic", () => {
  for (const name of ["Ekologisk Havregryn", "Ökologische Haferflocken", "Biologische Havermout", "Avena Ecológica"]) {
    assert.equal(split({ name, hasDanishName: false }).filters.organic, "Økologisk", name);
  }
  assert.equal(split({ name: "Biologisk Vaskepulver", hasDanishName: true }).filters.organic, null);
});

test("brand, flags and type are split from a Danish OFF name", () => {
  const r = split({ name: "Økologiske Bagte Hvedeboller", brands: "Änglamark", hasDanishName: true });
  assert.equal(r.filters.organic, "Økologisk");
  assert.equal(r.filters.cooked, "bagte");
  assert.match(r.productType ?? "", /hvedebolle/i);
  assert.ok(!/økologisk/i.test(r.title), "økologisk står som filter, ikke i titlen");
  assert.ok(r.confidence > 0);
});

test("fat percent goes to the filter, not the name", () => {
  const r = split({ name: "Letmælk 1,5%", brands: "Arla", hasDanishName: true });
  assert.equal(r.filters.fatPercent, 1.5);
  assert.ok(!/%/.test(r.title));
  assert.ok(!/%/.test(r.variant ?? ""));
});

test("sugar-free and glutenfree flags are removed from the name", () => {
  const r = split({ name: "Sodavand sukkerfri glutenfri", brands: "Tuborg", hasDanishName: true });
  assert.equal(r.filters.sugarFree, "Sukkerfri");
  assert.equal(r.filters.glutenFree, "Glutenfri");
  assert.match(r.productType ?? "", /sodavand/i);
});

test("compound with a strong type suffix is split into type + variation", () => {
  const r = split({ name: "Basilikumpesto", brands: "Salling", hasDanishName: true });
  assert.equal(r.productType, "Pesto");
  assert.equal(r.variant, "basilikum");
});

test("'med' starts the variation, the thing before it is the type", () => {
  const r = split({ name: "Frugtdrik m. appelsin", brands: "Sunjoy", hasDanishName: true });
  assert.equal(r.productType?.toLowerCase(), "frugtdrik");
  assert.equal(r.variant, "med appelsin");
});

test("a name that is only the brand's quantity-less product still gets a type", () => {
  const r = split({ name: "Cornflakes", brands: "Crownfield", hasDanishName: true });
  assert.ok(r.productType);
  assert.equal(r.variant, null);
});

test("percent with a space and a pack count in the name", () => {
  const r = split({ name: "Drikkeyoghurt m. fersken og mango 0,8 % fedt", brands: "Salling", hasDanishName: true });
  assert.equal(r.filters.fatPercent, 0.8);
  const d = split({ name: "Donut m. glasur 4 stk" });
  assert.equal(d.packCount, 4);
  assert.equal(d.quantityText, null, "stk står kun i Pack Count");
});

test("quantity is weight/volume only; multipack count goes to pack count", () => {
  const r = split({ name: "Cola", brands: "Coca-Cola", quantity: "6 x 33 cl", hasDanishName: true });
  assert.equal(r.packCount, 6);
  assert.equal(r.quantityText, "33 cl");
  const s = split({ name: "Æbler", quantity: "6 stk", hasDanishName: true });
  assert.equal(s.packCount, 6);
  assert.equal(s.quantityText, null);
});

test("MHD, certificates and origin adjectives are moved out of the name", () => {
  const m = split({ name: "Laks MSC MHD 29.09.2026", brands: "Salling", hasDanishName: true });
  assert.ok(!/mhd|29/i.test(m.title));
  assert.deepEqual(m.filters.certifications, ["MSC"]);
  const o = split({ name: "Fransk Dijonsennep", brands: "Maille", hasDanishName: true });
  assert.equal(o.filters.countryOfOrigin, "Frankrig");
  assert.ok(!/fransk/i.test(o.title));
  const g = split({ name: "Græsk yoghurt", brands: "Arla", hasDanishName: true });
  assert.equal(g.filters.countryOfOrigin, null, "græsk yoghurt er en produkttype");
});

test("empty name gives zero confidence and an issue", () => {
  const r = split({ name: "   " });
  assert.equal(r.confidence, 0);
  assert.deepEqual(r.issues, ["mangler-navn"]);
});

test("foreign names are flagged and get lower confidence than Danish ones", () => {
  const da = split({ name: "Hakket oksekød", brands: "Salling", hasDanishName: true });
  const de = split({ name: "Hähnchenbrustfilet mit Soße und Käse", brands: "Butcher's" });
  assert.equal(de.language, "foreign");
  assert.ok(de.issues.includes("ikke-dansk-navn"));
  assert.ok(de.confidence < da.confidence);
});

test("primary brand ignores store chains and keeps them as extra brands", () => {
  const r = split({ name: "Merguez Bratwurst", brands: "Butcher's, Penny" });
  assert.equal(r.brand, "Butcher's");
  assert.deepEqual(r.extraBrands, ["Penny"]);
});

test("calibration table is monotone and bounded", () => {
  for (let i = 1; i < CALIBRATION.length; i++) {
    assert.ok(CALIBRATION[i][0] > CALIBRATION[i - 1][0]);
    assert.ok(CALIBRATION[i][1] >= CALIBRATION[i - 1][1]);
  }
  assert.equal(calibrate(0), 0);
  assert.ok(calibrate(100) <= 100);
  assert.ok(calibrate(90) >= calibrate(60));
});

test("OFF nutriments: *_100g is grams, converted to mg/µg", () => {
  const n = offNutritionFromRaw({
    quantity: "500 g",
    nutriments: {
      "energy-kcal_100g": 120,
      "energy-kj_100g": 500,
      proteins_100g: 3,
      carbohydrates_100g: 20,
      fat_100g: 2,
      calcium_100g: 0.158193,
      "vitamin-a_100g": 4.9383e-5,
      sodium_100g: 0.168,
      salt_100g: 0.42,
    },
  });
  assert.equal(n.basis, "100g");
  assert.equal(n.micronutrients.calcium, 158.193);
  assert.equal(Math.round(n.micronutrients.vitaminA), 49);
  assert.equal(n.sodium, 168);
  assert.equal(n.salt, 0.42);
  assert.equal(offNutritionFromRaw({ nutriments: {} }), null);
  assert.equal(offNutritionFromRaw({ quantity: "1 l", nutriments: { fat_100g: 1 } }).basis, "100ml");
});

test("raw OFF payload is reduced to the stored keys and the input is built from it", () => {
  const raw = pickOffRaw({ code: "123", product_name: "X", junk: 1, brands: "", nutriments: { fat_100g: 1 } });
  assert.deepEqual(Object.keys(raw).sort(), ["code", "nutriments", "product_name"]);
  const input = offSplitInputFromRaw({ product_name: "Eng name", product_name_da: "Dansk navn", brands: "Arla" });
  assert.equal(input.name, "Dansk navn");
  assert.equal(input.hasDanishName, true);
  const translated = offSplitInputFromRaw({ product_name: "Eng", _translated_name: "Dansk" });
  assert.equal(translated.name, "Dansk");
  assert.equal(translated.translated, true);
});

test("filters: organic label wins and low sugar follows sugar content", () => {
  const raw = { labels_tags: ["en:eu-organic"], nutriments: { sugars_100g: 1, "energy-kcal_100g": 50 } };
  const s = split({ name: "Hvedemel", brands: "Salling", hasDanishName: true });
  const f = productFiltersFromOff(s, raw, offNutritionFromRaw(raw));
  assert.equal(f.organic, "EU-økologisk");
  assert.equal(f.lowSugar, "Lavt sukkerindhold");
});
