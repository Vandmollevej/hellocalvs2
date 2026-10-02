// Rolig bølge-baggrund til forsiden (bruger 2026-10-01): bløde, langsomme
// bånd af bølgelinjer øverst på skærmen i grønlige nuancer, der glider over i
// gullig-creme nærmere siden, plus lidt tåge. Alt er tilfældigt pr. besøg.
// Ren tegnelogik uden React — komponenten ligger i components/HomeWaves.tsx.

export type Rgb = [number, number, number];

/** Pixels tegnet uden for synsfeltet, så sløringen ikke lyser op ved kanterne. */
export const WAVE_BLEED = 48;

export type WavePalette = {
  /** Farverampe oppefra (0) og ned (1): grøn → gul-grøn → gullig creme. */
  ramp: Array<{ at: number; color: Rgb }>;
  /** Dybere grøn til det bløde skær under hvert bånd. */
  deep: Rgb;
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
      { at: 0, color: mixRgb(muted, mint, 0.5) },
      { at: 0.26, color: mint },
      { at: 0.5, color: mixRgb(lime, cream, 0.6) },
      { at: 0.76, color: mixRgb(gold, cream, 0.55) },
      { at: 1, color: mixRgb(tan, cream, 0.5) },
    ],
    deep: mixRgb(brand, mint, 0.55),
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

export type WaveScene = { bundles: Bundle[]; fog: Fog[]; startTime: number };

export function createWaveScene(seed: number): WaveScene {
  const rand = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rand();
  const sign = () => (rand() < 0.5 ? -1 : 1);

  const bundleCount = 4 + Math.floor(rand() * 2);
  const bundles: Bundle[] = [];
  for (let i = 0; i < bundleCount; i++) {
    const direction = sign();
    const base: Component[] = [
      { wavelength: between(1.4, 2.2), phase: between(0, 6.28), speed: direction * between(4, 7), amplitude: between(0.05, 0.085) },
      { wavelength: between(0.65, 1.0), phase: between(0, 6.28), speed: direction * between(5, 9), amplitude: between(0.022, 0.04) },
      {
        wavelength: between(0.32, 0.5),
        phase: between(0, 6.28),
        speed: (rand() < 0.7 ? direction : -direction) * between(6, 11),
        amplitude: between(0.008, 0.016),
      },
    ];
    const strandCount = 3 + Math.floor(rand() * 3);
    const gap = between(9, 15);
    const strands: Strand[] = [];
    for (let s = 0; s < strandCount; s++) {
      strands.push({
        offset: (s - (strandCount - 1) / 2) * gap + between(-2.5, 2.5),
        width: between(5.5, 9),
        alpha: between(0.55, 0.85),
        tint: between(-0.1, 0.1),
        amplitudeScale: between(0.8, 1.2),
        components: base.map((c, j) => ({
          wavelength: c.wavelength * (1 + between(-0.04, 0.04)),
          phase: j === 2 ? between(0, 6.28) : c.phase + between(-1, 1) * (j === 0 ? 0.5 : 0.7),
          speed: c.speed * between(0.85, 1.15),
          amplitude: c.amplitude,
        })),
      });
    }
    bundles.push({
      y: 0.12 + (i + rand()) * (0.74 / bundleCount),
      driftAmplitude: between(8, 20),
      driftRate: (Math.PI * 2) / between(55, 100),
      driftPhase: between(0, 6.28),
      envelope: { wavelength: between(1.1, 1.8), phase: between(0, 6.28), speed: sign() * between(3, 6), amplitude: 0 },
      glowWidth: between(34, 52),
      glowAlpha: between(0.05, 0.08),
      strands,
    });
  }

  const fog: Fog[] = [];
  const fogCount = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < fogCount; i++) {
    fog.push({
      x: between(-0.05, 1.05),
      y: between(0.05, 0.8),
      swayX: between(0.06, 0.16),
      swayY: between(0.03, 0.08),
      rateX: (Math.PI * 2) / between(60, 140),
      rateY: (Math.PI * 2) / between(70, 150),
      phaseX: between(0, 6.28),
      phaseY: between(0, 6.28),
      radius: between(0.45, 0.85),
      squash: between(0.5, 0.8),
      tilt: between(-0.5, 0.5),
      alpha: between(0.1, 0.2),
    });
  }

  return { bundles, fog, startTime: between(0, 600) };
}

/** Højden på en streng i x ved tiden t (alt i CSS-pixels). */
function strandY(bundle: Bundle, strand: Strand, x: number, t: number, width: number, height: number) {
  const env = bundle.envelope;
  const envelope = 0.62 + 0.38 * Math.sin(((Math.PI * 2) / (env.wavelength * width)) * (x - env.speed * t) + env.phase);
  let wave = 0;
  for (const c of strand.components) {
    wave += c.amplitude * height * Math.sin(((Math.PI * 2) / (c.wavelength * width)) * (x - c.speed * t) + c.phase);
  }
  const drift = bundle.driftAmplitude * Math.sin(bundle.driftRate * t + bundle.driftPhase);
  return bundle.y * height + drift + strand.offset + wave * envelope * strand.amplitudeScale;
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
};

const STEP_TARGET = 7;

export function drawWaveScene(
  ctx: CanvasRenderingContext2D,
  scene: WaveScene,
  palette: WavePalette,
  frame: WaveFrame
) {
  const { t, width, height, scale } = frame;
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
    ctx.strokeStyle = rgba(mixRgb(palette.deep, rampAt(palette, bundle.y), 0.5), 1);
    ctx.globalAlpha = bundle.glowAlpha;
    ctx.lineWidth = bundle.glowWidth;
    ctx.stroke();

    for (const strand of bundle.strands) {
      for (let i = 0; i < count; i++) ys[i] = strandY(bundle, strand, x0 + i * step, t, width, height);
      tracePath(ctx, ys, count, x0, step);
      ctx.strokeStyle = rampGradient(strand.tint);
      // Tre lag oven på hinanden giver en blød kant uden hårde streger.
      const passes: Array<[number, number]> = [
        [3.4, 0.16],
        [1.9, 0.34],
        [1.0, 0.62],
      ];
      for (const [widthFactor, alphaFactor] of passes) {
        ctx.globalAlpha = strand.alpha * alphaFactor;
        ctx.lineWidth = strand.width * widthFactor;
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
}
