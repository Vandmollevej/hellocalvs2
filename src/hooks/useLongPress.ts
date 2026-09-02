import { useRef } from "react";

// Shared hold-and-move pattern: fires onLongPress after holdMs, but only if
// the pointer hasn't moved more than moveTolerancePx in the meantime.
// This pattern previously existed as 7 separate hand-written copies across
// AddButton.tsx/BottomNav.tsx/StatCardsGrid.tsx/calendar/page.tsx (see
// docs/DECISIONS.md) — new gestures should use this hook instead of yet
// another copy. The existing 7 copies have not been migrated to use it
// (out of scope for this change).
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
