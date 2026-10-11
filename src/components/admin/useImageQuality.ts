"use client";

import { useEffect, useState } from "react";
import { imageFormat, type ImageQuality } from "@/lib/image-quality";

// Måler billeder i browseren til "Anbefalet" (src/lib/image-quality.ts):
// opløsning og gennemsnitlig mætning på en 64 × 64-udgave. Hver URL måles én
// gang pr. sideindlæsning.

const SAMPLE = 64;
const cache = new Map<string, Promise<ImageQuality>>();

function saturationOf(img: HTMLImageElement): number | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE;
    canvas.height = SAMPLE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
    const data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      // Hvid baggrund tæller ikke med.
      if (min > 235) continue;
      sum += max === 0 ? 0 : (max - min) / max;
      count++;
    }
    return count > 0 ? sum / count : null;
  } catch {
    // Billede fra et andet domæne: pixels kan ikke læses.
    return null;
  }
}

function measure(url: string): Promise<ImageQuality> {
  let pending = cache.get(url);
  if (!pending) {
    pending = new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve({
          ok: true,
          width: img.naturalWidth,
          height: img.naturalHeight,
          format: imageFormat(url),
          saturation: saturationOf(img),
        });
      img.onerror = () => resolve({ ok: false, width: 0, height: 0, format: imageFormat(url), saturation: null });
      img.src = url;
    });
    cache.set(url, pending);
  }
  return pending;
}

export function useImageQuality(urls: string[]) {
  const [results, setResults] = useState<Record<string, ImageQuality>>({});
  const key = [...new Set(urls)].join("\n");

  useEffect(() => {
    let cancelled = false;
    for (const url of key.split("\n").filter(Boolean)) {
      void measure(url).then((quality) => {
        if (!cancelled) setResults((prev) => (prev[url] ? prev : { ...prev, [url]: quality }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  return results;
}
