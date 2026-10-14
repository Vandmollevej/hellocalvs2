import test from "node:test";
import assert from "node:assert/strict";
import { isWebKit } from "./camera-webkit.ts";

test("isWebKit: iPhone/iPad og Safari på Mac = WebKit (takePhoto fryser videoen)", () => {
  assert.equal(isWebKit({ vendor: "Apple Computer, Inc.", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" }), true);
  assert.equal(isWebKit({ vendor: "Google Inc.", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/130.0 Mobile/15E148 Safari/604.1" }), true);
  assert.equal(isWebKit({ vendor: "Apple Computer, Inc.", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15" }), true);
  assert.equal(isWebKit({ vendor: "Google Inc.", userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36" }), false);
  assert.equal(isWebKit(undefined), false);
});
