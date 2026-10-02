"use client";

import { useEffect, useRef } from "react";
import { createWaveScene, drawWaveScene, readWavePalette, WAVE_BLEED } from "@/lib/home-waves";

// Tre lag af samme scene: skarp øverst, mellem-sløret i midten og kraftigt
// sløret nederst (maskerne ligger i globals.css, .home-wave__layer--*) — det
// giver "frostet glas"-effekten nederst. Lavere opløsning på de sløret lag.
const LAYERS = [
  { key: "sharp", scale: 0.8 },
  { key: "mid", scale: 0.55 },
  { key: "heavy", scale: 0.4 },
] as const;

const FRAME_MS = 1000 / 30;

/**
 * Forsidens rolige bølge-baggrund (bruger 2026-10-01). Ligger bag topbar og
 * hero og fortsætter lidt ind under "Dagens tilføjelser"-stregen. Står stille
 * ved "reducer bevægelse", og standser når siden er skjult.
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

    function paint() {
      if (width === 0 || height === 0) return;
      LAYERS.forEach((layer, i) => {
        const ctx = contexts[i];
        if (ctx) drawWaveScene(ctx, scene, palette!, { t: clock, width, height, scale: layer.scale });
      });
    }

    function resize() {
      width = host!.clientWidth;
      height = host!.clientHeight;
      LAYERS.forEach((layer, i) => {
        const canvas = canvases[i];
        if (!canvas) return;
        canvas.width = Math.max(1, Math.round((width + WAVE_BLEED * 2) * layer.scale));
        canvas.height = Math.max(1, Math.round((height + WAVE_BLEED * 2) * layer.scale));
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
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    start();
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", sync);

    return () => {
      stop();
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
    </div>
  );
}
