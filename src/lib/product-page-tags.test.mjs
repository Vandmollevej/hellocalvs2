// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { productPageTags, sanitizeProductPageTagSettings } from "./product-page-tags.ts";
import { productKeywordGroup } from "./product-keyword-groups.ts";

const product = {
  flavor: "Jordbær",
  keywords: ["Glf", "Tilsat kulsyre", "Gestus", "Rød", "på Glas", "OBS 1 dags holdbarhed"],
  filters: { organic: "Økologisk", glutenFree: null, alcoholPercent: 4.6, countryOfOrigin: "Danmark", certifications: ["MSC", "Jordbær"] },
};

test("viser kun valgte og udfyldte typer i katalogets rækkefølge", () => {
  const tags = productPageTags(product, { fields: ["organic", "flavor", "glutenFree"], groups: [] });
  assert.deepEqual(tags, [
    { kind: "text", text: "Jordbær" },
    { kind: "flag", field: "organic" },
  ]);
});

test("faste typer oversættes i klienten, tekst-dubletter fjernes", () => {
  const tags = productPageTags(product, { fields: ["flavor", "organic", "certifications"], groups: [] });
  assert.deepEqual(tags, [
    { kind: "text", text: "Jordbær" },
    { kind: "flag", field: "organic" },
    { kind: "text", text: "MSC" },
  ]);
});

test("procenter og oprindelsesland formateres i klienten", () => {
  const tags = productPageTags(product, { fields: ["alcoholPercent", "countryOfOrigin"], groups: [] });
  assert.deepEqual(tags, [
    { kind: "alcoholPercent", value: 4.6 },
    { kind: "countryOfOrigin", text: "Danmark" },
  ]);
});

test("frie nøgleord vises pr. valgt gruppe i gruppernes rækkefølge", () => {
  const tags = productPageTags(product, { fields: [], groups: ["packaging", "color", "label"] });
  assert.deepEqual(tags, [
    { kind: "text", text: "Rød" },
    { kind: "text", text: "på Glas" },
    { kind: "text", text: "Glutenfri" },
  ]);
});

test("nøgleord grupperes efter mønstre", () => {
  assert.equal(productKeywordGroup("Tilsat kulsyre"), "content");
  assert.equal(productKeywordGroup("Mørk"), "color");
  assert.equal(productKeywordGroup("Kogt og røget"), "preparation");
  assert.equal(productKeywordGroup("i Skiver"), "cut");
  assert.equal(productKeywordGroup("Bør ikke genfryses"), "storage");
  assert.equal(productKeywordGroup("Chardonnay"), "grape");
  assert.equal(productKeywordGroup("Fra Elmhurst kilden"), "origin");
  assert.equal(productKeywordGroup("OBS 1 dags holdbarhed"), "notice");
  assert.equal(productKeywordGroup("Gestus"), null);
});

test("ugyldig opsætning renses, gamle enkelt-nøgleord falder fra", () => {
  const settings = sanitizeProductPageTagSettings({ fields: ["flavor", "hack", 3], groups: ["color", "Tilsat kulsyre"] });
  assert.deepEqual(settings, { fields: ["flavor"], groups: ["color"] });
});
