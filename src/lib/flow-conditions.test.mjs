// Kør: npm test  (node --test, Node fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { flowIsEligible, sanitizeActionHref, sanitizeFlowConditions, sectionOf } from "./flow-conditions.ts";

const now = new Date("2026-10-06T12:00:00Z");
const base = {
  now,
  path: "/calendar",
  loginCount: 5,
  signupAt: new Date("2026-09-20T12:00:00Z"),
  activeDays: 8,
  visitedSections: ["/", "/calendar", "/add"],
  view: null,
};

test("ingen betingelser = til alle", () => {
  assert.equal(flowIsEligible({ maxShows: 1, conditions: {} }, base), true);
});

test("hint efter en uge med indtastninger uden mad-scanning", () => {
  const flow = { maxShows: 1, conditions: sanitizeFlowConditions({ minActiveDays: "7", notVisited: ["camera"] }) };
  assert.equal(flowIsEligible(flow, base), true);
  assert.equal(flowIsEligible(flow, { ...base, activeDays: 6 }), false);
  assert.equal(flowIsEligible(flow, { ...base, visitedSections: [...base.visitedSections, "/camera"] }), false);
});

test("side, datoer og log-ins", () => {
  const flow = {
    maxShows: 1,
    conditions: sanitizeFlowConditions({ pages: ["/calendar"], startDate: "2026-10-01", endDate: "2026-10-06", minLogins: 3, maxLogins: 10 }),
  };
  assert.equal(flowIsEligible(flow, base), true);
  assert.equal(flowIsEligible(flow, { ...base, path: "/calendar/week" }), true);
  assert.equal(flowIsEligible(flow, { ...base, path: "/statistics" }), false);
  assert.equal(flowIsEligible(flow, { ...base, now: new Date("2026-10-07T12:00:00Z") }), false);
  assert.equal(flowIsEligible(flow, { ...base, loginCount: 2 }), false);
  assert.equal(flowIsEligible(flow, { ...base, loginCount: 11 }), false);
});

test("antal visninger, pause og lukket", () => {
  const view = { shownCount: 1, lastShownAt: new Date("2026-10-05T12:00:00Z"), completedAt: null, dismissedAt: null };
  assert.equal(flowIsEligible({ maxShows: 1, conditions: {} }, { ...base, view }), false);
  assert.equal(flowIsEligible({ maxShows: 0, conditions: {} }, { ...base, view }), true);
  assert.equal(flowIsEligible({ maxShows: 3, conditions: { minDaysBetweenShows: 2 } }, { ...base, view }), false);
  assert.equal(flowIsEligible({ maxShows: 0, conditions: {} }, { ...base, view: { ...view, dismissedAt: now } }), false);
});

test("sektion og sikre links", () => {
  assert.equal(sectionOf("/calendar/week?x=1"), "/calendar");
  assert.equal(sectionOf("/"), "/");
  assert.equal(sanitizeActionHref("/settings/integrations"), "/settings/integrations");
  assert.equal(sanitizeActionHref("https://evil.example"), null);
  assert.equal(sanitizeActionHref("//evil.example"), null);
});
