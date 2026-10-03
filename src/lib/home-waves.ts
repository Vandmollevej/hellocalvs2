// Rolig bølge-baggrund til forsiden (bruger 2026-10-01, lavet om 2026-10-03):
// få, afdæmpede og skarpe bånd af bølgelinjer med overvejende gul-brunlige
// nuancer øverst og grønne længere nede, lidt tåge kun forneden og en lime
// puls-linje (pulsmåler), der tegnes helt inde fra venstre kant omkring
// midten af hero og slår i brugerens målte puls (60 bpm uden ur, bruger
// 2026-10-03). Alt andet er tilfældigt pr. besøg.
// Ren tegnelogik uden React — komponenten ligger i components/HomeWaves.tsx.

export type Rgb = [number, number, number];

/** Pixels tegnet uden for synsfeltet, så sløringen ikke lyser op ved kanterne. */
export const WAVE_BLEED = 48;

export type WavePalette = {
  /** Farverampe oppefra (0) og ned (1): gul-brun → gullig creme → lime-creme → grøn. */
  ramp: Array<{ at: number; color: Rgb }>;
  /** Dybere grøn til det bløde skær under hvert bånd. */
  deep: Rgb;
  /** Puls-linjens lysende lime og dens lidt mørkere kerne. */
  pulse: Rgb;
  pulseCore: Rgb;
};

export function mixRgb(a: Rgb, b: Rgb, f: number): Rgb {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])},${alpha.toFixed(3)})`;
}

/** Læser en farve-token (fx "--hf-green-light") som RGB via browserens egen opløsning af var(). */
function readToken(host: HTMLElement, name: string): Rgb | null {
  const probe = document.createElement("span");
  probe.style.display = "none";
  probe.style.color = `var(${name})`;
  host.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  host.removeChild(probe);
  const numbers = computed.match(/-?\d*\.?\d+/g)?.map(Number);
  if (!numbers || numbers.length < 3) return null;
  const scale = computed.startsWith("color(") ? 255 : 1;
  return [numbers[0] * scale, numbers[1] * scale, numbers[2] * scale];
}

/** Farverne kommer udelukkende fra appens tokens (design.md afsnit 3). */
export function readWavePalette(host: HTMLElement): WavePalette | null {
  const brand = readToken(host, "--hf-color-brand");
  const mint = readToken(host, "--hf-green-light");
  const muted = readToken(host, "--hf-green-muted");
  const lime = readToken(host, "--hf-lime");
  const gold = readToken(host, "--hf-color-warning-fill");
  const cream = readToken(host, "--hf-cream");
  const tan = readToken(host, "--hf-tan");
  if (!brand || !mint || !muted || !lime || !gold || !cream || !tan) return null;
  return {
    ramp: [
      { at: 0, color: mixRgb(gold, tan, 0.5) },
      { at: 0.22, color: mixRgb(gold, cream, 0.55) },
      { at: 0.46, color: mixRgb(lime, cream, 0.55) },
      { at: 0.7, color: mint },
      { at: 1, color: mixRgb(muted, mint, 0.5) },
    ],
    deep: mixRgb(brand, mint, 0.55),
    pulse: lime,
    pulseCore: mixRgb(lime, brand, 0.18),
  };
}

function rampAt(palette: WavePalette, u: number): Rgb {
  const x = Math.min(1, Math.max(0, u));
  const { ramp } = palette;
  for (let i = 1; i < ramp.length; i++) {
    if (x <= ramp[i].at) {
      const span = ramp[i].at - ramp[i - 1].at;
      return mixRgb(ramp[i - 1].color, ramp[i].color, span > 0 ? (x - ramp[i - 1].at) / span : 0);
    }
  }
  return ramp[ramp.length - 1].color;
}

/** Lille, hurtig seedet tilfældighedsgenerator (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Component = {
  /** Bølgelængde i multipla af skærmbredden. */
  wavelength: number;
  phase: number;
  /** Fasehastighed i px/s (fortegn = retning). */
  speed: number;
  /** Amplitude i multipla af højden. */
  amplitude: number;
};

type Strand = {
  offset: number;
  width: number;
  alpha: number;
  /** Forskydning af farverampen, så strengene ikke får præcis samme farve i samme højde. */
  tint: number;
  amplitudeScale: number;
  components: Component[];
};

type Bundle = {
  /** Midterlinjens højde som andel af højden. */
  y: number;
  /** Forskydning af farverampen for hele båndet (oftest lille, af og til stor). */
  tint: number;
  /** Hvor meget amplituden må variere hen over skærmen (oftest lidt). */
  envelopeDepth: number;
  /** Strengene spreder sig og samler sig langsomt hen over skærmen. */
  spread: Component;
  driftAmplitude: number;
  driftRate: number;
  driftPhase: number;
  envelope: Component;
  glowWidth: number;
  glowAlpha: number;
  strands: Strand[];
};

type Fog = {
  x: number;
  y: number;
  swayX: number;
  swayY: number;
  rateX: number;
  rateY: number;
  phaseX: number;
  phaseY: number;
  radius: number;
  squash: number;
  tilt: number;
  alpha: number;
};

/** Puls-linje (pulsmåler), der tegnes fra venstre kant hen over hero. */
type Pulse = {
  /** Grundlinjens højde som andel af højden (lige under hero-hjulets midterrække). */
  y: number;
  /** Udslagets højde i px. */
  amplitude: number;
  /** Sekunder et fej tager hen over skærmen; næste fej starter straks. */
  sweep: number;
  offset: number;
  seed: number;
  /** Pulsen låses pr. fej, så slagene ikke flytter sig, hvis pulsen skifter midt i et fej. */
  lockedBpm: Record<number, number>;
};

/** Puls uden tilsluttet ur (bruger 2026-10-03). */
export const DEFAULT_PULSE_BPM = 60;

export type WaveScene = { bundles: Bundle[]; fog: Fog[]; pulse: Pulse; startTime: number };

export function createWaveScene(seed: number): WaveScene {
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const sign = () => (rand() < 0.5 ? -1 : 1);

  const bundleCount = 3 + Math.floor(rand() * 2);
  const bundles: Bundle[] = [];
  for (let i = 0; i < bundleCount; i++) {
    const direction = sign();
    // Kortere bølgelængder end skærmbredden, så hele bølger ses og ingen side
    // konsekvent får de største udsving.
    const base: Component[] = [
      { wavelength: between(0.9, 1.4), phase: between(0, 6.28), speed: direction * between(3, 5.5), amplitude: between(0.025, 0.045) },
      { wavelength: between(0.55, 0.85), phase: between(0, 6.28), speed: direction * between(4, 7), amplitude: between(0.012, 0.022) },
      {
        wavelength: between(0.3, 0.48),
        phase: between(0, 6.28),
        speed: (rand() < 0.7 ? direction : -direction) * between(5, 9),
        amplitude: between(0.005, 0.01),
      },
    ];
    // Strengene ligger med god afstand og egne mindre bølger, så de ikke
    // snoer sig om hinanden som et tov.
    const strandCount = 2 + Math.floor(rand() * 3);
    const gap = between(14, 22);
    const strands: Strand[] = [];
    for (let s = 0; s < strandCount; s++) {
      strands.push({
        offset: (s - (strandCount - 1) / 2) * gap + between(-5, 5),
        width: between(2, 3.4),
        alpha: between(0.22, 0.4),
        tint: between(-0.08, 0.08),
        amplitudeScale: between(0.85, 1.15),
        components: base.map((c, j) => ({
          wavelength: c.wavelength * (1 + between(-0.06, 0.06)),
          phase: j === 0 ? c.phase + between(-0.3, 0.3) : between(0, 6.28),
          speed: c.speed * between(0.85, 1.15),
          amplitude: c.amplitude,
        })),
      });
    }
    // Overvejende tendens: farverne følger rampen (gul-brun øverst), men af og
    // til får et bånd en tydeligt anden nuance.
    const tint = rand() < 0.2 ? sign() * between(0.18, 0.32) : between(-0.08, 0.08);
    bundles.push({
      y: 0.08 + (i + rand()) * (0.8 / bundleCount),
      tint,
      envelopeDepth: rand() < 0.2 ? between(0.3, 0.42) : between(0.06, 0.15),
      spread: { wavelength: between(0.8, 1.5), phase: between(0, 6.28), speed: sign() * between(2, 5), amplitude: between(0.2, 0.35) },
      driftAmplitude: between(6, 14),
      driftRate: (Math.PI * 2) / between(55, 100),
      driftPhase: between(0, 6.28),
      envelope: { wavelength: between(0.9, 1.6), phase: between(0, 6.28), speed: sign() * between(3, 6), amplitude: 0 },
      glowWidth: between(30, 46),
      glowAlpha: between(0.015, 0.03),
      strands,
    });
  }

  const fog: Fog[] = [];
  // Tågen ligger kun forneden, så toppen forbliver skarp (bruger 2026-10-03).
  const fogCount = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < fogCount; i++) {
    fog.push({
      x: between(-0.05, 1.05),
      y: between(0.78, 1),
      swayX: between(0.06, 0.16),
      swayY: between(0.02, 0.05),
      rateX: (Math.PI * 2) / between(60, 140),
      rateY: (Math.PI * 2) / between(70, 150),
      phaseX: between(0, 6.28),
      phaseY: between(0, 6.28),
      radius: between(0.35, 0.6),
      squash: between(0.35, 0.55),
      tilt: between(-0.25, 0.25),
      alpha: between(0.05, 0.1),
    });
  }

  const pulse: Pulse = {
    y: between(0.58, 0.62),
    amplitude: between(18, 26),
    sweep: between(3, 4),
    offset: between(0, 20),
    seed: Math.floor(rand() * 4294967296),
    lockedBpm: {},
  };

  return { bundles, fog, pulse, startTime: between(0, 600) };
}

/** Højden på en streng i x ved tiden t (alt i CSS-pixels). */
function strandY(bundle: Bundle, strand: Strand, x: number, t: number, width: number, height: number) {
  const env = bundle.envelope;
  const envelope = 1 + bundle.envelopeDepth * Math.sin(((Math.PI * 2) / (env.wavelength * width)) * (x - env.speed * t) + env.phase);
  const sp = bundle.spread;
  const spread = 1 + sp.amplitude * Math.sin(((Math.PI * 2) / (sp.wavelength * width)) * (x - sp.speed * t) + sp.phase);
  let wave = 0;
  for (const c of strand.components) {
    wave += c.amplitude * height * Math.sin(((Math.PI * 2) / (c.wavelength * width)) * (x - c.speed * t) + c.phase);
  }
  const drift = bundle.driftAmplitude * Math.sin(bundle.driftRate * t + bundle.driftPhase);
  return bundle.y * height + drift + strand.offset * spread + wave * envelope * strand.amplitudeScale;
}

/** Ét hjerteslag (P, QRS, T) som lodret udslag; u er afstanden fra R-takken i slag-bredder. Negativ = op. */
export function heartbeatShape(u: number) {
  const g = (center: number, w: number) => Math.exp(-(((u - center) / w) ** 2));
  return -0.12 * g(-0.3, 0.06) + 0.14 * g(-0.055, 0.018) - 1 * g(0, 0.022) + 0.32 * g(0.05, 0.022) - 0.22 * g(0.3, 0.075);
}

function tracePath(ctx: CanvasRenderingContext2D, ys: Float32Array, count: number, x0: number, step: number) {
  ctx.beginPath();
  ctx.moveTo(x0, ys[0]);
  for (let i = 1; i < count - 1; i++) {
    const cx = x0 + i * step;
    const midX = cx + step / 2;
    const midY = (ys[i] + ys[i + 1]) / 2;
    ctx.quadraticCurveTo(cx, ys[i], midX, midY);
  }
  ctx.lineTo(x0 + (count - 1) * step, ys[count - 1]);
}

export type WaveFrame = {
  t: number;
  /** Synsfeltets størrelse i CSS-pixels (uden bleed). */
  width: number;
  height: number;
  /** Canvas-pixels pr. CSS-pixel. */
  scale: number;
  /** Pulsen, linjen slår i (DEFAULT_PULSE_BPM uden ur). */
  bpm?: number;
  /** Puls-linjens grundlinje i px fra toppen; uden den bruges scenens andel af højden. */
  pulseY?: number;
};

const STEP_TARGET = 7;

export function drawWaveScene(
  ctx: CanvasRenderingContext2D,
  scene: WaveScene,
  palette: WavePalette,
  frame: WaveFrame
) {
  const { t, width, height, scale, bpm = DEFAULT_PULSE_BPM, pulseY } = frame;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(scale, 0, 0, scale, WAVE_BLEED * scale, WAVE_BLEED * scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Tåge: store, bløde, langsomt drivende pletter bag båndene.
  for (const fog of scene.fog) {
    const cx = (fog.x + fog.swayX * Math.sin(fog.rateX * t + fog.phaseX)) * width;
    const cy = (fog.y + fog.swayY * Math.sin(fog.rateY * t + fog.phaseY)) * height;
    const radius = fog.radius * Math.max(width, height * 0.8);
    const color = rampAt(palette, cy / height);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, rgba(color, fog.alpha));
    gradient.addColorStop(1, rgba(color, 0));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(fog.tilt);
    ctx.scale(1, fog.squash);
    ctx.fillStyle = gradient;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }

  const step = Math.max(4, Math.min(STEP_TARGET, width / 50));
  const x0 = -WAVE_BLEED - step;
  const count = Math.ceil((width + WAVE_BLEED * 2 + step * 2) / step) + 1;
  const ys = new Float32Array(count);

  const rampGradient = (shift: number) => {
    const gradient = ctx.createLinearGradient(0, shift * height, 0, height + shift * height);
    for (const stop of palette.ramp) gradient.addColorStop(stop.at, rgba(stop.color, 1));
    return gradient;
  };

  for (const bundle of scene.bundles) {
    // Skær under båndet: den midterste streng, meget bred og svag.
    const middle = bundle.strands[Math.floor(bundle.strands.length / 2)];
    for (let i = 0; i < count; i++) ys[i] = strandY(bundle, middle, x0 + i * step, t, width, height);
    tracePath(ctx, ys, count, x0, step);
    ctx.strokeStyle = rgba(mixRgb(palette.deep, rampAt(palette, bundle.y - bundle.tint), 0.5), 1);
    ctx.globalAlpha = bundle.glowAlpha;
    ctx.lineWidth = bundle.glowWidth;
    ctx.stroke();

    for (const strand of bundle.strands) {
      for (let i = 0; i < count; i++) ys[i] = strandY(bundle, strand, x0 + i * step, t, width, height);
      tracePath(ctx, ys, count, x0, step);
      ctx.strokeStyle = rampGradient(bundle.tint + strand.tint);
      // Et svagt bredere lag under en skarp kerne: bløde bånd uden at toppen
      // ser sløret ud (bruger 2026-10-03). Sløret forneden kommer fra CSS-laget.
      const passes: Array<[number, number]> = [
        [1.8, 0.3],
        [1.0, 0.85],
      ];
      for (const [widthFactor, alphaFactor] of passes) {
        ctx.globalAlpha = strand.alpha * alphaFactor;
        ctx.lineWidth = strand.width * widthFactor;
        ctx.stroke();
      }
    }
  }

  drawPulse(ctx, scene.pulse, palette, t, width, height, bpm, pulseY ?? scene.pulse.y * height);
  ctx.globalAlpha = 1;
}

/** Pulsen for et fej: den, der gjaldt, da fejet startede. */
function bpmForCycle(pulse: Pulse, cycle: number, bpm: number) {
  if (pulse.lockedBpm[cycle] === undefined) {
    pulse.lockedBpm[cycle] = bpm;
    for (const key of Object.keys(pulse.lockedBpm)) if (Number(key) < cycle - 1) delete pulse.lockedBpm[Number(key)];
  }
  return pulse.lockedBpm[cycle];
}

/**
 * Lodret udslag i x for ét fej: et slag hvert 60/bpm sekund regnet i fejets
 * egen tid, så afstanden mellem slagene svarer til pulsen.
 */
export function pulseTrace(pulse: Pulse, cycle: number, bpm: number, width: number) {
  const left = -WAVE_BLEED;
  const span = width + WAVE_BLEED * 2;
  const speed = span / pulse.sweep;
  // Slagets bredde i px som før; omregnet til sekunder ligger P→T på ca. 0,8 s.
  const beatSeconds = Math.max(90, Math.min(150, width * 0.3)) / speed;
  const interval = 60 / Math.min(220, Math.max(30, Number.isFinite(bpm) ? bpm : DEFAULT_PULSE_BPM));
  const cycleRand = mulberry32(pulse.seed + cycle);
  const firstBeat = cycleRand() * interval;
  const beats: Array<{ at: number; amplitude: number }> = [];
  for (let at = firstBeat - interval; at < pulse.sweep + interval; at += interval) {
    beats.push({ at, amplitude: pulse.amplitude * (0.88 + 0.24 * cycleRand()) });
  }
  return (x: number) => {
    const time = ((x - left) / span) * pulse.sweep;
    let y = 0;
    for (const beat of beats) {
      const u = (time - beat.at) / beatSeconds;
      if (u > -1 && u < 1) y += beat.amplitude * heartbeatShape(u);
    }
    return y;
  };
}

/**
 * Puls-linjen: et lime spor, der tegnes fra venstre kant mod højre som på en
 * pulsmåler og slår i brugerens puls. Næste fej starter straks fra venstre og
 * visker det forrige ud foran sig, mens det toner væk.
 */
function drawPulse(
  ctx: CanvasRenderingContext2D,
  pulse: Pulse,
  palette: WavePalette,
  t: number,
  width: number,
  height: number,
  bpm: number,
  baseY: number
) {
  const time = t + pulse.offset;
  const cycle = Math.floor(time / pulse.sweep);
  const progress = (time - cycle * pulse.sweep) / pulse.sweep;
  const left = -WAVE_BLEED;
  const right = width + WAVE_BLEED;
  const head = left + progress * (right - left);
  const step = 1.5;

  // Lidt svagere ude ved kanten end ved spidsen, men synlig hele vejen ind.
  const fade = (color: Rgb, to: number) => {
    const gradient = ctx.createLinearGradient(left, 0, Math.max(to, left + 1), 0);
    gradient.addColorStop(0, rgba(color, 0.55));
    gradient.addColorStop(1, rgba(color, 1));
    return gradient;
  };
  const strokeTrace = (from: number, to: number, yAt: (x: number) => number, gradientEnd: number, alpha: number) => {
    ctx.beginPath();
    ctx.moveTo(from, baseY + yAt(from));
    for (let x = from + step; x < to; x += step) ctx.lineTo(x, baseY + yAt(x));
    ctx.lineTo(to, baseY + yAt(to));
    ctx.strokeStyle = fade(palette.pulse, gradientEnd);
    ctx.globalAlpha = 0.25 * alpha;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = fade(palette.pulseCore, gradientEnd);
    ctx.globalAlpha = 0.85 * alpha;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };

  const yAt = pulseTrace(pulse, cycle, bpmForCycle(pulse, cycle, bpm), width);
  if (head > left) strokeTrace(left, head, yAt, head, 1);

  // Det forrige fej, foran spidsen, toner ud i løbet af det nye fejs første del.
  const previousFade = Math.max(0, 1 - progress * 1.6);
  const eraseFrom = head + 28;
  if (previousFade > 0 && eraseFrom < right) {
    const previous = pulseTrace(pulse, cycle - 1, bpmForCycle(pulse, cycle - 1, bpm), width);
    strokeTrace(eraseFrom, right, previous, right, previousFade);
  }

  // Lille lysende punkt ved spidsen.
  ctx.beginPath();
  ctx.moveTo(head, baseY + yAt(head));
  ctx.lineTo(head + 0.01, baseY + yAt(head));
  ctx.strokeStyle = rgba(palette.pulse, 1);
  ctx.globalAlpha = 0.3;
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = rgba(palette.pulseCore, 1);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  ctx.stroke();
}
