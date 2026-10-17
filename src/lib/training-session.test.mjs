import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSessionItems, sessionStarts } from "./training-session.ts";

test("øvelser ligger efter hinanden", () => {
  const starts = sessionStarts(new Date("2026-10-17T10:00:00Z"), [
    { sportType: "squat", durationMinutes: 15 },
    { sportType: "bench_press", durationMinutes: 20 },
    { sportType: "core", durationMinutes: 10 },
  ]);
  assert.deepEqual(starts.map((d) => d.toISOString()), ["2026-10-17T10:00:00.000Z", "2026-10-17T10:15:00.000Z", "2026-10-17T10:35:00.000Z"]);
});

test("ugyldige øvelser afvises", () => {
  assert.equal(parseSessionItems([]), null);
  assert.equal(parseSessionItems([{ sportType: "squat", durationMinutes: 0 }]), null);
  assert.equal(parseSessionItems("x"), null);
  assert.deepEqual(parseSessionItems([{ sportType: "squat", durationMinutes: 12.4 }]), [{ sportType: "squat", durationMinutes: 12 }]);
});

