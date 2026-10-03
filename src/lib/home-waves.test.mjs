// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWaveScene, drawWaveScene, heartbeatShape, mulberry32, previousPulseTail, pulseTrace, WAVE_BLEED } from "./home-waves.ts";

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
    const time = scene.pulse.sweep * 10 - scene.pulse.offset + t;
    const ctx = fakeContext();
    const starts = [];
    ctx.moveTo = (x) => starts.push(x);
    drawWaveScene(ctx, { ...scene, bundles: [], fog: [] }, palette, { t: time, width: 393, height: 430, scale: 1 });
    assert.ok(starts.length > 0);
    assert.equal(starts[0], -WAVE_BLEED);
  }
});

test("det forrige fej forsvinder som en slange: halen trækkes gradvist mod højre", () => {
  const left = -WAVE_BLEED;
  const right = 393 + WAVE_BLEED;
  let previous = -Infinity;
  let partial = 0;
  for (let progress = 0; progress <= 1; progress += 0.01) {
    const head = left + progress * (right - left);
    const tail = previousPulseTail(progress, head, left, right);
    assert.ok(tail >= previous, "halen går aldrig baglæns");
    assert.ok(tail >= head + 28, "halen ligger foran det nye fejs spids");
    if (tail > head + 28 && tail < right) partial++;
    previous = tail;
  }
  assert.ok(partial > 20, `halen skal bevæge sig synligt (${partial} trin)`);
  // Ved ca. 3/4 af det nye fej er det forrige spor helt væk.
  assert.ok(previousPulseTail(0.8, left + 0.8 * (right - left), left, right) >= right);
});

test("det forrige spor tegnes i fuld styrke, ikke tonet ud", () => {
  const scene = createWaveScene(4);
  const ctx = fakeContext();
  const alphas = [];
  const original = Object.getOwnPropertyDescriptor(ctx, "globalAlpha");
  Object.defineProperty(ctx, "globalAlpha", { set: (v) => (alphas.push(v), original.set(v)) });
  const time = scene.pulse.sweep * 10 - scene.pulse.offset + scene.pulse.sweep * 0.4;
  drawWaveScene(ctx, { ...scene, bundles: [], fog: [] }, palette, { t: time, width: 393, height: 430, scale: 1 });
  // To spor (nyt + forrige) à to lag: alle med samme styrke.
  assert.equal(alphas.filter((a) => a === 0.85).length, 2);
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

/** Antal R-takker (lokale toppe over 60 % af udslaget) i et fej. */
function countBeats(scene, bpm, width = 393) {
  const yAt = pulseTrace(scene.pulse, 3, bpm, width);
  let beats = 0;
  let above = false;
  for (let x = -WAVE_BLEED; x <= width + WAVE_BLEED; x += 0.5) {
    const isAbove = yAt(x) < -0.6 * scene.pulse.amplitude;
    if (isAbove && !above) beats++;
    above = isAbove;
  }
  return beats;
}

test("puls-linjen slår i den givne puls (60 bpm = ét slag i sekundet)", () => {
  const scene = createWaveScene(11);
  const at60 = countBeats(scene, 60);
  assert.ok(Math.abs(at60 - scene.pulse.sweep) <= 1, `${at60} slag på ${scene.pulse.sweep.toFixed(2)} s ved 60 bpm`);
  const at120 = countBeats(scene, 120);
  assert.ok(Math.abs(at120 - scene.pulse.sweep * 2) <= 1, `${at120} slag ved 120 bpm`);
});

test("pulsen låses pr. fej, så slagene ikke flytter sig midt i et fej", () => {
  const scene = createWaveScene(3);
  const pathAt = (bpm) => {
    const ys = [];
    const ctx = fakeContext();
    ctx.lineTo = (_x, y) => ys.push(y);
    const time = scene.pulse.sweep * 20 - scene.pulse.offset + scene.pulse.sweep * 0.8;
    drawWaveScene(ctx, { ...scene, bundles: [], fog: [] }, palette, { t: time, width: 393, height: 430, scale: 1, bpm });
    return ys;
  };
  assert.deepEqual(pathAt(60), pathAt(140));
});

test("pulslinjen tegner ingen NaN ved ekstreme pulser", () => {
  const scene = createWaveScene(9);
  for (const bpm of [0, 25, 200, 400, Number.NaN]) {
    const ctx = fakeContext();
    drawWaveScene(ctx, { ...scene, pulse: { ...scene.pulse, lockedBpm: {} } }, palette, { t: 50, width: 393, height: 430, scale: 1, bpm });
    assert.equal(ctx.calls.bad, 0, `bpm ${bpm}`);
  }
});

test("puls-linjen ligger på den givne grundlinje (over tal-hjulets midte)", () => {
  const scene = createWaveScene(21);
  const ctx = fakeContext();
  const starts = [];
  ctx.moveTo = (x, y) => starts.push([x, y]);
  const time = scene.pulse.sweep * 10 - scene.pulse.offset + scene.pulse.sweep * 0.5;
  drawWaveScene(ctx, { ...scene, bundles: [], fog: [] }, palette, { t: time, width: 393, height: 430, scale: 1, pulseY: 150 });
  const [x, y] = starts[0];
  assert.equal(x, -WAVE_BLEED);
  assert.ok(Math.abs(y - 150) <= scene.pulse.amplitude * 1.2, `starter i y=${y}`);
});
