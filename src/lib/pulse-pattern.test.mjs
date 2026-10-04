// Kør: npm test  (node --test, Node 24 fjerner TypeScript-typer selv)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_LABELLED_EXAMPLES,
  classifyPulsePattern,
  extractPulseFeatures,
  featureDistance,
  hasEnoughPulseData,
  patternScores,
} from "./pulse-pattern.ts";

const MINUTE = 60_000;
// Tirsdag 6. okt. 2026 kl. 17:00 dansk tid (CEST = UTC+2).
const T0 = Date.UTC(2026, 9, 6, 15, 0);
const REST = 58;

/** Pulskurve gennem punkter [minut, bpm] med lineær interpolation og en lille, deterministisk støj. */
function series(points, { stepMin = 1, noise = 2, start = T0 } = {}) {
  const out = [];
  const last = points[points.length - 1][0];
  for (let m = points[0][0]; m <= last; m += stepMin) {
    let i = 1;
    while (i < points.length - 1 && points[i][0] < m) i++;
    const [m0, b0] = points[i - 1];
    const [m1, b1] = points[i];
    const base = m1 === m0 ? b1 : b0 + ((b1 - b0) * (m - m0)) / (m1 - m0);
    const jitter = Math.sin(m * 1.7) * noise;
    out.push({ t: start + m * MINUTE, bpm: Math.round(base + jitter) });
  }
  return out;
}

/** Finder udsvinget (puls ≥ 100) og udtrækker nøgletal. */
function featuresOf(samples) {
  const above = samples.filter((s) => s.bpm >= 100);
  const range = { start: above[0].t, end: above[above.length - 1].t };
  return extractPulseFeatures(samples, range, { restingBpm: REST, age: 40 });
}

const walk = () =>
  series([[-20, 62], [0, 64], [3, 112], [48, 113], [52, 70], [60, 64]], { noise: 3 });
const run = () =>
  series([[-20, 62], [0, 64], [12, 150], [42, 156], [52, 92], [60, 70]], { noise: 3 });
const hiit = () => {
  const points = [[-20, 62], [0, 64], [5, 125]];
  let m = 5;
  for (let i = 0; i < 8; i++) {
    points.push([m + 0.5, 176], [m + 2, 128]);
    m += 2.5;
  }
  points.push([m + 4, 80], [m + 12, 66]);
  return series(points, { stepMin: 0.5, noise: 2 });
};
const strength = () => {
  const points = [[-20, 62], [0, 64], [8, 102]];
  let m = 8;
  for (let i = 0; i < 12; i++) {
    points.push([m + 1, 128], [m + 3, 100]);
    m += 4;
  }
  points.push([m + 5, 70], [m + 12, 64]);
  return series(points, { noise: 2 });
};
const cycling = () =>
  series([[-20, 62], [0, 64], [8, 122], [30, 134], [60, 124], [90, 136], [98, 80], [110, 64]], { noise: 6 });

function top(samples) {
  const scores = [...patternScores(featuresOf(samples))].sort((a, b) => b[1] - a[1]);
  return scores[0][0];
}

test("gåtur: lav, jævn puls uden opvarmning → walking", () => {
  const features = featuresOf(walk());
  assert.ok(features.intensity < 0.5, `intensity ${features.intensity}`);
  assert.ok(features.cv < 0.08);
  assert.equal(top(walk()), "walking");
});

test("løbetur: rolig opvarmning, højt plateau og nedkøling → running", () => {
  const features = featuresOf(run());
  assert.ok(features.warmupMin >= 5, `warmup ${features.warmupMin}`);
  assert.ok(features.coolMin >= 2, `cool ${features.coolMin}`);
  assert.ok(features.intensity > 0.6, `intensity ${features.intensity}`);
  assert.equal(top(run()), "running");
});

test("intervaller: mange store op/ned-skift → hiit", () => {
  const features = featuresOf(hiit());
  assert.ok(features.swingsPer10Min >= 2.5, `swings ${features.swingsPer10Min}`);
  assert.equal(top(hiit()), "hiit");
});

test("styrketræning: moderat puls med sæt og pauser → strength", () => {
  const features = featuresOf(strength());
  assert.ok(features.swingsPer10Min >= 1.4, `swings ${features.swingsPer10Min}`);
  assert.equal(top(strength()), "strength");
});

test("lang, moderat tur → cycling", () => {
  assert.equal(top(cycling()), "cycling");
});

test("hver mønstertype får sin egen toppscore — og gåtur ligner ikke løb", () => {
  const w = patternScores(featuresOf(walk()));
  assert.ok(w.get("walking") > 2 * w.get("running"));
  const r = patternScores(featuresOf(run()));
  assert.ok(r.get("running") > 2 * r.get("walking"));
});

test("for få målinger giver ingen nøgletal", () => {
  assert.equal(extractPulseFeatures([{ t: T0, bpm: 120 }], { start: T0, end: T0 + MINUTE }, { restingBpm: REST }), null);
});

test("uden målinger før start er opvarmning ukendt (null), ikke 0", () => {
  const samples = run().filter((s) => s.t >= T0 + 6 * MINUTE);
  const above = samples.filter((s) => s.bpm >= 100);
  const f = extractPulseFeatures(samples, { start: above[0].t, end: above[above.length - 1].t }, { restingBpm: REST, age: 40 });
  assert.equal(f.warmupMin, null);
});

test("starttid tælles i dansk tid: 15:00 UTC om sommeren = kl. 17, tirsdag", () => {
  const f = featuresOf(run());
  // Udsvinget starter ca. 4 min inde i opvarmningen.
  assert.equal(f.hour, 17);
  assert.equal(f.weekday, 1);
});

test("forslag vises ikke, før der er nok egne sessioner — men gættet gemmes", () => {
  const f = featuresOf(run());
  const none = classifyPulsePattern(f, [], { baselineDays: 10 });
  assert.equal(none.sport, "running");
  assert.equal(none.ready, false);
  const two = [
    { sport: "running", features: f },
    { sport: "running", features: f },
  ];
  assert.equal(classifyPulsePattern(f, two, { baselineDays: 10 }).ready, false);
});

test("forslag vises med nok sessioner og pulsdata", () => {
  const f = featuresOf(run());
  const examples = Array.from({ length: MIN_LABELLED_EXAMPLES }, () => ({ sport: "running", features: f }));
  const suggestion = classifyPulsePattern(f, examples, { baselineDays: 10 });
  assert.equal(suggestion.sport, "running");
  assert.equal(suggestion.ready, true);
  assert.ok(suggestion.confidence >= 0.6);
  assert.ok(suggestion.shape.includes("warmup"));
  assert.ok(suggestion.shape.includes("cooldown"));
});

test("for lidt pulsdata (få dage, få målinger) holder forslaget tilbage", () => {
  const f = featuresOf(run());
  const examples = Array.from({ length: 5 }, () => ({ sport: "running", features: f }));
  assert.equal(classifyPulsePattern(f, examples, { baselineDays: 1 }).ready, false);
  assert.equal(hasEnoughPulseData({ ...f, sampleCount: 4 }, 10), false);
  assert.equal(hasEnoughPulseData({ ...f, coverage: 0.3 }, 10), false);
});

test("brugerens egne sessioner lærer en sport, reglerne ikke kender (padel)", () => {
  // Padel: intermitterende, moderat-høj puls, lang — ligner ingen af profilerne.
  const padel = () => {
    const points = [[-20, 62], [0, 64], [6, 118]];
    let m = 6;
    for (let i = 0; i < 9; i++) {
      points.push([m + 2, 146], [m + 5, 118]);
      m += 6;
    }
    points.push([m + 5, 80], [m + 12, 64]);
    return series(points, { noise: 3 });
  };
  const f = featuresOf(padel());
  const examples = Array.from({ length: 4 }, () => ({ sport: "padel", features: featuresOf(padel()) }));
  const suggestion = classifyPulsePattern(f, examples, { baselineDays: 10 });
  assert.equal(suggestion.sport, "padel");
  assert.equal(suggestion.basis, "personal");
  assert.equal(suggestion.ready, true);
});

test("personligt lag skelner brugerens løb fra gåture, også når mønsterreglerne tøver", () => {
  const f = featuresOf(run());
  const examples = [
    ...Array.from({ length: 3 }, () => ({ sport: "walking", features: featuresOf(walk()) })),
    ...Array.from({ length: 3 }, () => ({ sport: "running", features: featuresOf(run()) })),
  ];
  const suggestion = classifyPulsePattern(f, examples, { baselineDays: 10 });
  assert.equal(suggestion.sport, "running");
  assert.ok(featureDistance(f, featuresOf(walk())) > featureDistance(f, featuresOf(run())));
});

test("noget der ligner ingen af brugerens sessioner falder tilbage på mønsterreglerne", () => {
  // Brugeren har kun gåture, men nu kommer en klar løbetur.
  const f = featuresOf(run());
  const examples = Array.from({ length: 4 }, () => ({ sport: "walking", features: featuresOf(walk()) }));
  const suggestion = classifyPulsePattern(f, examples, { baselineDays: 10 });
  assert.equal(suggestion.sport, "running");
  assert.equal(suggestion.basis, "pattern");
});
