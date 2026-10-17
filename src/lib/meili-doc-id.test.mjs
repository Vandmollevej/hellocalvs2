// Kør: npm test  (node --test)
// Meilisearch afviste hele indekseringen pga. ét vare-id med "%c3%b8" (2026-10-17).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDocId, toDocId } from "./search-engine/meili.ts";

test("gyldige id'er bevares uændret", () => {
  assert.equal(toDocId("cmvawb4ue000s01oeu5bem334"), "cmvawb4ue000s01oeu5bem334");
  assert.equal(toDocId("vm_et-mix"), "vm_et-mix");
});

test("ugyldige id'er kodes, er gyldige for Meilisearch og afkodes tilbage", () => {
  for (const id of ["vm_et-sk%c3%b8nt-mix-smoothie-med-ingefaer-og-lakrids", "vm_æble grød", "b64-snyd"]) {
    const docId = toDocId(id);
    assert.match(docId, /^[A-Za-z0-9_-]{1,511}$/);
    assert.equal(fromDocId(docId), id);
  }
});
