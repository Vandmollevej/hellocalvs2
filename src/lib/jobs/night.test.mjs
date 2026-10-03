// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { nightWindow, summarizeNightRuns, describeNightSummary } from "./night.ts";

test("om morgenen er natten den seneste (i går 20:00 – i dag 08:00, afsluttet)", () => {
  // 2026-10-02 09:30 dansk sommertid = 07:30 UTC
  const window = nightWindow(new Date("2026-10-02T07:30:00Z"));
  assert.equal(window.from.toISOString(), "2026-10-01T18:00:00.000Z");
  assert.equal(window.to.toISOString(), "2026-10-02T06:00:00.000Z");
  assert.equal(window.inProgress, false);
});

test("før kl. 8 er natten stadig i gang", () => {
  const window = nightWindow(new Date("2026-10-02T03:00:00Z")); // 05:00 dansk tid
  assert.equal(window.from.toISOString(), "2026-10-01T18:00:00.000Z");
  assert.equal(window.inProgress, true);
});

test("om aftenen efter kl. 20 er det nattens kørsler, der begynder nu", () => {
  const window = nightWindow(new Date("2026-10-02T19:30:00Z")); // 21:30 dansk tid
  assert.equal(window.from.toISOString(), "2026-10-02T18:00:00.000Z");
  assert.equal(window.to.toISOString(), "2026-10-03T06:00:00.000Z");
  assert.equal(window.inProgress, true);
});

test("vintertid: vinduet følger dansk tid, ikke UTC", () => {
  const window = nightWindow(new Date("2026-12-10T08:00:00Z")); // 09:00 dansk vintertid
  assert.equal(window.from.toISOString(), "2026-12-09T19:00:00.000Z");
  assert.equal(window.to.toISOString(), "2026-12-10T07:00:00.000Z");
});

test("summering pr. job: antal kørsler, udført, fejl og seneste besked", () => {
  const window = nightWindow(new Date("2026-10-02T07:30:00Z"));
  const at = (iso) => new Date(iso);
  const runs = [
    { jobKey: "image-cutout", startedAt: at("2026-10-01T18:05:00Z"), finishedAt: at("2026-10-01T22:00:00Z"), status: "OK", message: "Venter på nye produkter", itemCount: 0, runCount: 240 },
    { jobKey: "image-cutout", startedAt: at("2026-10-01T22:01:00Z"), finishedAt: at("2026-10-01T22:02:00Z"), status: "OK", message: "12 billeder fritlagt", itemCount: 12, runCount: 1 },
    { jobKey: "image-cutout", startedAt: at("2026-10-01T22:03:00Z"), finishedAt: at("2026-10-02T05:59:00Z"), status: "OK", message: "Venter på nye produkter", itemCount: 0, runCount: 300 },
    { jobKey: "logo-agent", startedAt: at("2026-10-02T01:00:00Z"), finishedAt: at("2026-10-02T01:10:00Z"), status: "ERROR", message: "Nøgle mangler", itemCount: 0, runCount: 1 },
    { jobKey: "logo-agent", startedAt: at("2026-10-02T09:00:00Z"), finishedAt: at("2026-10-02T09:10:00Z"), status: "OK", message: "Uden for natten", itemCount: 5, runCount: 1 },
  ];
  const byJob = summarizeNightRuns(runs, window);
  const cutout = byJob.get("image-cutout");
  assert.equal(cutout.runs, 541);
  assert.equal(cutout.items, 12);
  assert.equal(cutout.errors, 0);
  assert.equal(cutout.lastMessage, "12 billeder fritlagt");
  assert.equal(describeNightSummary(cutout), "541 kørsler · 12 udført");

  const logo = byJob.get("logo-agent");
  assert.equal(logo.runs, 1);
  assert.equal(logo.errors, 1);
  assert.equal(logo.lastError, "Nøgle mangler");
  assert.equal(describeNightSummary(logo), "1 kørsel · 0 udført · 1 fejl");
  assert.equal(describeNightSummary(byJob.get("frida-import")), "Ingen kørsler i nat");
});
