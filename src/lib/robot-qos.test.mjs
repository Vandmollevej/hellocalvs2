// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { qosBlockReason, sanitizeRobotQosSettings, activeWindow } from "./robot-qos.ts";

const settings = { maxCpuPercent: 80, maxMemoryPercent: 85, blockedWindows: [] };
const noon = new Date("2026-10-17T10:00:00Z"); // 12:00 dansk sommertid

test("under grænserne må robotten starte", () => {
  assert.equal(qosBlockReason(settings, { cpuPercent: 40, memoryPercent: 60 }, noon), null);
});

test("for høj CPU eller RAM venter", () => {
  assert.match(qosBlockReason(settings, { cpuPercent: 92, memoryPercent: 60 }, noon), /^CPU 92 %/);
  assert.match(qosBlockReason(settings, { cpuPercent: 10, memoryPercent: 90 }, noon), /^RAM 90 %/);
});

test("ingen grænse eller ingen måling blokerer aldrig", () => {
  const open = { maxCpuPercent: null, maxMemoryPercent: null, blockedWindows: [] };
  assert.equal(qosBlockReason(open, { cpuPercent: 100, memoryPercent: 100 }, noon), null);
  assert.equal(qosBlockReason(settings, { cpuPercent: null, memoryPercent: null }, noon), null);
});

test("spærretid, også hen over midnat", () => {
  const evening = { ...settings, blockedWindows: [{ start: "16:00", end: "21:00" }] };
  assert.equal(qosBlockReason(evening, { cpuPercent: 1, memoryPercent: 1 }, new Date("2026-10-17T15:30:00Z")), "Spærretid 16:00–21:00");
  assert.equal(qosBlockReason(evening, { cpuPercent: 1, memoryPercent: 1 }, new Date("2026-10-17T19:00:00Z")), null);
  const night = [{ start: "23:00", end: "02:00" }];
  assert.ok(activeWindow(night, new Date("2026-10-17T22:30:00Z"))); // 00:30
  assert.equal(activeWindow(night, new Date("2026-10-17T10:00:00Z")), null);
});

test("indstillinger renses", () => {
  const clean = sanitizeRobotQosSettings({
    maxCpuPercent: "150",
    maxMemoryPercent: null,
    blockedWindows: [{ start: "7:5", end: "9:00" }, { start: "7:05", end: "9:00" }, { start: "10:00", end: "10:00" }],
  });
  assert.deepEqual(clean, { maxCpuPercent: 100, maxMemoryPercent: null, blockedWindows: [{ start: "07:05", end: "09:00" }] });
  assert.equal(sanitizeRobotQosSettings({}).maxCpuPercent, 80);
});
