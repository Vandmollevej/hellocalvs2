"use client";

import { useEffect, useRef } from "react";

const WAVEFORM_BAR_COUNT = 28;

function audioContextConstructor() {
  const w = window as typeof window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return w.AudioContext ?? w.webkitAudioContext;
}

/**
 * Lydbølgen under mikrofonen, mens der lyttes (fra den gamle Tale-side, sat
 * tilbage på Madvarer 2026-10-16 efter brugerens krav). Ren pynt: mikrofonens
 * niveau måles separat fra talegenkendelsen, og fejl her ignoreres.
 */
export function LiveWaveform({ active }: { active: boolean }) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let rafId: number | null = null;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;

    function draw(analyser: AnalyserNode) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const t = performance.now() / 1000;
      const bars = barRefs.current;
      for (let i = 0; i < bars.length; i += 1) {
        const bar = bars[i];
        if (!bar) continue;
        const amplitude = data[Math.floor((i / bars.length) * data.length)] / 255;
        const idle = 0.05 + 0.03 * Math.sin(t * 3 + i * 0.6);
        bar.style.height = `${Math.max(6, Math.min(1, idle + amplitude * 0.9) * 100)}%`;
      }
      rafId = requestAnimationFrame(() => draw(analyser));
    }

    async function start() {
      try {
        const Ctor = audioContextConstructor();
        if (!Ctor || !navigator.mediaDevices?.getUserMedia) return;
        const media = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        ctx = new Ctor();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.6;
        ctx.createMediaStreamSource(media).connect(analyser);
        rafId = requestAnimationFrame(() => draw(analyser));
      } catch {
        // Kun pynt — talegenkendelsen kører uafhængigt af lydbølgen.
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      stream?.getTracks().forEach((track) => track.stop());
      ctx?.close().catch(() => {});
    };
  }, [active]);

  if (!active) return null;
  return (
    <div className="mt-4 flex h-8 w-full max-w-[280px] items-end gap-[3px]" aria-hidden="true">
      {Array.from({ length: WAVEFORM_BAR_COUNT }).map((_, index) => (
        <div
          key={index}
          ref={(element) => {
            barRefs.current[index] = element;
          }}
          className="hf-waveform-bar"
        />
      ))}
    </div>
  );
}
