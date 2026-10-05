// Koer: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptField, emailHash, encryptField, isEncrypted } from "./user-crypto.ts";

const keys = { dataKey: randomBytes(32).toString("base64"), hashKey: randomBytes(32).toString("base64") };

test("kryptering round-trip med praefiks og tilfaeldig IV", () => {
  const a = encryptField("peter@example.dk", keys);
  const b = encryptField("peter@example.dk", keys);
  assert.ok(a.startsWith("enc:v1:"));
  assert.notEqual(a, b);
  assert.ok(!a.includes("peter"));
  assert.equal(decryptField(a, keys), "peter@example.dk");
  assert.equal(decryptField(b, keys), "peter@example.dk");
});

test("unicode og tom streng", () => {
  assert.equal(decryptField(encryptField("Søren Åse 😀", keys), keys), "Søren Åse 😀");
  assert.equal(decryptField(encryptField("", keys), keys), "");
});

test("klartekst uden praefiks laeses uaendret, kryptering er idempotent", () => {
  assert.equal(decryptField("gammel@example.dk", keys), "gammel@example.dk");
  const a = encryptField("x", keys);
  assert.equal(encryptField(a, keys), a);
  assert.equal(isEncrypted(a), true);
  assert.equal(isEncrypted("x"), false);
});

test("forkert noegle eller manipuleret data afvises", () => {
  const a = encryptField("hemmeligt", keys);
  const other = { ...keys, dataKey: randomBytes(32).toString("base64") };
  assert.throws(() => decryptField(a, other));
  assert.throws(() => decryptField(a.slice(0, -2) + "AA", keys));
  assert.throws(() => encryptField("x", { ...keys, dataKey: Buffer.from("kort").toString("base64") }));
});

test("emailHash er deterministisk, case/whitespace-uafhaengig og noegleafhaengig", () => {
  const h = emailHash("Peter@Example.dk ", keys);
  assert.equal(h, emailHash("peter@example.dk", keys));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, emailHash("andre@example.dk", keys));
  assert.notEqual(h, emailHash("peter@example.dk", { ...keys, hashKey: randomBytes(32).toString("base64") }));
  assert.throws(() => emailHash("a@b.dk", { hashKey: Buffer.from("x").toString("base64") }));
});
