// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_GRANT_MAX_POINTS,
  canGrantAdminPoints,
  nextAdminGrantAllowedAt,
  validateAdminGrantInput,
} from "./admin-points-grant-rules.ts";
import { FREE_MONTH_COST } from "./points-constants.ts";

test("the maximum grant equals one free month", () => {
  assert.equal(ADMIN_GRANT_MAX_POINTS, FREE_MONTH_COST);
});

test("amount must be a whole number between 1 and one free month", () => {
  assert.equal(validateAdminGrantInput({ amount: 300, note: "Nedetid" }).ok, true);
  assert.equal(validateAdminGrantInput({ amount: "50", note: "Nedetid" }).ok, true);
  for (const amount of [0, -10, 301, 12.5, "abc", null, undefined]) {
    assert.equal(validateAdminGrantInput({ amount, note: "Nedetid" }).ok, false, String(amount));
  }
});

test("a reason is required and trimmed", () => {
  assert.equal(validateAdminGrantInput({ amount: 10, note: "  " }).ok, false);
  assert.equal(validateAdminGrantInput({ amount: 10, note: "x".repeat(501) }).ok, false);
  const result = validateAdminGrantInput({ amount: 10, note: "  Fejl i scanner  " });
  assert.deepEqual(result, { ok: true, value: { amount: 10, note: "Fejl i scanner" } });
});

test("the next grant is allowed on the same date the following month", () => {
  const last = new Date(2026, 9, 3, 14, 0);
  assert.deepEqual(nextAdminGrantAllowedAt(last), new Date(2026, 10, 3, 14, 0));
  assert.equal(canGrantAdminPoints(last, new Date(2026, 10, 3, 13, 59)), false);
  assert.equal(canGrantAdminPoints(last, new Date(2026, 10, 3, 14, 0)), true);
});

test("month-end dates clamp to the last day of the next month", () => {
  assert.deepEqual(nextAdminGrantAllowedAt(new Date(2026, 0, 31, 9)), new Date(2026, 1, 28, 9));
  assert.deepEqual(nextAdminGrantAllowedAt(new Date(2026, 11, 31, 9)), new Date(2027, 0, 31, 9));
});

test("a user without earlier grants can always receive points", () => {
  assert.equal(canGrantAdminPoints(null), true);
});
