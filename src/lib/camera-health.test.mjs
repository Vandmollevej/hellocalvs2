// Kør: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { BLACK_SAMPLES, BlackFrameTracker, frameIsBlack } from "./camera-health.ts";

test("et helt sort billede genkendes; sensorstøj og mørke rum gør ikke", () => {
  assert.equal(frameIsBlack(new Float32Array([0, 1, 2, 3, 0])), true);
  assert.equal(frameIsBlack(new Float32Array([0, 0, 9, 0])), false);
  assert.equal(frameIsBlack(new Float32Array([])), false);
});

test("kameraet meldes gået i stå efter nogle sorte målinger i træk — og kun én gang", () => {
  const tracker = new BlackFrameTracker();
  for (let index = 1; index < BLACK_SAMPLES; index++) assert.equal(tracker.push(true), false);
  assert.equal(tracker.push(true), true);
  assert.equal(tracker.push(true), false);
  tracker.push(false);
  for (let index = 1; index < BLACK_SAMPLES; index++) assert.equal(tracker.push(true), false);
  assert.equal(tracker.push(true), true);
});
