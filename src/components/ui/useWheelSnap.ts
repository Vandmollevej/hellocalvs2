"use client";

import { useEffect, useRef } from "react";

// Fælles scroll-håndtering for hjul-vælgerne (opgave 8, 2026-09-28).
// Tidligere læste hjulene positionen 120 ms efter sidste scroll-event, mens
// momentum/snap-animationen stadig kørte. Det gav et mellemtal, og
// BirthDatePicker skrev det straks tilbage til `scrollTop`, så hjulet hoppede
// eller landede tilfældigt. Nu venter vi på `scrollend` (med en længere
// debounce som fallback), og kalderen kan spørge `isScrolling()` før den
// selv flytter hjulet.
export function useWheelSnap(
  itemHeight: number,
  count: number,
  onSettle: (index: number) => void,
  // Sæt til false mens hjulet ikke er monteret (fx lukket ark), så
  // lytterne bindes igen når det åbnes.
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
    const supportsScrollEnd = "onscrollend" in window;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function settle() {
      if (!element) return;
      scrolling.current = false;
      const index = Math.round(element.scrollTop / itemHeight);
      onSettleRef.current(Math.max(0, Math.min(count - 1, index)));
    }

    function handleScroll() {
      scrolling.current = true;
      if (supportsScrollEnd) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(settle, 250);
    }

    element.addEventListener("scroll", handleScroll, { passive: true });
    if (supportsScrollEnd) element.addEventListener("scrollend", settle);
    return () => {
      if (timeout) clearTimeout(timeout);
      element.removeEventListener("scroll", handleScroll);
      element.removeEventListener("scrollend", settle);
    };
  }, [itemHeight, count, active]);

  return { scrollRef, isScrolling: () => scrolling.current };
}
