// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { certificationFiltersFromLabels, hasCertificationFilters, offLabelNames } from "./label-certifications.ts";
import { certificationBadges } from "./certification-badges.ts";
import { extractCertifications } from "./product-certifications.ts";

test("forside-AI'ens mærker bliver til filterfelter", () => {
  const filters = certificationFiltersFromLabels(["Ø-mærket", "EU-økologisk", "Nøglehullet", "Fairtrade", "Bedre Dyrevelfærd 2 hjerter"]);
  assert.equal(filters.organic, "Økologisk, EU-økologisk");
  assert.equal(filters.keyhole, "Nøglehul");
  assert.deepEqual(filters.certifications, ["Fairtrade"]);
  assert.deepEqual(filters.animalWelfare, ["Bedre Dyrevelfærd 2"]);
});

test("Ø-mærket og EU-bladet på samme vare giver begge logoer", () => {
  for (const [labels, organic, kinds] of [
    [["Ø-mærket", "EU-økologisk"], "Økologisk, EU-økologisk", ["organic", "euOrganic"]],
    [["EU organic leaf", "Statskontrolleret økologisk"], "EU-økologisk, Økologisk", ["euOrganic", "organic"]],
  ]) {
    const filters = certificationFiltersFromLabels(labels);
    assert.equal(filters.organic, organic);
    assert.deepEqual(filters.certifications, []);
    assert.deepEqual(certificationBadges(filters).map((b) => b.kind), kinds);
    // Mærkatjobbets EU-blad giver billede til samme badge, ikke et ekstra.
    const found = [{ key: "organic-eu", name: "EU-økologi", category: "ORGANIC", imageUrl: "/x.png", confidence: 0.9 }];
    assert.deepEqual(certificationBadges(filters, found).map((b) => b.kind), kinds);
  }
});

test("EU-bladet alene giver EU-logoet, ikke Ø-mærket", () => {
  const filters = certificationFiltersFromLabels(["EU organic leaf"]);
  assert.equal(filters.organic, "EU-økologisk");
  assert.deepEqual(certificationBadges(filters).map((b) => b.kind), ["euOrganic"]);
});

test("ukendte ord og tom liste giver ingen mærker", () => {
  const filters = certificationFiltersFromLabels(["Glutenfri", "Ny opskrift", ""]);
  assert.equal(hasCertificationFilters(filters), false);
});

test("Open Food Facts labels_tags oversættes", () => {
  assert.deepEqual(offLabelNames(["en:organic", "en:eu-organic", "en:green-dot", "en:fairtrade"]), ["Økologisk", "EU-økologisk", "Fairtrade"]);
  assert.deepEqual(offLabelNames(null), []);
});

test("økologi i varenavnet læses på flere sprog", () => {
  for (const name of ["Ekologisk mjölk", "Bio Haferflocken", "Organic oats", "Latte biologico", "Luomu kaura", "Ökologischer Kaffee"]) {
    assert.deepEqual(extractCertifications(name).certifications, ["organic"], name);
  }
  assert.deepEqual(extractCertifications("Biologisk vaskepulver").certifications, []);
});

test("KRAV i økologi-feltet giver KRAV-logoet, ikke Ø-mærket", () => {
  assert.deepEqual(certificationBadges({ organic: "Ø-mærket, KRAV" }).map((b) => b.kind), ["organic", "krav"]);
});
