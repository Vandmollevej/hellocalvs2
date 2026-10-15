// Kør: npm test  (node --test)
//
// Tilføj-kameraets forsidefoto beskæres aldrig efter AI'ens objektboks
// (bruger 2026-10-15: produktbilledet blev "halveret"). Boksene fra
// objektgenkendelsen er upræcise; rammen, brugeren sigter med, er udsnittet.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const flow = readFileSync(new URL("../components/camera/ProductCaptureFlow.tsx", import.meta.url), "utf8");

test("Tilføj-kameraet beskærer ikke forsidefotoet til en AI-boks", () => {
  assert.doesNotMatch(flow, /cropToObject/);
});
