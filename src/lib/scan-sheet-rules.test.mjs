import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildVocabIndex } from "./off-name-split.ts";
import { sheetFiltersFromFront as read } from "./scan-sheet-filters.ts";

const vocab = buildVocabIndex(JSON.parse(readFileSync(fileURLToPath(new URL("../data/off-vocab.json", import.meta.url)), "utf8")));
const sheetFiltersFromFront = (input) => read(input, vocab);

test("forsidens påstande giver arkenes _is_-værdier", () => {
  const f = sheetFiltersFromFront({ productName: "Havregryn", claims: ["Økologisk", "Glutenfri"] });
  assert.equal(f.organic, "Økologisk");
  assert.equal(f.glutenFree, "Glutenfri");
  const v = sheetFiltersFromFront({ productName: "Burger", claims: ["Vegansk"] });
  assert.equal(v.vegan, "Vegansk");
  const m = sheetFiltersFromFront({ productName: "Letmælk", variant: "1,5 % fedt", claims: ["Laktosefri"] });
  assert.equal(m.lactoseFree, "Laktosefri");
  assert.equal(m.fatPercent, 1.5);
  const s = sheetFiltersFromFront({ productName: "Müsli", claims: ["Uden tilsat sukker"] });
  assert.equal(s.noAddedSugar, "Uden tilsat sukker");
  const none = sheetFiltersFromFront({ productName: "Apfelsaft", variant: "Klar" });
  assert.equal(none.organic, null);
  assert.equal(none.vegan, null);
});
