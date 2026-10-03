// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { productPageTags, sanitizeProductPageTagSettings } from "./product-page-tags.ts";

const product = {
  flavor: "Jordbær",
  keywords: ["i Skiver", "Tilsat kulsyre", "Familiepakke"],
  filters: { organic: "Økologisk", glutenFree: null, alcoholPercent: 4.6, countryOfOrigin: "Danmark", certifications: ["MSC", "økologisk"] },
};

test("viser kun valgte og udfyldte felter i katalogets rækkefølge", () => {
  const tags = productPageTags(product, { fields: ["organic", "flavor", "glutenFree"], keywords: [] });
  assert.deepEqual(tags, [
    { kind: "text", text: "Jordbær" },
    { kind: "text", text: "Økologisk" },
  ]);
});

test("frie nøgleord matcher uden store/små bogstaver og dubletter fjernes", () => {
  const tags = productPageTags(product, { fields: ["organic", "certifications"], keywords: ["TILSAT KULSYRE"] });
  assert.deepEqual(tags, [
    { kind: "text", text: "Økologisk" },
    { kind: "text", text: "MSC" },
    { kind: "text", text: "Tilsat kulsyre" },
  ]);
});

test("procenter og oprindelsesland formateres i klienten", () => {
  const tags = productPageTags(product, { fields: ["alcoholPercent", "countryOfOrigin"], keywords: [] });
  assert.deepEqual(tags, [
    { kind: "alcoholPercent", value: 4.6 },
    { kind: "countryOfOrigin", text: "Danmark" },
  ]);
});

test("ugyldig opsætning renses", () => {
  const settings = sanitizeProductPageTagSettings({ fields: ["flavor", "hack", 3], keywords: [" a ", "A", "", 7] });
  assert.deepEqual(settings, { fields: ["flavor"], keywords: ["a"] });
});
