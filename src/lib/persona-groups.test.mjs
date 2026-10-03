// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_GROUP_SIZE,
  OTHER_GROUP_KEY,
  ageBucketFor,
  aggregatesForAi,
  behaviourSegmentFor,
  buildPersonaAggregates,
  groupByDimension,
  usagePatternFor,
} from "./persona-groups.ts";

function user(overrides = {}) {
  const loginHours = new Array(24).fill(0);
  const loginWeekdays = new Array(7).fill(0);
  return {
    country: "DK",
    city: "København",
    language: "da",
    ageBucket: "35-44",
    sex: "FEMALE",
    tier: "free",
    accountAgeDays: 120,
    logins90d: 0,
    loginDays90d: 0,
    lastLoginDaysAgo: null,
    registrations30d: 0,
    activeDays30d: 0,
    hellofreshRegistrations30d: 0,
    activities30d: 0,
    weighIns30d: 0,
    integrations: [],
    loginHours,
    loginWeekdays,
    deviceOs: "iPhone",
    onboardingCompleted: true,
    pushEnabled: false,
    goalMode: null,
    activityLevel: null,
    ...overrides,
  };
}

test("aldersgrupper", () => {
  assert.equal(ageBucketFor(null), "unknown");
  assert.equal(ageBucketFor(17), "under18");
  assert.equal(ageBucketFor(18), "18-24");
  assert.equal(ageBucketFor(34), "25-34");
  assert.equal(ageBucketFor(64), "55-64");
  assert.equal(ageBucketFor(65), "65+");
});

test("tidsmønster: mindst halvdelen af logins i én del af døgnet", () => {
  const hours = new Array(24).fill(0);
  assert.equal(usagePatternFor(hours), "none");
  hours[7] = 6;
  hours[19] = 2;
  assert.equal(usagePatternFor(hours), "morning");
  hours[19] = 6;
  hours[13] = 6;
  assert.equal(usagePatternFor(hours), "mixed");
  const night = new Array(24).fill(0);
  night[23] = 3;
  night[1] = 3;
  assert.equal(usagePatternFor(night), "night");
});

test("adfærdssegmenter", () => {
  assert.equal(behaviourSegmentFor(user({ accountAgeDays: 3 })), "new");
  assert.equal(behaviourSegmentFor(user({ lastLoginDaysAgo: 45 })), "dormant");
  assert.equal(behaviourSegmentFor(user({ lastLoginDaysAgo: null })), "dormant");
  // Uden login-historik men med registreringer tæller brugeren som aktiv.
  assert.equal(behaviourSegmentFor(user({ lastLoginDaysAgo: null, registrations30d: 3, activeDays30d: 3 })), "occasional");
  assert.equal(behaviourSegmentFor(user({ lastLoginDaysAgo: 1, activeDays30d: 22 })), "power");
  assert.equal(behaviourSegmentFor(user({ lastLoginDaysAgo: 1, activeDays30d: 10 })), "regular");
  assert.equal(behaviourSegmentFor(user({ lastLoginDaysAgo: 1, activeDays30d: 0 })), "lurker");
});

test("små grupper slås sammen i Øvrige (k-anonymitet)", () => {
  const users = [
    ...Array.from({ length: MIN_GROUP_SIZE }, () => user({ country: "DK" })),
    user({ country: "SE" }),
    user({ country: "NO" }),
  ];
  const groups = groupByDimension(users, "country");
  assert.deepEqual(
    groups.map((g) => g.key),
    ["DK", OTHER_GROUP_KEY],
  );
  assert.equal(groups[1].users, 2);
  assert.equal(groups[0].share, Math.round((MIN_GROUP_SIZE / users.length) * 1000) / 1000);
});

test("gruppetal: gennemsnit, andele og toptidspunkt", () => {
  const morning = new Array(24).fill(0);
  morning[7] = 4;
  const weekdays = new Array(7).fill(0);
  weekdays[5] = 3;
  weekdays[1] = 1;
  const users = Array.from({ length: 5 }, (_, i) =>
    user({
      logins90d: i + 1,
      registrations30d: i % 2 === 0 ? 10 : 0,
      activeDays30d: i % 2 === 0 ? 5 : 0,
      tier: i === 0 ? "serious" : "free",
      integrations: i < 2 ? ["WITHINGS"] : [],
      loginHours: morning,
      loginWeekdays: weekdays,
      lastLoginDaysAgo: 2,
    }),
  );
  const [group] = groupByDimension(users, "language");
  assert.equal(group.users, 5);
  assert.equal(group.avgLogins90d, 3);
  assert.equal(group.activeShare30d, 0.6);
  assert.equal(group.payingShare, 0.2);
  assert.equal(group.integrationShare, 0.4);
  assert.equal(group.peakHour, 7);
  assert.equal(group.peakWeekday, 5);
  assert.equal(group.usagePattern, "morning");
  assert.equal(group.weekendShare, 0.75);
  assert.equal(group.topAgeBucket, "35-44");
});

test("aggregatet til AI indeholder kun grupper og tal", () => {
  const users = Array.from({ length: 6 }, () => user({ lastLoginDaysAgo: 1, activeDays30d: 9, registrations30d: 20 }));
  const aggregates = buildPersonaAggregates(users, new Date("2026-10-02T00:00:00Z"));
  assert.equal(aggregates.userCount, 6);
  assert.equal(aggregates.totals.activeUsers30d, 6);
  assert.equal(aggregates.segments[0].segment, "regular");
  const payload = aggregatesForAi(aggregates);
  const text = JSON.stringify(payload);
  assert.equal(payload.brugere_i_alt, 6);
  assert.ok(payload.grupper.Land.length === 1);
  assert.equal(payload.grupper.Land[0].gruppe, "Danmark");
  assert.ok(!text.includes("userId"));
  assert.ok(!text.includes("@"));
});
