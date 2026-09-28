"use client";

import { useCallback, useEffect, useRef } from "react";

// Shared settle detection for the scroll-snap wheels (item 8, 2026-09-28).
// Previously each wheel committed 120 ms after the last scroll event. On
// iOS/Android the momentum phase can pause scroll events for longer than
// that, so a value was committed mid-fling; the re-render then realigned
// scrollTop programmatically, which killed the momentum and snapped the
// wheel to a seemingly random number. Now a value is only committed once
// the scroll has truly stopped on a snap point (`scrollend` where
// supported, otherwise a timer that waits for an aligned, unchanged
// position), and callers can check `isScrolling()` before moving the wheel.
export function useWheelSnap(
  itemHeight: number,
  onSettle: (index: number) => void,
  active = true,
) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrolling = useRef(false);
  const onSettleRef = useRef(onSettle);

  useEffect(() => {
    onSettleRef.current = onSettle;
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!active || !element) return;
    const el = element;
    const supportsScrollEnd = "onscrollend" in window;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastTop: number | null = null;

    function settle() {
      scrolling.current = false;
      lastTop = null;
      onSettleRef.current(Math.round(el.scrollTop / itemHeight));
    }

    function check() {
      const top = el.scrollTop;
      const offset = top % itemHeight;
      const aligned = offset < 1 || itemHeight - offset < 1;
      if (aligned && lastTop === top) {
        settle();
        return;
      }
      lastTop = top;
      timer = setTimeout(check, 100);
    }

    function handleScroll() {
      scrolling.current = true;
      if (supportsScrollEnd) return;
      if (timer) clearTimeout(timer);
      lastTop = null;
      timer = setTimeout(check, 150);
    }

    el.addEventListener("scroll", handleScroll, { passive: true });
    if (supportsScrollEnd) el.addEventListener("scrollend", settle);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      if (supportsScrollEnd) el.removeEventListener("scrollend", settle);
      if (timer) clearTimeout(timer);
    };
  }, [active, itemHeight]);

  const isScrolling = useCallback(() => scrolling.current, []);

  return { scrollRef, isScrolling };
}
