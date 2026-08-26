"use client";

import { useRef, useState } from "react";

const ACTION_WIDTH = 80;

export function SwipeableRow({
  onFavorite,
  onDelete,
  children,
}: {
  onFavorite?: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    dragging.current = true;
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    const minimum = onFavorite ? -ACTION_WIDTH : 0;
    const clamped = Math.max(minimum, Math.min(ACTION_WIDTH, delta));
    setDragX(clamped);
  }

  function handlePointerUp() {
    dragging.current = false;
    setIsDragging(false);
    startX.current = null;
    // Snap til åben/lukket i stedet for en tilfældig mellemposition.
    setDragX((x) => {
      if (onFavorite && x > ACTION_WIDTH / 2) return ACTION_WIDTH;
      if (x < -ACTION_WIDTH / 2) return -ACTION_WIDTH;
      return 0;
    });
  }

  return (
    <div className="relative overflow-hidden">
      {onFavorite && (
        <div className="absolute inset-y-0 left-0 flex w-20 items-center justify-center bg-hf-green">
          <button
            onClick={() => {
              onFavorite();
              setDragX(0);
            }}
            aria-label="Gem som favorit"
            className="text-xs font-bold text-hf-white"
          >
            Favorit
          </button>
        </div>
      )}
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-600">
        <button
          onClick={() => {
            onDelete();
            setDragX(0);
          }}
          aria-label="Slet"
          className="text-xs font-bold text-white"
        >
          Slet
        </button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative bg-hf-cream transition-transform"
        style={{
          transform: `translateX(${dragX}px)`,
          transitionDuration: isDragging ? "0ms" : "150ms",
        }}
      >
        {children}
      </div>
    </div>
  );
}
