// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLogValue, groupLogByDay } from "./integrations/log-format.ts";
import { logWindow } from "./integrations/log-window.ts";
import { averagePerHour } from "./integrations/google-health-items.ts";

const iso = (date) => (date ? date.toISOString() : null);

test("Log: i dag starter ved midnat i dansk sommertid", () => {
  const { from, to } = logWindow("today", new Date("2026-10-11T08:00:00Z"));
  assert.equal(iso(from), "2026-10-10T22:00:00.000Z");
  assert.equal(to, null);
});

test("Log: i dag starter ved midnat i dansk vintertid", () => {
  const { from } = logWindow("today", new Date("2026-12-15T10:00:00Z"));
  assert.equal(iso(from), "2026-12-14T23:00:00.000Z");
});

test("Log: historikken slutter ved midnat i dag og gentager aldrig i dag", () => {
  const now = new Date("2026-10-11T08:00:00Z");
  const yesterday = logWindow("yesterday", now);
  assert.equal(iso(yesterday.from), "2026-10-09T22:00:00.000Z");
  assert.equal(iso(yesterday.to), "2026-10-10T22:00:00.000Z");
  assert.equal(iso(logWindow("week", now).from), "2026-10-03T22:00:00.000Z");
  assert.equal(iso(logWindow("month", now).from), "2026-09-10T22:00:00.000Z");
  assert.equal(iso(logWindow("year", now).from), "2025-10-10T22:00:00.000Z");
  assert.deepEqual(logWindow("all", now), { from: null, to: new Date("2026-10-10T22:00:00.000Z") });
});

test("Log: sommertid → vintertid (25. oktober) giver stadig midnat i dansk tid", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  assert.equal(iso(logWindow("today", now).from), "2026-10-25T23:00:00.000Z");
  assert.equal(iso(logWindow("week", now).from), "2026-10-18T22:00:00.000Z");
  assert.equal(iso(logWindow("month", now).from), "2026-09-25T22:00:00.000Z");
});

test("Log: rækkerne grupperes pr. dansk dag, nyeste dag først, dagssummer på deres egen dato", () => {
  const entry = (id, at, daySum = false) => ({ id, kind: "metric", type: "STEPS", value: 1, kcal: null, at, daySum });
  const groups = groupLogByDay([
    entry("a", "2026-10-10T23:30:00.000Z"), // 11. oktober kl. 01:30 dansk tid
    entry("b", "2026-10-10T20:00:00.000Z"), // 10. oktober kl. 22:00
    entry("c", "2026-10-10T00:00:00.000Z", true), // dagssum for 10. oktober
  ]);
  assert.deepEqual(
    groups.map((g) => [g.day, g.entries.map((e) => e.id)]),
    [
      ["2026-10-11", ["a"]],
      ["2026-10-10", ["b", "c"]],
    ]
  );
});

test("Log: værdier vises med enhed, varighed og klokkeslæt", () => {
  const t = (key, params = {}) =>
    key.endsWith("hoursMinutes")
      ? `${params.h} t ${params.m} min`
      : key.endsWith("hours")
        ? `${params.h} t`
        : key.endsWith("minutes")
          ? `${params.m} min`
          : key;
  const metric = (type, value) => ({ id: type, kind: "metric", type, value, kcal: null, at: "2026-10-10T07:00:00.000Z", daySum: false });
  assert.equal(formatLogValue(metric("SLEEP_MINUTES", 432), t, "da-DK"), "7 t 12 min");
  assert.equal(formatLogValue(metric("SLEEP_MINUTES", 480), t, "da-DK"), "8 t");
  assert.equal(formatLogValue(metric("SLEEP_START_MINUTE_OF_DAY", 1425), t, "da-DK"), "23:45");
  assert.equal(formatLogValue(metric("OXYGEN_SATURATION_PERCENT", 96.4), t, "da-DK"), "96 %");
  assert.equal(formatLogValue(metric("HEART_RATE_BPM", 62), t, "da-DK"), "62 bpm");
  assert.equal(formatLogValue(metric("STEPS", 4213), t, "da-DK"), "4.213");
  assert.equal(formatLogValue({ id: "w", kind: "weight", type: "WEIGHT", value: 81.44, kcal: null, at: "x", daySum: false }, t, "da-DK"), "81,4 kg");
  assert.equal(
    formatLogValue({ id: "a", kind: "activity", type: "running", value: 45, kcal: 380, at: "x", daySum: false }, t, "da-DK"),
    "45 min · 380 kcal"
  );
});

test("Google Health: minutmålinger samles til ét gennemsnit pr. time, dagsværdier røres ikke", () => {
  const metric = (type, value, recordedAt) => ({ kind: "metric", payload: { source: "GOOGLE_HEALTH", type, value, recordedAt } });
  const out = averagePerHour([
    metric("OXYGEN_SATURATION_PERCENT", 96, "2026-10-10T07:01:00.000Z"),
    metric("OXYGEN_SATURATION_PERCENT", 94, "2026-10-10T07:02:00.000Z"),
    metric("OXYGEN_SATURATION_PERCENT", 98, "2026-10-10T07:05:00.000Z"),
    metric("OXYGEN_SATURATION_PERCENT", 95, "2026-10-10T08:00:30.000Z"),
    // Dagsværdi for natten + to minutmålinger i nattens første time.
    metric("OXYGEN_SATURATION_PERCENT", 97, "2026-10-10T00:00:00.000Z"),
    metric("OXYGEN_SATURATION_PERCENT", 93, "2026-10-10T00:10:00.000Z"),
    metric("OXYGEN_SATURATION_PERCENT", 91, "2026-10-10T00:20:00.000Z"),
    metric("HEART_RATE_BPM", 60, "2026-10-10T07:01:00.000Z"),
    metric("HEART_RATE_BPM", 80, "2026-10-10T07:02:00.000Z"),
  ]);
  const spo2 = out
    .filter((i) => i.payload.type === "OXYGEN_SATURATION_PERCENT")
    .map((i) => [i.payload.recordedAt, i.payload.value])
    .sort();
  assert.deepEqual(spo2, [
    ["2026-10-10T00:00:00.000Z", 97],
    ["2026-10-10T00:10:00.000Z", 92],
    ["2026-10-10T07:01:00.000Z", 96],
    ["2026-10-10T08:00:30.000Z", 95],
  ]);
  assert.equal(out.filter((i) => i.payload.type === "HEART_RATE_BPM").length, 2);
});
