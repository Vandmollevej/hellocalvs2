// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FOREIGN_SCRIPT_PATTERN,
  hasForeignScript,
  isHelloFreshLanguage,
  needsProductTranslation,
  translationTarget,
} from "./product-language.ts";

test("kinesisk og andre ikke-latinske skrifter fanges", () => {
  for (const text of ["香辣酱", "净含量：248克", "招牌", "饭扫光", "Молоко", "حليب", "ミルク", "우유", "นม", "Γάλα"]) {
    assert.equal(hasForeignScript(text), true, text);
  }
});

test("HelloFresh-sprogenes bogstaver og almindelige tegn er ikke fremmede", () => {
  for (const text of [
    "Rødgrød med fløde",
    "Fettarme H-Milch 1,5 % Fett",
    "Crème fraîche 38 %",
    "Smörgåsgurka",
    "Jamón ibérico, ñ",
    "Łosoś — 250 g · 2 × 125 g",
    "Vand™ ® 0,5 l ½ °C €",
    "E330, SKUMMETMÆLK*",
    "🥛 Mælk",
    null,
    "",
  ]) {
    assert.equal(hasForeignScript(text), false, String(text));
  }
});

test("mønstret er også et gyldigt JS-regex (bruges som Postgres-regex)", () => {
  assert.ok(new RegExp(FOREIGN_SCRIPT_PATTERN, "u").test("香"));
});

test("AI'ens sprogfelt holdes op mod HelloFresh-sprogene", () => {
  for (const lang of ["da", "de-DE", "English", "dansk/engelsk", "nb", "fr", "it", "es", "Swedish"]) {
    assert.equal(isHelloFreshLanguage(lang), true, lang);
  }
  for (const lang of ["zh", "zh-CN", "Chinese", "kinesisk", "pl", "Polish", "tr", "ja"]) {
    assert.equal(isHelloFreshLanguage(lang), false, lang);
  }
  assert.equal(isHelloFreshLanguage(null), null);
  assert.equal(isHelloFreshLanguage(""), null);
});

test("oversættelse kræves ved fremmede tegn eller fremmed sprog", () => {
  assert.equal(needsProductTranslation(["香辣酱", "Chiliolie"]), true);
  assert.equal(needsProductTranslation(["Ser żółty"], "pl"), true);
  assert.equal(needsProductTranslation(["Letmælk"], "da"), false);
  assert.equal(needsProductTranslation(["Letmælk"], null), false);
  assert.equal(needsProductTranslation([null, ""], "zh"), false);
});

test("målsproget er brugerens app-sprog, ellers dansk", () => {
  assert.equal(translationTarget("da"), "da");
  assert.equal(translationTarget("en-GB"), "en");
  assert.equal(translationTarget("nb-NO"), "no");
  assert.equal(translationTarget("sv"), "sv");
  assert.equal(translationTarget("zh-CN"), "da");
  assert.equal(translationTarget(null), "da");
});
