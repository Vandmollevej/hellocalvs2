// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  coreProductType,
  groupFridaReferences,
  matchFridaEstimate,
  pluralTypeOf,
  typeSimilarity,
} from "./frida-estimate-match.ts";

const ref = (id, name, productType, extra = {}) => ({
  id,
  name,
  namePlural: extra.namePlural ?? name,
  productType,
  variant: extra.variant ?? null,
  keywords: extra.keywords ?? [],
  tags: extra.tags ?? {},
});

const REFS = [
  ref("kart-raa", "Kartoffel (Rå, efterår)", "Kartoffel", { namePlural: "Kartofler (Rå, efterår)", tags: { isRaw: "rå" } }),
  ref("kart-kogt", "Kogt kartoffel", "Kartoffel", { namePlural: "Kogte kartofler", tags: { isCooked: "kogt" } }),
  ref("kart-chips", "Kartoffel chips", "Kartoffel", { variant: "chips" }),
  ref("abr-raa", "Abrikos (Rå)", "Abrikos", { namePlural: "Abrikoser (Rå)", tags: { isRaw: "rå" } }),
  ref("abr-toer", "Tørret abrikos", "Abrikos", { namePlural: "Tørrede abrikoser", tags: { isCooked: "tørret" } }),
  ref("okse-10", "Oksekød (Fersk, hakket)", "Oksekød", { tags: { isRaw: "fersk", isFat: "10%" } }),
  ref("okse-20", "Oksekød (Fersk, hakket)", "Oksekød", { tags: { isRaw: "fersk", isFat: "20%" } }),
  ref("laks-vild", "Laks (Fersk, vild)", "Laks", { tags: { isRaw: "fersk" } }),
  ref("laks-opdraet", "Laks (Fersk, fra opdræt)", "Laks", { tags: { isRaw: "fersk" } }),
  ref("laks-roeget", "Laks (Koldrøget, vild)", "Laks"),
  ref("rodvin-af", "Rødvin alkoholfri", "Rødvin", { tags: { isAlcoholFree: "alkoholfri" } }),
  ref("kyl-bryst", "Kylling bryst med kød og skind (Fersk)", "Kylling", { variant: "bryst med kød og skind", tags: { isRaw: "fersk" } }),
  ref("kyl-laar", "Kylling lår med kød og skind (Fersk)", "Kylling", { variant: "lår med kød og skind", tags: { isRaw: "fersk" } }),
  ref("fastost", "Fast-ost 45+", "Fast-ost"),
];
const GROUPS = groupFridaReferences(REFS);
const product = (productType, extra = {}) => ({ name: extra.name ?? productType, productType, variant: extra.variant ?? null, keywords: extra.keywords ?? [] });
const pick = (p) => {
  const m = matchFridaEstimate(p, GROUPS);
  return m.kind === "match" ? m.reference.id : m.kind;
};

test("ental, flertal, bindestreger og accenter udlignes", () => {
  assert.ok(typeSimilarity("Kartofler", "Kartoffel") < 0.9);
  assert.equal(pluralTypeOf(REFS[0]), "Kartofler");
  assert.ok(typeSimilarity("Abrikoser", "Abrikos") >= 0.9);
  assert.ok(typeSimilarity("Fastost", "Fast-ost") >= 0.9);
  assert.ok(typeSimilarity("Rodvin", "Rødvin") < 1);
});

test("produkttypen skæres fri af tal, tilstand og form", () => {
  assert.equal(coreProductType(product("minimælk 0, 4% fedt")), "minimælk");
  assert.equal(coreProductType(product("Hakket oksekød")), "oksekød");
  assert.equal(coreProductType(product("Flåede tomater")), "tomater");
});

test("uden tilstand vælges den rå vare; tilstanden vælger ellers", () => {
  assert.equal(pick(product("Kartofler")), "kart-raa");
  assert.equal(pick(product("Abrikoser")), "abr-raa");
  assert.equal(pick(product("Abrikoser", { name: "Tørrede abrikoser" })), "abr-toer");
});

test("fedtprocent vælger, og ingen passende fedtprocent går til admin", () => {
  assert.equal(pick(product("Hakket oksekød", { name: "Hakket oksekød 8-12%" })), "okse-10");
  assert.equal(pick(product("Hakket oksekød", { keywords: ["7% fedt"] })), "review");
});

test("lige gode kandidater, forkert tilstand og alkohol går til admin", () => {
  const laks = matchFridaEstimate(product("Laks"), GROUPS);
  assert.equal(laks.kind, "review");
  assert.deepEqual(laks.candidates.map((c) => c.id).sort(), ["laks-opdraet", "laks-vild"]);
  assert.equal(pick(product("Rødvin")), "review");
});

test("sammensatte ord: Kyllingebryst = Kylling + bryst", () => {
  assert.equal(pick(product("Kyllingebryst")), "kyl-bryst");
  assert.equal(pick(product("Kyllingelår")), "kyl-laar");
});

test("ingen type over 90 % giver intet skøn", () => {
  assert.equal(pick(product("Sodavand")), "none");
});

test("admins valg huskes pr. nøgle, også 'ingen passer'", () => {
  const first = matchFridaEstimate(product("Laks"), GROUPS);
  assert.equal(first.kind, "review");
  const chosen = matchFridaEstimate(product("Laks"), GROUPS, new Map([[first.reviewKey, "laks-vild"]]));
  assert.equal(chosen.kind, "match");
  assert.equal(chosen.reference.id, "laks-vild");
  assert.equal(matchFridaEstimate(product("Laks"), GROUPS, new Map([[first.reviewKey, null]])).kind, "none");
});
