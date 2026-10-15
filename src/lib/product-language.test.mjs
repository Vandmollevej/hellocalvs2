// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appLocaleOf,
  hasForeignScript,
  inferProductLanguage,
  languageCode,
  needsTranslation,
  scriptLanguage,
} from "./product-language.ts";

test("ikke-latinske skrifter fanges, latinske bogstaver og tegn gør ikke", () => {
  for (const text of ["香辣酱", "净含量：248克", "Молоко", "حليب", "ミルク", "우유", "นม", "Γάλα"]) {
    assert.equal(hasForeignScript(text), true, text);
  }
  for (const text of ["Rødgrød med fløde", "Brie de Meaux", "Crème fraîche 38 %", "Łosoś 2 × 125 g", "Vand™ ½ °C €", "🥛 Mælk", null, ""]) {
    assert.equal(hasForeignScript(text), false, String(text));
  }
});

test("skriftens sprog", () => {
  assert.equal(scriptLanguage(["香辣酱"]), "zh");
  assert.equal(scriptLanguage(["ミルク", "牛乳"]), "ja");
  assert.equal(scriptLanguage(["우유"]), "ko");
  assert.equal(scriptLanguage(["Молоко"]), "ru");
  assert.equal(scriptLanguage(["Молоко їжа"]), "uk");
  assert.equal(scriptLanguage(["Γάλα"]), "el");
  assert.equal(scriptLanguage(["Brie de Meaux"]), null);
});

test("danske kilder er dansk — franske og engelske ord ændrer intet", () => {
  assert.equal(inferProductLanguage({ texts: ["Brie de Meaux"], externalSource: "BILKA", barcodes: ["3228021170039"] }), "da");
  assert.equal(inferProductLanguage({ texts: ["Cheese snacks"], externalSource: "REMA1000" }), "da");
  assert.equal(inferProductLanguage({ texts: ["Rugbrød"], externalSource: "FRIDA" }), "da");
});

test("kinesisk vinder også på en vare scannet i Danmark", () => {
  assert.equal(inferProductLanguage({ texts: ["香辣酱", "招牌"], scannedCountry: "DK", barcodes: ["5701234567890"] }), "zh");
});

test("Open Food Facts: sprogfeltet, eller dansk når kolonnerne allerede er oversat", () => {
  assert.equal(inferProductLanguage({ texts: ["Vollmilch"], externalSource: "OPEN_FOOD_FACTS", offLang: "de" }), "de");
  assert.equal(inferProductLanguage({ texts: ["Sødmælk"], externalSource: "OPEN_FOOD_FACTS", offLang: "de", translatedToDanish: true }), "da");
});

test("scanningsland, oprindelsesland og stregkodens land", () => {
  assert.equal(inferProductLanguage({ texts: ["Vollmilch"], scannedCountry: "DE" }), "de");
  assert.equal(inferProductLanguage({ texts: ["Mælk"], scannedCountry: "DK", barcodes: ["4012345678901"] }), "da");
  assert.equal(inferProductLanguage({ texts: ["Mælk"], originCountryCode: "SE" }), "sv");
  assert.equal(inferProductLanguage({ texts: ["Mælk"], barcodes: ["5712345678901"] }), "da");
  assert.equal(inferProductLanguage({ texts: ["Milch"], barcodes: ["4012345678901"] }), "de");
  assert.equal(inferProductLanguage({ texts: ["Milk"], barcodes: ["0012345678905"] }), "en");
  assert.equal(inferProductLanguage({ texts: ["?"] }), null);
});

test("oversættelse kun ved kendt, andet sprog", () => {
  assert.equal(needsTranslation("zh", "da"), true);
  assert.equal(needsTranslation("de", "da"), true);
  assert.equal(needsTranslation("da", "da"), false);
  assert.equal(needsTranslation("nb", "no"), false);
  assert.equal(needsTranslation(null, "da"), false);
  assert.equal(needsTranslation("und", "da"), true);
});

test("app-sprog og sprogkoder", () => {
  assert.equal(appLocaleOf("en-GB"), "en");
  assert.equal(appLocaleOf("nb-NO"), "no");
  assert.equal(appLocaleOf("zh-CN"), "da");
  assert.equal(appLocaleOf(null), "da");
  assert.equal(languageCode("zh-CN"), "zh");
  assert.equal(languageCode("Chinese"), "zh");
  assert.equal(languageCode("Thai"), "th");
  assert.equal(languageCode("ukendt"), null);
});
