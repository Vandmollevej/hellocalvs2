"use client";

import { useEffect, useRef } from "react";

// Face ID-animationen (efter brugerens reference-GIF):
// "scanning": hjørne-rammer med et ansigt, der kigger fra side til side.
// "success":  rammerne lukker sig til en cirkel → ansigtet toner ud → ringen
//             snurrer → et flueben tegnes. Kalder onDone, når den er færdig.
// "failed":   rammerne ryster kort og vender tilbage til ro.
export type FaceIdPhase = "idle" | "scanning" | "success" | "failed";

const COLOR = "#0A7AFF";
const SPIN_COLOR = "#35C4D4";

// Firkanten 10..90 i viewBox 0 0 100 100.
const SIZE = 80;
const BRACKET_RADIUS = 18;
const BRACKET_ARM = 10;
const CHECK_LENGTH = 50;

// Succes-tidslinje (ms).
const MORPH_END = 260;
const FACE_FADE_START = 480;
const FACE_FADE_END = 720;
const SPIN_START = 700;
const SPIN_END = 1180;
const CHECK_START = 1180;
const CHECK_END = 1460;
const SUCCESS_DONE = 1800;
const SHAKE_MS = 420;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const progress = (t: number, from: number, to: number) => clamp01((t - from) / (to - from));
const easeInOut = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);
const mix = (a: number, b: number, v: number) => a + (b - a) * v;

function mixColor(a: string, b: string, v: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((c, i) => Math.round(mix(c, pb[i], v))).join(",")})`;
}

// Rammen er én <rect>, hvis stiplede kant giver fire hjørner. m = 0 er
// hjørne-rammer, m = 1 er en hel cirkel.
function frameAttrs(m: number) {
  const radius = mix(BRACKET_RADIUS, SIZE / 2, m);
  const side = SIZE - 2 * radius;
  const arc = (Math.PI / 2) * radius;
  const arm = mix(BRACKET_ARM, side / 2, m);
  const gap = Math.max(0, side - 2 * arm);
  return { rx: radius, dasharray: `${2 * arm + arc} ${gap}`, dashoffset: arm + arc };
}

export function FaceIdAnimation({
  phase,
  size = 96,
  onDone,
}: {
  phase: FaceIdPhase;
  size?: number;
  onDone?: () => void;
}) {
  const frameRef = useRef<SVGRectElement>(null);
  const ringRef = useRef<SVGGElement>(null);
  const faceRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const noseRef = useRef<SVGPathElement>(null);
  const mouthRef = useRef<SVGPathElement>(null);
  const checkRef = useRef<SVGPathElement>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const frame = frameRef.current;
    const ring = ringRef.current;
    const face = faceRef.current;
    const eyes = eyesRef.current;
    const nose = noseRef.current;
    const mouth = mouthRef.current;
    const check = checkRef.current;
    if (!frame || !ring || !face || !eyes || !nose || !mouth || !check) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function draw(opts: {
      morph: number;
      look: number;
      faceOpacity: number;
      spin: number;
      spinColor: number;
      check: number;
      shakeX: number;
    }) {
      const f = frameAttrs(opts.morph);
      frame!.setAttribute("rx", String(f.rx));
      frame!.setAttribute("stroke-dasharray", f.dasharray);
      frame!.setAttribute("stroke-dashoffset", String(f.dashoffset));
      frame!.setAttribute("stroke", mixColor(COLOR, SPIN_COLOR, opts.spinColor));

      // Ringen "snurrer" om en skrå akse: skaleres i den ene retning.
      const squash = Math.max(0.08, Math.abs(Math.cos(opts.spin)));
      ring!.setAttribute(
        "transform",
        `translate(${50 + opts.shakeX} 50) rotate(-35) scale(${squash} 1) rotate(35) translate(-50 -50)`
      );

      // Ansigtet drejer: øjne og næse flytter mere end munden (dybde).
      face!.setAttribute("opacity", String(opts.faceOpacity));
      face!.setAttribute("transform", `translate(${opts.shakeX} 0)`);
      eyes!.setAttribute("transform", `translate(${opts.look * 5} 0)`);
      nose!.setAttribute("transform", `translate(${opts.look * 6} 0)`);
      mouth!.setAttribute("transform", `translate(${opts.look * 3} 0)`);

      check!.setAttribute("stroke-dashoffset", String(CHECK_LENGTH * (1 - opts.check)));
    }

    const rest = { morph: 0, look: 0, faceOpacity: 1, spin: 0, spinColor: 0, check: 0, shakeX: 0 };

    if (phase === "idle") {
      draw(rest);
      return;
    }

    if (phase === "success" && reduceMotion) {
      draw({ ...rest, morph: 1, faceOpacity: 0, check: 1 });
      const timer = window.setTimeout(() => onDoneRef.current?.(), 600);
      return () => window.clearTimeout(timer);
    }

    let raf = 0;
    const start = performance.now();
    let finished = false;

    function tick(now: number) {
      const t = now - start;

      if (phase === "scanning") {
        // Kig venstre → højre i en blød løkke.
        const look = reduceMotion ? 0 : Math.sin((t / 1400) * Math.PI * 2);
        draw({ ...rest, look });
      } else if (phase === "failed") {
        const p = progress(t, 0, SHAKE_MS);
        const shakeX = Math.sin(p * Math.PI * 6) * 6 * (1 - p);
        draw({ ...rest, shakeX });
        if (p >= 1) return;
      } else if (phase === "success") {
        const morph = easeInOut(progress(t, 0, MORPH_END));
        const faceOpacity = 1 - progress(t, FACE_FADE_START, FACE_FADE_END);
        const spinP = progress(t, SPIN_START, SPIN_END);
        const spin = easeInOut(spinP) * Math.PI * 2;
        const spinColor = Math.sin(spinP * Math.PI);
        const checkP = easeInOut(progress(t, CHECK_START, CHECK_END));
        draw({ ...rest, morph, faceOpacity, spin, spinColor, check: checkP });
        if (t >= SUCCESS_DONE && !finished) {
          finished = true;
          onDoneRef.current?.();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const initial = frameAttrs(0);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      role="img"
      aria-label="Face ID"
      style={{ overflow: "visible" }}
    >
      <g ref={ringRef}>
        <rect
          ref={frameRef}
          x="10"
          y="10"
          width={SIZE}
          height={SIZE}
          rx={initial.rx}
          stroke={COLOR}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={initial.dasharray}
          strokeDashoffset={initial.dashoffset}
        />
      </g>
      <g ref={faceRef} stroke={COLOR} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <g ref={eyesRef}>
          <path d="M36 37v7" />
          <path d="M64 37v7" />
        </g>
        <path ref={noseRef} d="M51 38v13h-4" />
        <path ref={mouthRef} d="M38 63c7 6 17 6 24 0" />
      </g>
      <path
        ref={checkRef}
        d="M33 51l12 12 22-24"
        stroke={COLOR}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={CHECK_LENGTH}
        strokeDashoffset={CHECK_LENGTH}
      />
    </svg>
  );
}
