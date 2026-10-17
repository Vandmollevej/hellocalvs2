// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { explainApiError, redactSecrets } from "./api-error-explain.ts";

test("Googles blokerede nøgle forklares med API'ens navn og link", () => {
  const raw =
    "403 Requests to this API customsearch method google.customsearch.v1.CustomSearchService.List are blocked. API_KEY_SERVICE_BLOCKED";
  const problem = explainApiError("google-search", raw);
  assert.equal(problem?.title, "Nøglen må ikke bruge Custom Search API");
  assert.match(problem?.fixUrl ?? "", /apis\/credentials/);
  assert.equal(explainApiError("google-vision", raw)?.title, "Nøglen må ikke bruge Cloud Vision API");
});

test("andre kendte fejl og ukendte fejl", () => {
  assert.equal(explainApiError("google-places", "400 API key not valid. Please pass a valid API key.")?.title, "Nøglen er ugyldig eller slettet");
  assert.equal(explainApiError("google-search", "429 RESOURCE_EXHAUSTED Quota exceeded")?.title, "Kvoten er brugt op");
  assert.equal(explainApiError("bria", "401 Unauthorized")?.title, "Nøglen afvises");
  assert.equal(explainApiError("google-search", "timeout"), null);
  assert.equal(explainApiError("google-search", null), null);
});

test("nøgler skjules altid", () => {
  const out = redactSecrets("Forbidden for url: https://x/v1?key=AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE12&cx=1 og AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE34");
  assert.ok(!out.includes("AIza"), out);
  assert.match(out, /key=\*\*\*/);
});
