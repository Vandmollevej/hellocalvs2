// Koer: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.USER_DATA_KEY = randomBytes(32).toString("base64");
process.env.USER_EMAIL_HASH_KEY = randomBytes(32).toString("base64");
const { transformArgs, decryptResult } = await import("./user-data-transform.ts");
const { emailHash, encryptField } = await import("./user-crypto.ts");

test("findUnique where email -> emailHash", () => {
  const a = transformArgs("User", "findUnique", { where: { email: "A@b.dk" } });
  assert.deepEqual(a, { where: { emailHash: emailHash("a@b.dk") } });
});

test("findFirst filter -> OR hash/klartekst, relationsfilter foelges", () => {
  const a = transformArgs("PointsTransaction", "findMany", { where: { user: { email: "a@b.dk" } } });
  assert.equal(a.where.user.AND[0].OR[0].emailHash, emailHash("a@b.dk"));
  assert.equal(a.where.user.AND[0].OR[1].email, "a@b.dk");
});

test("create/update krypterer og saetter emailHash, nested create ogsaa", () => {
  const c = transformArgs("User", "create", { data: { email: "a@b.dk", displayName: "Åse" } });
  assert.ok(c.data.email.startsWith("enc:v1:") && c.data.displayName.startsWith("enc:v1:"));
  assert.equal(c.data.emailHash, emailHash("a@b.dk"));
  const n = transformArgs("PointsTransaction", "create", { data: { user: { create: { email: "x@y.dk", displayName: "X" } } } });
  assert.ok(n.data.user.create.email.startsWith("enc:v1:"));
  const u = transformArgs("User", "update", { where: { id: "1" }, data: { displayName: { set: "Ny" } } });
  assert.ok(u.data.displayName.startsWith("enc:v1:"));
});

test("resultat dekrypteres (ogsaa nested + klartekst)", () => {
  const row = { id: "1", user: { email: encryptField("a@b.dk"), displayName: "Gammel" } };
  decryptResult("PointsTransaction", row);
  assert.deepEqual(row.user, { email: "a@b.dk", displayName: "Gammel" });
  const list = [{ email: encryptField("q@w.dk"), displayName: encryptField("Q") }];
  decryptResult("User", list);
  assert.deepEqual(list[0], { email: "q@w.dk", displayName: "Q" });
});

test("ikke-understoettede krypterede filtre afvises", () => {
  assert.throws(() => transformArgs("User", "findMany", { where: { email: { contains: "a" } } }));
  assert.throws(() => transformArgs("User", "findMany", { where: { displayName: "A" } }));
});
