// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitProductHeadings, stripHeadingRepeats } from "./product-naming.ts";

test("varianten står kun i h2 — aldrig gentaget i h1", () => {
  const { title, subtitle } = splitProductHeadings({
    name: "Fettarme H-Milch 1,5 % Fett, laktosefrei",
    packageSizeText: "1 Liter",
    variant: "1,5 % Fett, laktosefrei",
  });
  assert.equal(title, "Fettarme H-Milch");
  assert.equal(subtitle, "1 Liter · 1,5 % Fett, laktosefrei");
});

test("løs sammenligning: 1,5% fett i navnet matcher 1,5 % Fett i varianten", () => {
  assert.equal(stripHeadingRepeats("Fettarme H-Milch 1,5% fett laktosefrei", ["1,5 % Fett, laktosefrei"]), "Fettarme H-Milch");
});

test("pakningsstørrelsen fjernes også fra navnet", () => {
  const { title, subtitle } = splitProductHeadings({ name: "Coca-Cola Zero 33 cl", packageSizeText: "33 cl", variant: "Zero" });
  assert.equal(title, "Coca-Cola");
  assert.equal(subtitle, "33 cl · Zero");
});

test("ingen h2 → navnet er urørt", () => {
  const { title, subtitle } = splitProductHeadings({ name: "Letmælk", packageSizeText: null, variant: null });
  assert.equal(title, "Letmælk");
  assert.equal(subtitle, null);
});

test("navnet bliver aldrig tomt", () => {
  const { title } = splitProductHeadings({ name: "Zero", variant: "Zero" });
  assert.equal(title, "Zero");
});

test("variant der blot gentager pakningsstørrelsen udelades", () => {
  const { subtitle } = splitProductHeadings({ name: "Flaskevand", packageSizeText: "50 cl", variant: "50cl" });
  assert.equal(subtitle, "50 cl");
});

test("ord inde i andre ord røres ikke", () => {
  assert.equal(stripHeadingRepeats("Letmælk", ["Let"]), "Letmælk");
});
