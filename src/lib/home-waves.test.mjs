// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWaveScene, drawWaveScene, heartbeatShape, mulberry32, WAVE_BLEED } from "./home-waves.ts";

const palette = {
  ramp: [
    { at: 0, color: [127, 190, 152] },
    { at: 0.5, color: [215, 241, 167] },
    { at: 1, color: [244, 240, 233] },
  ],
  deep: [80, 160, 110],
  pulse: [163, 230, 53],
  pulseCore: [140, 200, 60],
};

/** Minimal canvas-stand-in, der registrerer tegnekald og tjekker for NaN. */
function fakeContext() {
  const calls = { stroke: 0, fill: 0, bad: 0 };
  const check = (...values) => {
    for (const v of values) if (typeof v === "number" && !Number.isFinite(v)) calls.bad++;
  };
  const gradient = { addColorStop: () => {} };
  return {
    calls,
    canvas: { width: 100, height: 100 },
    setTransform: check,
    clearRect: check,
    save() {},
    restore() {},
    translate: check,
    rotate: check,
    scale: check,
    beginPath() {},
    moveTo: check,
    lineTo: check,
    quadraticCurveTo: check,
    createLinearGradient: (...a) => (check(...a), gradient),
    createRadialGradient: (...a) => (check(...a), gradient),
    fillRect: (...a) => (check(...a), calls.fill++),
    stroke: () => calls.stroke++,
    set lineWidth(v) {
      check(v);
    },
    set globalAlpha(v) {
      check(v);
      if (v < 0 || v > 1) calls.bad++;
    },
    set strokeStyle(_) {},
    set fillStyle(_) {},
    set lineCap(_) {},
    set lineJoin(_) {},
  };
}

test("samme seed giver samme scene, forskellige seeds forskellige", () => {
  assert.deepEqual(createWaveScene(7), createWaveScene(7));
  assert.notDeepEqual(createWaveScene(7), createWaveScene(8));
  const rand = mulberry32(1);
  for (let i = 0; i < 1000; i++) {
    const v = rand();
    assert.ok(v >= 0 && v < 1);
  }
});

test("scenen tegner uden NaN på mobil og desktop, til alle tider", () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const scene = createWaveScene(seed);
    assert.ok(scene.bundles.length >= 3 && scene.bundles.length <= 4);
    for (const [width, height] of [[393, 430], [320, 400], [1400, 430]]) {
      for (const t of [0, 1.5, 300, 5000]) {
        const ctx = fakeContext();
        drawWaveScene(ctx, scene, palette, { t, width, height, scale: 0.8 });
        assert.equal(ctx.calls.bad, 0);
        assert.ok(ctx.calls.stroke > 0);
        assert.equal(ctx.calls.fill, scene.fog.length);
      }
    }
  }
  assert.ok(WAVE_BLEED > 0);
});

test("hjerteslaget har én tydelig R-tak op og er fladt langt fra midten", () => {
  assert.ok(heartbeatShape(0) < -0.9);
  assert.ok(Math.abs(heartbeatShape(1)) < 1e-3);
  assert.ok(Math.abs(heartbeatShape(-1)) < 1e-3);
});

test("puls-linjen starter helt ude ved venstre kant og ligger midt i hero", () => {
  const scene = createWaveScene(5);
  assert.ok(scene.pulse.y >= 0.55 && scene.pulse.y <= 0.65);
  for (const t of [0.5, 1, 2, 3]) {
    // Find et tidspunkt i fejet og tjek, at sporet begynder uden for venstre kant.
    const time = scene.pulse.period * 10 - scene.pulse.offset + t;
    const ctx = fakeContext();
    const starts = [];
    ctx.moveTo = (x) => starts.push(x);
    drawWaveScene(ctx, { ...scene, bundles: [], fog: [] }, palette, { t: time, width: 393, height: 430, scale: 1 });
    assert.ok(starts.length > 0);
    assert.equal(starts[0], -WAVE_BLEED);
  }
});

test("bølgerne holder sig inden for rimelige grænser og bevæger sig langsomt", () => {
  const scene = createWaveScene(42);
  // Mål lodret bevægelse mellem to tidspunkter 1 s fra hinanden via moveTo/stroke-spor.
  const firstY = (t) => {
    let y = null;
    const ctx = fakeContext();
    ctx.moveTo = (_x, yy) => {
      if (y === null) y = yy;
    };
    drawWaveScene(ctx, scene, palette, { t, width: 393, height: 430, scale: 1 });
    return y;
  };
  const y0 = firstY(100);
  const y1 = firstY(101);
  assert.ok(Math.abs(y1 - y0) < 8, `for hurtig bevægelse: ${Math.abs(y1 - y0)} px/s`);
  assert.ok(y0 > -200 && y0 < 700);
});
