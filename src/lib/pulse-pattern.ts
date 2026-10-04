// Puls-mønstre → sportsforslag (docs/DECISIONS.md 2026-10-04).
//
// Ren logik uden database og uden alias-importer, så den kan køres med
// `node --test` (src/lib/pulse-pattern.test.mjs).
//
// 1) extractPulseFeatures: gør en pulskurve (udsvinget + 20 min før) til få tal
//    — belastning, varighed, opvarmning, nedkøling, jævnhed og antal
//    svingninger. En gåtur er lav og jævn; en løbetur starter med rolig
//    opvarmning, ligger højt og køles ned; intervaller svinger op og ned.
// 2) classifyPulsePattern: to lag.
//    - Mønster: fælles tommelfingerregler pr. sport (walking, running, cycling,
//      hiit, strength).
//    - Personligt: nærmeste naboer blandt brugerens EGNE kendte sessioner
//      (urets kategori eller svar på "Hvad foretog du dig?"). Jo flere, jo
//      mere vægt; derfor kan den også lære sport, reglerne ikke kender.
//    Et forslag vises først, når der er data nok (se `ready`).

const MINUTE = 60_000;
const TIME_ZONE = "Europe/Copenhagen";

export type PulseSample = { t: number; bpm: number };

export type PulseFeatures = {
  durationMin: number;
  restingBpm: number;
  avgBpm: number;
  peakBpm: number;
  /** Gennemsnitspuls som andel af pulsreserven (hvilepuls → maxpuls), 0–1. */
  intensity: number;
  /** Minutter fra rolig puls til plateau; null hvis der ikke er målinger før start. */
  warmupMin: number | null;
  /** Minutter fra sidste høje måling til udsvinget slutter. */
  coolMin: number;
  /** Variation på plateauet (standardafvigelse / middel). */
  cv: number;
  /** Tydelige op/ned-skift pr. 10 minutter. */
  swingsPer10Min: number;
  sampleCount: number;
  /** Andel af udsvingets 2-minutters-felter, der har en måling (0–1). */
  coverage: number;
  /** Time (0–23) og ugedag (0 = mandag) for start, dansk tid. */
  hour: number;
  weekday: number;
};

export type PulseShapeTag = "warmup" | "steady" | "intervals" | "cooldown" | "easy" | "hard" | "long";

export type LabelledExample = { sport: string; features: PulseFeatures };

export type PulseSuggestion = {
  sport: string;
  /** 0–1. */
  confidence: number;
  /** "personal" når brugerens egne tidligere sessioner afgør, ellers "pattern". */
  basis: "personal" | "pattern";
  alternatives: { sport: string; confidence: number }[];
  shape: PulseShapeTag[];
  /** Skal forslaget vises for brugeren? (nok data + høj nok sikkerhed) */
  ready: boolean;
};

// "Når der er data nok": forslag vises først, når brugeren har mindst så
// mange kendte sessioner, pulsen er målt tæt nok, og der er pulsdata fra
// mindst så mange dage.
export const MIN_LABELLED_EXAMPLES = 3;
export const SUGGEST_MIN_CONFIDENCE = 0.6;
export const MIN_BASELINE_DAYS = 3;
export const MIN_SAMPLES = 8;
export const MIN_COVERAGE = 0.6;
export const MIN_DURATION_MIN = 8;

const LEAD_MINUTES = 20;
const SLOT_MINUTES = 2;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Maxpuls efter Tanaka (208 − 0,7 × alder); 190 når alderen er ukendt. */
export function maxHeartRate(age: number | null | undefined) {
  return age && age > 0 ? 208 - 0.7 * age : 190;
}

function localParts(ms: number) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  );
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return { hour: Number(parts.hour) % 24, weekday: Math.max(0, weekdays.indexOf(String(parts.weekday))) };
}

/** Tæller tydelige op/ned-skift (zig-zag med tærskel) i en glattet kurve. */
function countReversals(values: number[], threshold: number) {
  if (values.length < 3) return 0;
  let direction = 0;
  let extreme = values[0];
  let legs = 0;
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (direction === 0) {
      if (v - extreme >= threshold) {
        direction = 1;
        extreme = v;
        legs++;
      } else if (extreme - v >= threshold) {
        direction = -1;
        extreme = v;
        legs++;
      }
    } else if (direction === 1) {
      if (v > extreme) extreme = v;
      else if (extreme - v >= threshold) {
        direction = -1;
        extreme = v;
        legs++;
      }
    } else if (v < extreme) extreme = v;
    else if (v - extreme >= threshold) {
      direction = 1;
      extreme = v;
      legs++;
    }
  }
  return Math.max(0, legs - 1);
}

/**
 * Nøgletal for ét udsving/en session. `samples` skal være sorteret stigende og
 * dække mindst 20 min før `range.start`, hvis opvarmningen skal kunne ses.
 */
export function extractPulseFeatures(
  samples: PulseSample[],
  range: { start: number; end: number },
  context: { restingBpm: number; age?: number | null },
): PulseFeatures | null {
  const inside = samples.filter((s) => s.t >= range.start && s.t <= range.end);
  if (inside.length < 3) return null;

  const rest = context.restingBpm;
  const durationMs = Math.max(MINUTE, range.end - range.start);
  const middle = inside.filter(
    (s) => s.t >= range.start + durationMs * 0.2 && s.t <= range.start + durationMs * 0.8,
  );
  const plateauSamples = middle.length >= 3 ? middle : inside;
  const plateau = median(plateauSamples.map((s) => s.bpm));
  const mean = plateauSamples.reduce((sum, s) => sum + s.bpm, 0) / plateauSamples.length;
  const variance = plateauSamples.reduce((sum, s) => sum + (s.bpm - mean) ** 2, 0) / plateauSamples.length;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

  const span = Math.max(10, plateau - rest);
  const avgBpm = inside.reduce((sum, s) => sum + s.bpm, 0) / inside.length;
  const peakBpm = Math.max(...inside.map((s) => s.bpm));
  const reserve = Math.max(20, maxHeartRate(context.age) - rest);
  const intensity = Math.min(1, Math.max(0, (avgBpm - rest) / reserve));

  // Opvarmning: tiden fra "rolig" (25 % af vejen op) til "næsten på plateau" (85 %).
  const lead = samples.filter((s) => s.t >= range.start - LEAD_MINUTES * MINUTE && s.t <= range.end);
  const low = rest + 0.25 * span;
  const high = rest + 0.85 * span;
  const highIndex = lead.findIndex((s) => s.bpm >= high);
  const hasBefore = lead.some((s) => s.t < range.start);
  let warmupMin: number | null = null;
  if (hasBefore && highIndex >= 0) {
    let lowIndex = -1;
    for (let i = highIndex; i >= 0; i--) {
      if (lead[i].bpm <= low) {
        lowIndex = i;
        break;
      }
    }
    const from = lowIndex >= 0 ? lead[lowIndex].t : lead[0].t;
    warmupMin = Math.max(0, (lead[highIndex].t - from) / MINUTE);
  }

  // Nedkøling: fra sidste høje måling (80 % af plateauet) til udsvinget slutter.
  const highLevel = rest + 0.8 * span;
  let lastHigh = inside[0].t;
  for (const s of inside) if (s.bpm >= highLevel) lastHigh = s.t;
  const coolMin = Math.max(0, (range.end - lastHigh) / MINUTE);

  // Svingninger i en kurve, der er glattet over ca. 30 sekunder (tætte
  // målinger har støj; målinger med ét minut imellem glattes ikke).
  const gaps = inside.slice(1).map((s, i) => s.t - inside[i].t);
  const medianGap = gaps.length ? median(gaps) : MINUTE;
  const half = Math.min(3, Math.max(0, Math.round(30_000 / Math.max(1_000, medianGap) / 2)));
  const smooth = inside.map((s, i) => {
    const window = inside.slice(Math.max(0, i - half), Math.min(inside.length, i + half + 1));
    return window.reduce((sum, w) => sum + w.bpm, 0) / window.length;
  });
  const swingThreshold = Math.max(10, 0.18 * span);
  const swingsPer10Min = (countReversals(smooth, swingThreshold) / (durationMs / MINUTE)) * 10;

  const slots = Math.max(1, Math.ceil(durationMs / (SLOT_MINUTES * MINUTE)));
  const covered = new Set(inside.map((s) => Math.floor((s.t - range.start) / (SLOT_MINUTES * MINUTE))));
  const coverage = Math.min(1, covered.size / slots);

  const local = localParts(range.start);
  return {
    durationMin: Math.round(durationMs / MINUTE),
    restingBpm: Math.round(rest),
    avgBpm: Math.round(avgBpm),
    peakBpm: Math.round(peakBpm),
    intensity: Math.round(intensity * 1000) / 1000,
    warmupMin: warmupMin === null ? null : Math.round(warmupMin * 10) / 10,
    coolMin: Math.round(coolMin * 10) / 10,
    cv: Math.round(cv * 1000) / 1000,
    swingsPer10Min: Math.round(swingsPer10Min * 100) / 100,
    sampleCount: inside.length,
    coverage: Math.round(coverage * 100) / 100,
    hour: local.hour,
    weekday: local.weekday,
  };
}

// --- Lag 1: mønsterregler ---------------------------------------------------

/** Trapez: 0 uden for [a, d], 1 mellem b og c. */
function trap(x: number, a: number, b: number, c: number, d: number) {
  if (x <= a || x >= d) return 0;
  if (x < b) return (x - a) / (b - a);
  if (x <= c) return 1;
  return (d - x) / (d - c);
}

type Quad = [number, number, number, number];
type Rule = { feature: "intensity" | "durationMin" | "warmupMin" | "coolMin" | "cv" | "swingsPer10Min"; shape: Quad; weight: number };

// Sportsprofiler. Nøglerne er kataloget i src/lib/activity-met.ts. Reglerne er
// bevidst grove (puls alene kan ikke skelne løb fra cykling med sikkerhed);
// det personlige lag afgør, når brugeren har egne eksempler.
const PROFILES: { sport: string; rules: Rule[] }[] = [
  {
    sport: "walking",
    rules: [
      { feature: "intensity", shape: [0.02, 0.12, 0.5, 0.62], weight: 3 },
      { feature: "durationMin", shape: [6, 15, 120, 240], weight: 1 },
      { feature: "cv", shape: [-1, 0, 0.08, 0.16], weight: 1 },
      { feature: "swingsPer10Min", shape: [-1, 0, 0.8, 2], weight: 1.5 },
    ],
  },
  {
    sport: "running",
    rules: [
      { feature: "intensity", shape: [0.45, 0.62, 0.9, 1.05], weight: 3 },
      { feature: "durationMin", shape: [10, 25, 100, 200], weight: 1 },
      { feature: "warmupMin", shape: [0.5, 3, 12, 25], weight: 1.5 },
      { feature: "cv", shape: [-1, 0, 0.08, 0.15], weight: 1.5 },
      { feature: "swingsPer10Min", shape: [-1, 0, 1, 2.2], weight: 1 },
      { feature: "coolMin", shape: [0, 1.5, 12, 25], weight: 0.7 },
    ],
  },
  {
    sport: "cycling",
    rules: [
      { feature: "intensity", shape: [0.28, 0.4, 0.68, 0.85], weight: 3 },
      { feature: "durationMin", shape: [18, 40, 200, 420], weight: 1.5 },
      { feature: "warmupMin", shape: [0.5, 3, 15, 30], weight: 1 },
      { feature: "cv", shape: [-1, 0, 0.1, 0.2], weight: 1 },
      { feature: "swingsPer10Min", shape: [-1, 0, 1.4, 3], weight: 1 },
    ],
  },
  {
    sport: "hiit",
    rules: [
      { feature: "intensity", shape: [0.5, 0.68, 0.95, 1.1], weight: 3 },
      { feature: "durationMin", shape: [6, 14, 50, 80], weight: 1.5 },
      { feature: "swingsPer10Min", shape: [1, 2.2, 8, 14], weight: 3 },
      { feature: "cv", shape: [0.07, 0.12, 0.3, 0.45], weight: 1.5 },
    ],
  },
  {
    sport: "strength",
    rules: [
      { feature: "intensity", shape: [0.2, 0.32, 0.62, 0.78], weight: 3 },
      { feature: "durationMin", shape: [18, 35, 90, 150], weight: 1 },
      { feature: "swingsPer10Min", shape: [0.7, 1.4, 4.5, 8], weight: 2.5 },
      { feature: "cv", shape: [0.05, 0.09, 0.22, 0.35], weight: 1.5 },
    ],
  },
];

/** Ukendt værdi (fx manglende opvarmningsmåling) tæller neutralt, ikke som fejl. */
const UNKNOWN_MEMBERSHIP = 0.6;
const MEMBERSHIP_FLOOR = 0.03;
/** Mønsterlaget lover aldrig mere end dette — det er tommelfingerregler. */
const PATTERN_CAP = 0.88;

export function patternScores(features: PulseFeatures): Map<string, number> {
  const scores = new Map<string, number>();
  for (const profile of PROFILES) {
    let logSum = 0;
    let weightSum = 0;
    for (const rule of profile.rules) {
      const value = features[rule.feature];
      const membership = value === null ? UNKNOWN_MEMBERSHIP : trap(value, ...rule.shape);
      logSum += rule.weight * Math.log(Math.max(MEMBERSHIP_FLOOR, membership));
      weightSum += rule.weight;
    }
    scores.set(profile.sport, Math.min(PATTERN_CAP, Math.exp(logSum / weightSum)));
  }
  return scores;
}

// --- Lag 2: brugerens egne sessioner ---------------------------------------

const DISTANCE_WEIGHTS = { intensity: 3.5, duration: 1.4, warmup: 0.6, cv: 1, swings: 1, cool: 0.5, hour: 0.5 };
/** Bredden på "ligner": to sessioner af samme sport ligger typisk under 0,08 fra hinanden. */
const KERNEL_SIGMA = 0.1;
/** Mindst ét eget eksempel skal ligne (vægt ≥ 0,3 ≈ afstand ≤ 0,11), ellers tæller de egne slet ikke. */
const MIN_NEAREST_WEIGHT = 0.3;

function vector(f: PulseFeatures) {
  return {
    intensity: f.intensity,
    duration: Math.log(1 + f.durationMin) / Math.log(301),
    warmup: Math.min(1, (f.warmupMin ?? 5) / 20),
    cv: Math.min(1, f.cv / 0.4),
    swings: Math.min(1, f.swingsPer10Min / 10),
    cool: Math.min(1, f.coolMin / 20),
    hour: f.hour,
  };
}

export function featureDistance(a: PulseFeatures, b: PulseFeatures) {
  const va = vector(a);
  const vb = vector(b);
  const hourGap = Math.abs(va.hour - vb.hour);
  const hour = Math.min(hourGap, 24 - hourGap) / 12;
  const w = DISTANCE_WEIGHTS;
  const sum =
    w.intensity * (va.intensity - vb.intensity) ** 2 +
    w.duration * (va.duration - vb.duration) ** 2 +
    w.warmup * (va.warmup - vb.warmup) ** 2 +
    w.cv * (va.cv - vb.cv) ** 2 +
    w.swings * (va.swings - vb.swings) ** 2 +
    w.cool * (va.cool - vb.cool) ** 2 +
    w.hour * hour ** 2;
  const total = w.intensity + w.duration + w.warmup + w.cv + w.swings + w.cool + w.hour;
  return Math.sqrt(sum / total);
}

/** Andel af "stemmerne" fra de nærmeste egne sessioner, vægtet efter hvor meget de ligner. */
export function personalScores(features: PulseFeatures, examples: LabelledExample[]): Map<string, number> | null {
  const raw = new Map<string, number>();
  let total = 0;
  let nearest = 0;
  for (const example of examples) {
    const distance = featureDistance(features, example.features);
    const weight = Math.exp(-(distance ** 2) / (2 * KERNEL_SIGMA ** 2));
    raw.set(example.sport, (raw.get(example.sport) ?? 0) + weight);
    total += weight;
    nearest = Math.max(nearest, weight);
  }
  if (nearest < MIN_NEAREST_WEIGHT) return null;
  const scores = new Map<string, number>();
  for (const [sport, weight] of raw) scores.set(sport, (weight / total) * Math.min(1, weight / 2));
  return scores;
}

// --- Samlet ----------------------------------------------------------------

export function pulseShapeTags(f: PulseFeatures): PulseShapeTag[] {
  const tags: PulseShapeTag[] = [];
  if (f.warmupMin !== null && f.warmupMin >= 4) tags.push("warmup");
  if (f.swingsPer10Min >= 2.5) tags.push("intervals");
  else if (f.cv < 0.08 && f.swingsPer10Min < 1.5) tags.push("steady");
  if (f.coolMin >= 3) tags.push("cooldown");
  if (f.intensity >= 0.75) tags.push("hard");
  else if (f.intensity < 0.5) tags.push("easy");
  if (f.durationMin >= 60) tags.push("long");
  return tags;
}

export function hasEnoughPulseData(f: PulseFeatures, baselineDays: number) {
  return (
    f.sampleCount >= MIN_SAMPLES &&
    f.coverage >= MIN_COVERAGE &&
    f.durationMin >= MIN_DURATION_MIN &&
    baselineDays >= MIN_BASELINE_DAYS
  );
}

export function classifyPulsePattern(
  features: PulseFeatures,
  examples: LabelledExample[],
  context: { baselineDays: number },
): PulseSuggestion | null {
  const pattern = patternScores(features);
  const personal = personalScores(features, examples);
  // Jo flere egne sessioner, jo mere vægt på dem (fuld vægt fra tre).
  const alpha = personal ? Math.min(0.75, 0.25 * examples.length) : 0;

  const sports = new Set([...pattern.keys(), ...(personal ? personal.keys() : [])]);
  const final = [...sports]
    .map((sport) => {
      const p = pattern.get(sport) ?? 0;
      const q = personal?.get(sport) ?? 0;
      return { sport, score: (1 - alpha) * p + alpha * q, personalPart: alpha * q, patternPart: (1 - alpha) * p };
    })
    .sort((a, b) => b.score - a.score);

  const top = final[0];
  if (!top || top.score < 0.25) return null;
  const second = final[1]?.score ?? 0;
  const confidence = Math.max(0, Math.min(1, top.score - 0.5 * second));

  const ready =
    hasEnoughPulseData(features, context.baselineDays) &&
    examples.length >= MIN_LABELLED_EXAMPLES &&
    confidence >= SUGGEST_MIN_CONFIDENCE;

  return {
    sport: top.sport,
    confidence: Math.round(confidence * 100) / 100,
    basis: top.personalPart >= top.patternPart ? "personal" : "pattern",
    alternatives: final
      .slice(1, 4)
      .filter((entry) => entry.score >= 0.15)
      .map((entry) => ({ sport: entry.sport, confidence: Math.round(entry.score * 100) / 100 })),
    shape: pulseShapeTags(features),
    ready,
  };
}
