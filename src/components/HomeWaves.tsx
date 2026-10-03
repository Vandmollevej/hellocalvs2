"use client";

import { useEffect, useRef } from "react";
import { createWaveScene, DEFAULT_PULSE_BPM, drawWaveScene, readWavePalette, WAVE_BLEED } from "@/lib/home-waves";

// To lag af samme scene: skarpt øverst (i skærmens fulde opløsning, ingen
// blur) og sløret kun forneden (maskerne ligger i globals.css,
// .home-wave__layer--*) — bruger 2026-10-03: toppen må ikke være sløret.
const LAYERS = [
  { key: "sharp", scale: () => Math.min(2, window.devicePixelRatio || 1) },
  { key: "soft", scale: () => 0.4 },
] as const;

const FRAME_MS = 1000 / 30;
/** Integrationerne synkroniserer hvert 15. minut; ét opslag i minuttet er rigeligt. */
const HEART_RATE_POLL_MS = 60 * 1000;
/**
 * Puls-linjens grundlinje over tal-hjulets midte (bruger 2026-10-03: den må
 * ikke gå om bag det midterste tal). Halvdelen af tallets højde (~10 px) +
 * dykket efter R-takken (≤ 10 px) + stregens glød; under rækken ovenover.
 */
const PULSE_ABOVE_WHEEL_CENTER = 26;

/** Urets aktuelle puls, eller 60 bpm uden ur/frisk måling (bruger 2026-10-03). */
async function fetchPulseBpm() {
  try {
    const res = await fetch("/api/health-metrics/heart-rate", { cache: "no-store" });
    if (!res.ok) return DEFAULT_PULSE_BPM;
    const data = (await res.json()) as { heartRate?: { bpm?: number } | null };
    const bpm = data.heartRate?.bpm;
    return typeof bpm === "number" && Number.isFinite(bpm) ? bpm : DEFAULT_PULSE_BPM;
  } catch {
    return DEFAULT_PULSE_BPM;
  }
}

/**
 * Forsidens rolige bølge-baggrund (bruger 2026-10-01). Ligger bag topbar og
 * hero og fortsætter lidt ind under "Dagens tilføjelser"-stregen. Står stille
 * ved "reducer bevægelse", og standser når siden er skjult. Puls-linjen slår
 * i urets målte puls (60 bpm uden ur).
 */
export function HomeWaves() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvases = canvasRefs.current;
    const contexts = LAYERS.map((_, i) => canvases[i]?.getContext("2d") ?? null);
    const palette = readWavePalette(host);
    if (!palette || contexts.some((ctx) => !ctx)) return;

    const seedSource = new Uint32Array(1);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(seedSource);
    else seedSource[0] = Math.floor(Math.random() * 4294967296);
    const scene = createWaveScene(seedSource[0]);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let clock = scene.startTime;
    let last = 0;
    let raf = 0;
    let bpm = DEFAULT_PULSE_BPM;
    let pollTimer = 0;
    let polling = false;
    let disposed = false;
    let pulseY: number | undefined;

    let scales: number[] = LAYERS.map((layer) => layer.scale());

    function paint() {
      if (width === 0 || height === 0) return;
      LAYERS.forEach((_, i) => {
        const ctx = contexts[i];
        if (ctx) drawWaveScene(ctx, scene, palette!, { t: clock, width, height, scale: scales[i], bpm, pulseY });
      });
    }

    function resize() {
      width = host!.clientWidth;
      height = host!.clientHeight;
      scales = LAYERS.map((layer) => layer.scale());
      // Tal-hjulets boks er centreret om den midterste række.
      const wheel = host!.parentElement?.querySelector<HTMLElement>("[data-stats-wheel]");
      if (wheel) {
        const box = wheel.getBoundingClientRect();
        pulseY = box.top + box.height / 2 - host!.getBoundingClientRect().top - PULSE_ABOVE_WHEEL_CENTER;
      } else {
        pulseY = undefined;
      }
      LAYERS.forEach((_, i) => {
        const canvas = canvases[i];
        if (!canvas) return;
        canvas.width = Math.max(1, Math.round((width + WAVE_BLEED * 2) * scales[i]));
        canvas.height = Math.max(1, Math.round((height + WAVE_BLEED * 2) * scales[i]));
      });
      paint();
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      clock += Math.min(0.1, (now - last) / 1000);
      last = now;
      paint();
    }

    function start() {
      if (raf || motion.matches || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    function sync() {
      stop();
      start();
      // Tilbage på siden: hent pulsen med det samme.
      if (document.hidden) return;
      window.clearTimeout(pollTimer);
      pollTimer = 0;
      schedulePoll(0);
    }

    async function poll() {
      pollTimer = 0;
      polling = true;
      bpm = await fetchPulseBpm();
      polling = false;
      if (disposed) return;
      if (!raf) paint();
      schedulePoll();
    }

    function schedulePoll(delay = HEART_RATE_POLL_MS) {
      if (pollTimer || polling || document.hidden || disposed) return;
      pollTimer = window.setTimeout(poll, delay);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    start();
    schedulePoll(0);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);

    return () => {
      disposed = true;
      stop();
      window.clearTimeout(pollTimer);
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", sync);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="home-wave"
      style={{ "--home-wave-bleed": `${WAVE_BLEED}px` } as React.CSSProperties}
    >
      {LAYERS.map((layer, i) => (
        <div key={layer.key} className={`home-wave__layer home-wave__layer--${layer.key}`}>
          <canvas
            ref={(el) => {
              canvasRefs.current[i] = el;
            }}
          />
        </div>
      ))}
      <div className="home-wave__frost" />
    </div>
  );
}
