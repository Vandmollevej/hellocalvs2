"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ElementSize = { width: number; height: number };

/**
 * Måler et elements størrelse (border-box) og følger med, når den ændrer sig.
 * Giv den returnerede callback-ref til elementet; størrelsen er null, indtil
 * elementet er målt (eller når det ikke findes).
 */
export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, ElementSize | null] {
  const [size, setSize] = useState<ElementSize | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) {
      setSize(null);
      return;
    }
    const measure = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observerRef.current = observer;
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, size];
}
