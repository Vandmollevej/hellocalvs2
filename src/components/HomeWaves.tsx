"use client";

import { useEffect, useRef } from "react";
import {
  createWaveScene,
  DEFAULT_PULSE_BPM,
  drawWaveScene,
  readWavePalette,
  WAVE_BLEED,
  type WaveVariant,
} from "@/lib/home-waves";

/**
 * Hero-bunden til "Dagens tilføjelser"-linjens midte: listens `pt-2` + halv
 * titellinje (samme 18 px som DIVIDER_BELOW_HERO i StatsWheel). Det øverste
 * lag rager så langt ned, så puls-linjen kan ligge mellem hjulets nederste tal
 * og overskriften (bruger 2026-10-03).
 */
const PULSE_BELOW_HERO = 18;
/**
 * Px fra pulsens grundlinje op til midten af hjulets nederste række. Slagets
 * laveste punkt ligger ca. 9 px under grundlinjen, og tallets top ca. 13 px
 * over rækkens midte, så bunden netop står oven over tallet.
 */
const PULSE_ABOVE_LAST_ROW = 25;

// Bruger 2026-10-03: skærmen har to felter. Det øverste (topbar + hero) har
// skarpe, tynde linjer i skærmens fulde opløsning; det nederste (listen med
// indtastningerne) har tykke, meget slørede bånd bag sig som frostet glas
// (sløret ligger i globals.css, .home-wave--frost).
const LAYERS: Record<
  WaveVariant,
  { scale: () => number; strandWidthScale: number; strandAlphaScale: number; below: number }
> = {
  top: { scale: () => Math.min(2, window.devicePixelRatio || 1), strandWidthScale: 1, strandAlphaScale: 1, below: PULSE_BELOW_HERO },
  frost: { scale: () => 0.35, strandWidthScale: 6, strandAlphaScale: 1, below: 0 },
};

const FRAME_MS = 1000 / 30;
/** Integrationerne synkroniserer hvert 15. minut; ét opslag i minuttet er rigeligt. */
const HEART_RATE_POLL_MS = 60 * 1000;

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
 * Forsidens rolige bølge-baggrund (bruger 2026-10-01). `top` ligger bag
 * topbar og hero; `frost` ligger bag listen med indtastningerne (bruger
 * 2026-10-03). Står stille ved "reducer bevægelse", og standser når siden er
 * skjult. Puls-linjen (kun `top`) slår i urets målte puls (60 bpm uden ur).
 */
export function HomeWaves({ variant = "top" }: { variant?: WaveVariant }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const ctx = canvasRef.current?.getContext("2d") ?? null;
    const layer = LAYERS[variant];
    if (!host || !ctx) return;
    const palette = readWavePalette(host, variant);
    if (!palette) return;

    const seedSource = new Uint32Array(1);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(seedSource);
    else seedSource[0] = Math.floor(Math.random() * 4294967296);
    // Bølgerne i baggrunden er fjernet (bruger 2026-10-05); kun puls-linjen tegnes.
    const scene = { ...createWaveScene(seedSource[0], variant), bundles: [], fog: [] };

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

    let scale = layer.scale();

    function paint() {
      if (width === 0 || height === 0) return;
      drawWaveScene(ctx!, scene, palette!, {
        t: clock,
        width,
        height,
        scale,
        bpm,
        pulseY,
        strandWidthScale: layer.strandWidthScale,
        strandAlphaScale: layer.strandAlphaScale,
        // Som før: strengene toner ud over de nederste 12 % af hero.
        ...(layer.below > 0 ? { fadeFrom: height * 0.88, fadeTo: height } : {}),
      });
    }

    function resize() {
      width = host!.clientWidth;
      height = host!.clientHeight - layer.below;
      scale = layer.scale();
      // Pulsens bund ligger lige over hjulets nederste tal (bruger 2026-10-05).
      // Hjulets boks er centreret om den midterste række.
      const wheel = host!.parentElement?.querySelector<HTMLElement>("[data-stats-wheel]");
      const lastRow = Number(wheel?.dataset.statsWheelLastRow);
      if (wheel && Number.isFinite(lastRow)) {
        const box = wheel.getBoundingClientRect();
        const lastRowY = box.top + box.height / 2 - host!.getBoundingClientRect().top + lastRow;
        pulseY = lastRowY - PULSE_ABOVE_LAST_ROW;
      } else {
        pulseY = undefined;
      }
      ctx!.canvas.width = Math.max(1, Math.round((width + WAVE_BLEED * 2) * scale));
      ctx!.canvas.height = Math.max(1, Math.round((height + layer.below + WAVE_BLEED * 2) * scale));
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
      // Kun det øverste felt har puls-linjen.
      if (!scene.pulse || pollTimer || polling || document.hidden || disposed) return;
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
  }, [variant]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`home-wave home-wave--${variant}`}
      style={{ "--home-wave-bleed": `${WAVE_BLEED}px`, "--home-wave-below": `${LAYERS[variant].below}px` } as React.CSSProperties}
    >
      <canvas ref={canvasRef} />
      {variant === "frost" && <div className="home-wave__frost" />}
    </div>
  );
}
