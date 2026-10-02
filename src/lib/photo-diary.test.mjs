// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparePercentAt, daysBetweenPhotos, defaultComparePair, fitContain } from "./photo-diary.ts";

const photo = (id, takenAt) => ({ id, takenAt, url: `blob:${id}` });
const photos = [
  photo("a", "2026-09-01T08:00:00"),
  photo("b", "2026-09-15T08:00:00"),
  photo("c", "2026-10-01T08:00:00"),
];

test("under to billeder er der intet par", () => {
  assert.equal(defaultComparePair([], 0), null);
  assert.equal(defaultComparePair([photos[0]], 0), null);
});

test("før er det ældste, efter er det aktive billede", () => {
  assert.deepEqual(defaultComparePair(photos, 1), { beforeId: "a", afterId: "b" });
  assert.deepEqual(defaultComparePair(photos, 2), { beforeId: "a", afterId: "c" });
});

test("står det ældste i midten, bliver efter det nyeste", () => {
  assert.deepEqual(defaultComparePair(photos, 0), { beforeId: "a", afterId: "c" });
  assert.deepEqual(defaultComparePair(photos, 99), { beforeId: "a", afterId: "c" });
});

test("placeringen holdes inden for 0–100 %", () => {
  assert.equal(comparePercentAt(150, 100, 200), 25);
  assert.equal(comparePercentAt(50, 100, 200), 0);
  assert.equal(comparePercentAt(400, 100, 200), 100);
  assert.equal(comparePercentAt(120, 100, 0), 50);
});

test("boksen holder billedets forhold inden for fladen", () => {
  // Portræt (3:4) på en høj telefonflade: bredden styrer.
  assert.deepEqual(fitContain(0.75, 360, 600), { width: 360, height: 480 });
  // Portræt på en bred flade: højden styrer.
  assert.deepEqual(fitContain(0.75, 800, 400), { width: 300, height: 400 });
  assert.deepEqual(fitContain(0, 800, 400), { width: 0, height: 0 });
  assert.deepEqual(fitContain(0.75, 0, 400), { width: 0, height: 0 });
});

test("dage mellem billeder tæller kalenderdage i begge retninger", () => {
  assert.equal(daysBetweenPhotos("2026-09-01T23:30:00", "2026-09-02T00:10:00"), 1);
  assert.equal(daysBetweenPhotos("2026-10-01T08:00:00", "2026-09-01T20:00:00"), 30);
  assert.equal(daysBetweenPhotos("2026-09-01T08:00:00", "2026-09-01T20:00:00"), 0);
});
