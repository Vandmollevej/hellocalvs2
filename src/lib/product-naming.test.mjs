// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitProductHeading } from "./product-naming.ts";

const heading = (product) => splitProductHeading(product);

test("varianten i slutningen af navnet fjernes fra H1 (Marmelade Pære & havtorn)", () => {
  assert.deepEqual(heading({ name: "Marmelade Pære & havtorn", variant: "Pære & havtorn" }), {
    title: "Marmelade",
    variants: ["Pære & havtorn"],
  });
});

test("store/små bogstaver og & / og sidestilles", () => {
  assert.equal(heading({ name: "Marmelade pære og Havtorn", variant: "Pære & havtorn" }).title, "Marmelade");
  assert.equal(heading({ name: "Jam Pear and sea buckthorn", variant: "Pear & sea buckthorn" }).title, "Jam");
});

test("varianten midt i navnet fjernes og efterlader et rent navn", () => {
  assert.equal(heading({ name: "Skyr Jordbær 2%", variant: "Jordbær" }).title, "Skyr 2%");
  assert.equal(heading({ name: "Yoghurt - Vanilje - 1 kg", variant: "Vanilje" }).title, "Yoghurt - 1 kg");
});

test("løse bindeord og skilletegn fjernes", () => {
  assert.equal(heading({ name: "Skyr med jordbær", variant: "Jordbær" }).title, "Skyr");
  assert.equal(heading({ name: "Chips, Sour cream & onion", variant: "Sour cream & onion" }).title, "Chips");
  assert.equal(heading({ name: "Te (Citron)", variant: "Citron" }).title, "Te");
});

test("kun hele ord matches", () => {
  assert.equal(heading({ name: "Citronmåne", variant: "Citron" }).title, "Citronmåne");
  assert.equal(heading({ name: "Pærevelling", variant: "Pære" }).title, "Pærevelling");
});

test("æøå og forstavelse håndteres", () => {
  assert.equal(heading({ name: "Øl Hyldeblomst", variant: "hyldeblomst" }).title, "Øl");
  assert.equal(heading({ name: "æble juice", variant: "Juice" }).title, "Æble");
});

test("smag (flavor) behandles som variant og dubletter samles", () => {
  assert.deepEqual(heading({ name: "Saft Hindbær", flavor: "Hindbær" }), { title: "Saft", variants: ["Hindbær"] });
  assert.deepEqual(heading({ name: "Saft Hindbær & lime", variant: "Hindbær & lime", flavor: "Hindbær" }), {
    title: "Saft",
    variants: ["Hindbær & lime"],
  });
  assert.deepEqual(heading({ name: "Saft Hindbær & lime", variant: "Hindbær", flavor: "Hindbær & lime" }), {
    title: "Saft",
    variants: ["Hindbær & lime"],
  });
});

test("navnet er kun smagen: produkttypen bliver titel", () => {
  assert.deepEqual(heading({ name: "Pære & havtorn", variant: "Pære & havtorn", productType: "Marmelade" }), {
    title: "Marmelade",
    variants: ["Pære & havtorn"],
  });
});

test("navnet er kun smagen uden produkttype: smagen står kun én gang", () => {
  assert.deepEqual(heading({ name: "Pære & havtorn", variant: "Pære & havtorn" }), {
    title: "Pære & havtorn",
    variants: [],
  });
});

test("uden variant er navnet uændret", () => {
  assert.deepEqual(heading({ name: "Havregryn", variant: null }), { title: "Havregryn", variants: [] });
  assert.deepEqual(heading({ name: "Havregryn", variant: "  " }), { title: "Havregryn", variants: [] });
});

test("garanti: H1 indeholder aldrig en H2-variant", () => {
  const cases = [
    { name: "Marmelade Pære & havtorn Pære & havtorn", variant: "Pære & havtorn" },
    { name: "Vand Uden brus", variant: "Uden brus" },
    { name: "Juice Appelsin / Appelsin", variant: "appelsin" },
  ];
  for (const product of cases) {
    const { title, variants } = heading(product);
    for (const variant of variants) {
      const words = (text) => text.toLocaleLowerCase("da").replace(/\bog\b/g, "&").match(/[\p{L}\p{N}%&]+/gu).join(" ");
      assert.ok(!` ${words(title)} `.includes(` ${words(variant)} `), `${title} indeholder ${variant}`);
    }
  }
});

test("variant af lutter bindeord ignoreres", () => {
  assert.deepEqual(heading({ name: "Pære & havtorn marmelade", variant: "&" }), {
    title: "Pære & havtorn marmelade",
    variants: [],
  });
});
