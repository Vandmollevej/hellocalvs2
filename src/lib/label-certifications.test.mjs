// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { certificationFiltersFromLabels, hasCertificationFilters, offLabelNames } from "./label-certifications.ts";
import { certificationBadges } from "./certification-badges.ts";

test("forside-AI'ens mærker bliver til filterfelter", () => {
  const filters = certificationFiltersFromLabels(["Ø-mærket", "EU-økologisk", "Nøglehullet", "Fairtrade", "Bedre Dyrevelfærd 2 hjerter"]);
  assert.equal(filters.organic, "Økologisk");
  assert.equal(filters.keyhole, "Nøglehul");
  assert.deepEqual(filters.certifications, ["Fairtrade"]);
  assert.deepEqual(filters.animalWelfare, ["Bedre Dyrevelfærd 2"]);
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
