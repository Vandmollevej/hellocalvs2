import { useRef } from "react";

// Delt hold-og-flyt-mønster: fyrer onLongPress efter holdMs, men kun hvis
// pointeren ikke har bevæget sig mere end moveTolerancePx i mellemtiden.
// Dette mønster fandtes tidligere som 7 separate håndskrevne kopier på tværs
// af AddButton.tsx/BottomNav.tsx/StatCardsGrid.tsx/kalender/page.tsx (se
// docs/DECISIONS.md) — nye gestures bør bruge denne hook i stedet for endnu
// en kopi. De eksisterende 7 kopier er ikke rettet til at bruge den (uden for
// scope for denne ændring).
export function useLongPress({
  onLongPress,
  holdMs = 500,
  moveTolerancePx = 10,
}: {
  onLongPress: () => void;
  holdMs?: number;
  moveTolerancePx?: number;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });

  function clear() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onPointerDown(event: React.PointerEvent) {
    moved.current = false;
    start.current = { x: event.clientX, y: event.clientY };
    timer.current = setTimeout(() => {
      if (!moved.current) onLongPress();
    }, holdMs);
  }

  function onPointerMove(event: React.PointerEvent) {
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (Math.hypot(dx, dy) > moveTolerancePx) {
      moved.current = true;
      clear();
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerCancel: clear,
    cancel: clear,
  };
}
