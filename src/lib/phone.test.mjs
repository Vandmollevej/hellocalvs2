// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPhone, normalizePhone, validatePhone } from "./phone.ts";

test("dansk nummer uden landekode får +45", () => {
  assert.deepEqual(validatePhone("12 34 56 78"), { ok: true, e164: "+4512345678" });
  assert.deepEqual(validatePhone("12345678", "DK"), { ok: true, e164: "+4512345678" });
});

test("international skrivemåde normaliseres", () => {
  assert.deepEqual(validatePhone("+45 12 34 56 78"), { ok: true, e164: "+4512345678" });
  assert.deepEqual(validatePhone("0045 12345678"), { ok: true, e164: "+4512345678" });
  assert.deepEqual(validatePhone("(+46) 70-123 45 67"), { ok: true, e164: "+46701234567" });
  assert.deepEqual(validatePhone("+44 7911 123456"), { ok: true, e164: "+447911123456" });
});

test("regionen bestemmer landekoden for nationale numre", () => {
  assert.deepEqual(validatePhone("0701234567", "SE"), { ok: true, e164: "+46701234567" });
  assert.deepEqual(validatePhone("12345678", "XX"), { ok: true, e164: "+4512345678" });
});

test("tomme og ugyldige numre afvises", () => {
  assert.deepEqual(validatePhone(""), { ok: false, reason: "empty" });
  assert.deepEqual(validatePhone("   "), { ok: false, reason: "empty" });
  assert.deepEqual(validatePhone("1234567"), { ok: false, reason: "invalid" });
  assert.deepEqual(validatePhone("123456789"), { ok: false, reason: "invalid" });
  assert.deepEqual(validatePhone("abc12345"), { ok: false, reason: "invalid" });
  assert.deepEqual(validatePhone("+45"), { ok: false, reason: "invalid" });
  assert.deepEqual(validatePhone("+1234567890123456"), { ok: false, reason: "invalid" });
  assert.deepEqual(validatePhone("+0045 12345678"), { ok: false, reason: "invalid" });
});

test("visning af danske numre", () => {
  assert.equal(formatPhone("+4512345678"), "+45 12 34 56 78");
  assert.equal(formatPhone("+46701234567"), "+46701234567");
  assert.equal(formatPhone(null), "");
});

test("normalizePhone giver streng eller null", () => {
  assert.equal(normalizePhone("12 34 56 78"), "+4512345678");
  assert.equal(normalizePhone("abc"), null);
});
