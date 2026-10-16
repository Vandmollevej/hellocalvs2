// Kør: npm test  (node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import { frontPhotoProblem, imageSize } from "./front-photo-guard.ts";

function jpeg(width, height) {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0, 0, 0, 0]);
}

test("læser størrelsen af en JPEG", () => {
  assert.deepEqual(imageSize(jpeg(1080, 1920)), { width: 1080, height: 1920 });
});

test("hele kamerarammen er i orden", () => {
  assert.equal(frontPhotoProblem({ width: 1080, height: 1920 }), null);
  assert.equal(frontPhotoProblem({ width: 1440, height: 1080 }), null);
  assert.equal(frontPhotoProblem({ width: 1280, height: 1280 }), null);
});

test("den halverede DAGO-stribe opdages", () => {
  assert.match(frontPhotoProblem({ width: 300, height: 1180 }), /smalt/);
});

test("et for lille billede opdages", () => {
  assert.match(frontPhotoProblem({ width: 200, height: 200 }), /lille/);
});
