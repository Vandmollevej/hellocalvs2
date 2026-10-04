// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeek, dayKey, startOfWeek } from "./pulse-week.ts";

// Datoer bygges i lokal tid, så testen er den samme uanset TZ.
const at = (day, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute);

test("ugen går fra mandag til søndag for ugen med udsvinget", () => {
  // Lørdag 3. oktober 2026 → mandag 28. september … søndag 4. oktober.
  const week = buildWeek(at(3), [], at(3, 17, 40), at(4, 8));
  assert.equal(week.length, 7);
  assert.equal(dayKey(week[0].date), "2026-09-28");
  assert.equal(dayKey(week[6].date), "2026-10-04");
  assert.equal(startOfWeek(at(4)).getDay(), 1);
});

test("registreret sport lander på sin dag med klokkeslæt; udsvinget står som 'asked'", () => {
  const week = buildWeek(
    at(3),
    [
      { startedAt: at(1, 7, 15).toISOString(), durationMinutes: 40, sportType: "running" },
      { startedAt: at(3, 9, 0).toISOString(), durationMinutes: 30, sportType: "walking" },
    ],
    at(3, 17, 40),
    at(4, 8),
  );
  const wed = week.find((d) => d.key === "2026-10-01");
  assert.deepEqual(wed.entries.map((e) => [e.kind, e.at.getHours(), e.at.getMinutes()]), [["activity", 7, 15]]);
  const sat = week.find((d) => d.key === "2026-10-03");
  // Sorteret efter tid: morgenens gåtur, derefter spørgsmålet kl. 17:40.
  assert.deepEqual(sat.entries.map((e) => e.kind), ["activity", "asked"]);
  assert.equal(sat.isAskedDay, true);
});

test("i dag og fremtidige dage markeres", () => {
  const week = buildWeek(at(1), [], at(1, 18, 0), at(1, 20));
  assert.equal(week.find((d) => d.key === "2026-10-01").isToday, true);
  assert.equal(week.find((d) => d.key === "2026-10-02").isFuture, true);
  assert.equal(week.find((d) => d.key === "2026-09-30").isFuture, false);
});

test("aktiviteter uden for ugen og med ugyldig tid ignoreres", () => {
  const week = buildWeek(
    at(3),
    [
      { startedAt: at(10, 7, 0).toISOString(), durationMinutes: 30, sportType: "running" },
      { startedAt: "ugyldig", durationMinutes: 30, sportType: "running" },
    ],
    at(3, 17, 0),
    at(4, 8),
  );
  assert.equal(week.flatMap((d) => d.entries).filter((e) => e.kind === "activity").length, 0);
});
