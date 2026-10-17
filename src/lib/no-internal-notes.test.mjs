// Kør: npm test  (node --test)
//
// Interne noter om, hvornår noget vises, står aldrig på kundens sider (bruger
// 2026-10-17: "Vises kun når der findes data for dette produkt." var kommet
// tilbage på varesiden efter en revert). Testen fejler, hvis noten dukker op
// igen i web, native eller sprogfilerne.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, "utf8");

const FILES = [
  "src/components/add/AddProductView.tsx",
  "native/shared/src/commonMain/kotlin/dk/packroff/hellocal/screens/food/AddProductScreen.kt",
  "src/i18n/locales/da.json",
  "src/i18n/locales/en.json",
];

test("varesiden har ingen intern note om, hvornår næring vises", () => {
  for (const file of FILES) {
    const text = read(file);
    assert.ok(!text.includes("extendedNutritionDisclaimer"), `${file} bruger extendedNutritionDisclaimer`);
    assert.ok(!/Vises kun når der findes data/i.test(text), `${file} har noten "Vises kun når …"`);
    assert.ok(!/Only shown when (there is )?data/i.test(text), `${file} har noten "Only shown when …"`);
  }
});
