// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyNextSearch,
  deviceFromUserAgent,
  isTypingContinuation,
  normalizeSearchQuery,
  obviousNonsense,
  screenFromReferer,
} from "./search-analytics-rules.ts";

const t0 = new Date("2026-10-10T12:00:00Z");
const at = (ms) => new Date(t0.getTime() + ms);

test("normalisering fjerner accenter men beholder æøå", () => {
  assert.equal(normalizeSearchQuery("  Nescafé   GOLD "), "nescafe gold");
  assert.equal(normalizeSearchQuery("Rødgrød med Fløde"), "rødgrød med fløde");
});

test("indtastning bogstav for bogstav er samme søgning", () => {
  assert.ok(isTypingContinuation("nesc", "nescafé"));
  assert.ok(isTypingContinuation("nescafe", "nesca"));
  assert.ok(!isTypingContinuation("nescafe", "kaffe"));
  const prev = { query: "nesc", updatedAt: t0, clickedAt: null, fullMatchCount: 5 };
  assert.equal(classifyNextSearch(prev, "nescafe", at(3_000)), "update");
  assert.equal(classifyNextSearch({ query: "nescafr", updatedAt: t0, clickedAt: null, fullMatchCount: 0 }, "nescaf", at(400)), "update");
});

test("ny søgning uden klik kort efter er en raffinering", () => {
  const prev = { query: "instantkaffe", updatedAt: t0, clickedAt: null, fullMatchCount: 3 };
  assert.equal(classifyNextSearch(prev, "nescafe", at(20_000)), "refine");
  assert.equal(classifyNextSearch(prev, "nescafe", at(5 * 60_000)), "new");
  assert.equal(classifyNextSearch({ ...prev, clickedAt: t0 }, "nescafe", at(20_000)), "new");
  assert.equal(classifyNextSearch(null, "nescafe", t0), "new");
  const miss = { query: "nescafe azera", updatedAt: t0, clickedAt: null, fullMatchCount: 0 };
  assert.equal(classifyNextSearch(miss, "nescafe", at(4_000)), "refine");
});

test("tydeligt meningsløse søgninger", () => {
  assert.ok(obviousNonsense("aaaa"));
  assert.ok(obviousNonsense("asdf"));
  assert.ok(obviousNonsense("123"));
  assert.ok(!obviousNonsense("kombucha"));
});

test("enhed og skærm", () => {
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (Linux; Android 14)"), "Android");
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)"), "iPhone");
  assert.equal(deviceFromUserAgent("Mozilla/5.0 (Windows NT 10.0)"), "Computer");
  assert.equal(screenFromReferer("https://hellocal.io/create-dish?x=1"), "/create-dish");
  assert.equal(screenFromReferer(null), null);
});
