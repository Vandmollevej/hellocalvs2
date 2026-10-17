// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { allergenHref, segmentIngredients } from "./allergen-highlight.ts";
import { buildReferenceLookup, findAllergenWordCandidates } from "./allergen-word-finder.ts";

test("allergener får deres nøgle, så de kan linke til allergensiden", () => {
  const parts = segmentIngredients("hvedemel, ÆG, sojalecithin, salt").filter((part) => part.allergen);
  assert.deepEqual(parts.map((part) => [part.text, part.allergenKey]), [["hvedemel", "gluten"], ["ÆG", "eggs"], ["sojalecithin", "soybeans"]]);
  assert.equal(allergenHref("eggs"), "/viden-om/allergener/eggs");
  // jordnød er jordnødder, ikke nødder
  assert.equal(segmentIngredients("jordnødder")[0].allergenKey, "peanuts");
});

test("robottens godkendte ord fremhæves som hele ord", () => {
  const extra = [{ word: "kærnemælk", allergen: "milk" }, { word: "mozzarella", allergen: "milk" }];
  const parts = segmentIngredients("Mozzarella (65 %), kærnemælk, salt", extra).filter((part) => part.allergen);
  assert.deepEqual(parts.map((part) => [part.text, part.allergenKey]), [["Mozzarella", "milk"], ["kærnemælk", "milk"]]);
});

test("opslagsværket: navne, synonymer og arv fra forældre", () => {
  const lookup = buildReferenceLookup(
    { "en:milk": { name: { en: "Milk", da: "Mælk" }, synonyms: { da: ["mælk", "kærnemælk"] } } },
    {
      "en:cheese": { name: { da: "ost" }, allergens: { en: "en:milk" } },
      "en:mozzarella": { name: { da: "mozzarella", en: "mozzarella" }, parents: ["en:cheese"] },
      "en:pesto": { name: { da: "pesto" }, allergens: { en: "en:milk, en:nuts" } },
      "en:salt": { name: { da: "salt" } },
    },
  );
  assert.equal(lookup.get("da").get("kærnemælk"), "milk");
  assert.equal(lookup.get("da").get("mozzarella"), "milk");
  assert.equal(lookup.get("da").has("pesto"), false);
  assert.equal(lookup.get("da").has("salt"), false);
});

test("nye ord: opslagsværk på varens sprog og ord skrevet med STORT", () => {
  const lookup = buildReferenceLookup(null, { "en:x": { name: { da: "mozzarella" }, allergens: { en: "en:milk" } } });
  const found = findAllergenWordCandidates("Ingredienser: mozzarella, tomat, KAMMUSLINGER, MÆLK, salt. KAN INDEHOLDE SPOR AF NØDDER.", "da", lookup);
  const byWord = Object.fromEntries(found.map((item) => [item.word, item]));
  assert.equal(byWord.mozzarella.source, "reference");
  assert.equal(byWord.mozzarella.allergenKey, "milk");
  assert.equal(byWord.kammuslinger.source, "uppercase");
  assert.equal(byWord["mælk"], undefined); // fanges allerede
  assert.equal(byWord.indeholde, undefined); // stopord
  assert.equal(byWord.tomat, undefined);
  // Andet sprog: opslaget gælder kun varens sprog
  assert.equal(findAllergenWordCandidates("mozzarella", "sv", lookup).length, 0);
  // Hele listen med STORT siger intet
  assert.equal(findAllergenWordCandidates("TOMAT, KAMMUSLINGER, SALT", "da", lookup).length, 0);
});
