// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAudienceProfile, cohortOf, median, MIN_USERS } from "./business-audience.ts";

function user(id, overrides = {}) {
  return {
    id,
    sex: "FEMALE",
    age: 40,
    firstWeightKg: 80,
    lastWeightKg: 78,
    weightSpanDays: 30,
    registrations: 30,
    activeDays: 15,
    typeCounts: { Brød: 6, Mælk: 4 },
    ...overrides,
  };
}

test("median: ulige, lige og tom", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
});

test("under MIN_USERS brugere giver ingen profil", () => {
  const users = Array.from({ length: MIN_USERS - 1 }, (_, i) => user(`u${i}`));
  assert.equal(computeAudienceProfile(users), null);
});

test("tomme konti tæller ikke med", () => {
  const active = Array.from({ length: MIN_USERS - 1 }, (_, i) => user(`u${i}`));
  const empty = user("tom", { registrations: 0, activeDays: 0, firstWeightKg: null, lastWeightKg: null, weightSpanDays: 0, typeCounts: {} });
  assert.equal(computeAudienceProfile([...active, empty]), null);
});

test("typisk bruger: medianer, køn, produkttyper og sammenligning i procentpoint", () => {
  const users = [
    ...Array.from({ length: 7 }, (_, i) => user(`f${i}`, { age: 38 + i, registrations: 20 + i * 2, activeDays: 10 + i })),
    ...Array.from({ length: 4 }, (_, i) => user(`m${i}`, { sex: "MALE", age: 55, registrations: 60, activeDays: 28, lastWeightKg: 81, typeCounts: { Øl: 10 } })),
  ];
  const profile = computeAudienceProfile(users);
  assert.ok(profile);
  assert.equal(profile.users, 11);
  assert.equal(profile.sex, "FEMALE");
  assert.equal(profile.sexShare, 7 / 11);
  // Aldre: 38..44 (7 stk) + 55 ×4 → median = 6. af 11 sorterede = 43.
  assert.equal(profile.medianAge, 43);
  assert.equal(profile.medianStartWeightKg, 80);
  assert.equal(profile.medianWeightChangeKg, -2);
  assert.equal(profile.lostWeightShare, 7 / 11);
  assert.equal(profile.weightUsers, 11);
  // Produkttyper: Brød 42, Mælk 28, Øl 40 → Brød størst.
  assert.deepEqual(
    profile.topProductTypes.map((t) => t.productType),
    ["Brød", "Øl", "Mælk"],
  );
  assert.ok(Math.abs(profile.topProductTypes[0].share - 42 / 110) < 1e-9);

  // Sammenligningsgruppe: kvinder 38-48 → de 7 kvinder.
  assert.ok(profile.cohort);
  assert.equal(profile.cohort.size, 7);
  assert.equal(profile.cohort.ageFrom, 38);
  assert.equal(profile.cohort.ageTo, 48);
  const active = profile.cohort.rows.find((r) => r.key === "activeDaysShare");
  // Median aktive dage over alle 11: sorteret 10..16 + 28×4 → 6. = 15 → 50 %.
  // Gruppens gennemsnit: (10+…+16)/7 = 13 → 43,33 %. Forskel = +6,67 pp.
  assert.ok(active);
  assert.equal(active.diffKind, "points");
  assert.ok(Math.abs(active.typical - 50) < 1e-9);
  assert.ok(Math.abs(active.diff - (50 - 1300 / 30)) < 1e-9);
  const beer = profile.cohort.rows.find((r) => r.key === "type:Øl");
  // Typisk (median over alle) andel øl = 0 %; gruppen (kvinder) = 0 % → 0 pp.
  assert.ok(beer);
  assert.equal(beer.typical, 0);
  assert.equal(beer.diff, 0);
  const regs = profile.cohort.rows.find((r) => r.key === "registrationsPerWeek");
  assert.equal(regs.diffKind, "relative");
});

test("uden alder og køn sammenlignes med alle", () => {
  const users = Array.from({ length: 12 }, (_, i) => user(`u${i}`, { sex: null, age: null }));
  assert.equal(cohortOf(users, null, null).length, 12);
  const profile = computeAudienceProfile(users);
  assert.equal(profile.sex, null);
  assert.equal(profile.medianAge, null);
  assert.equal(profile.cohort.size, 12);
  assert.equal(profile.cohort.ageFrom, null);
});

test("vægtændring kræver mindst 14 dage mellem vejninger", () => {
  const users = Array.from({ length: 12 }, (_, i) => user(`u${i}`, { weightSpanDays: i < 6 ? 3 : 30 }));
  const profile = computeAudienceProfile(users);
  assert.equal(profile.weightUsers, 6);
});
