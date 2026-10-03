import test from "node:test";
import assert from "node:assert/strict";
import { labelsToFilterPatch } from "./product-label-filters.ts";
import { cleanLabelsAnalysis, normalizeLabelKey } from "./product-label-ai.ts";

const label = (key, name, category, confidence = 0.95) => ({ key, name, text: null, category, box: null, confidence });

test("sikre mærkater udfylder kun tomme filtre", () => {
  const patch = labelsToFilterPatch(
    [label("lactose-free", "Laktosefri", "DIET"), label("haltungsform-3", "Haltungsform 3 (Frischluftstall)", "ANIMAL_WELFARE"), label("qmilch", "QMilch", "QUALITY")],
    { lactoseFree: "Laktosefrei", animalWelfare: [], certifications: ["MSC"] },
  );
  assert.equal(patch.lactoseFree, undefined);
  assert.deepEqual(patch.animalWelfare, ["Haltungsform 3 (Frischluftstall)"]);
  assert.deepEqual(patch.certifications, ["MSC", "QMilch"]);
});

test("usikre fund og dubletter ignoreres", () => {
  const patch = labelsToFilterPatch(
    [label("gluten-free", "Glutenfri", "DIET", 0.6), label("msc", "MSC", "SUSTAINABILITY"), label("organic-eu", "EU-økologi", "ORGANIC")],
    { certifications: ["msc"], organic: null },
  );
  assert.equal(patch.glutenFree, undefined);
  assert.equal(patch.certifications, undefined);
  assert.equal(patch.organic, "EU-økologi");
});

test("oprindelsesmærke giver land", () => {
  const patch = labelsToFilterPatch([label("dk-origin", "Dansk oprindelse", "ORIGIN")], null);
  assert.equal(patch.countryOfOrigin, "Danmark");
});

test("AI-svar ryddes: nøgler, kategorier, bokse", () => {
  const result = cleanLabelsAnalysis({
    labels: [
      { key: "Laktose Frei", name: "Laktosefri", text: "-L", category: "DIET", box: { x: 0.7, y: 0.3, width: 0.5, height: 0.1 }, confidence: 1.4 },
      { key: "laktose-frei", name: "Dublet", text: null, category: "DIET", box: null, confidence: 0.9 },
      { key: "", name: "Tom", text: null, category: "DIET", box: null, confidence: 0.9 },
      { key: "qmilch", name: "QMilch", text: null, category: "NONSENSE", box: { x: 0, y: 0, width: 0, height: 0 }, confidence: 0.8 },
    ],
    overallConfidence: 0.9,
  });
  assert.equal(result.labels.length, 2);
  assert.equal(result.labels[0].key, "laktose-frei");
  assert.equal(result.labels[0].confidence, 1);
  assert.deepEqual(result.labels[0].box, { x: 0.7, y: 0.3, width: 0.30000000000000004, height: 0.1 });
  assert.equal(result.labels[1].category, "OTHER");
  assert.equal(result.labels[1].box, null);
});

test("nøgler normaliseres", () => {
  assert.equal(normalizeLabelKey("Ø-mærket (DK)"), "oe-maerket-dk");
});
