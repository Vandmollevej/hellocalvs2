"use client";

import { IconX } from "@tabler/icons-react";

/**
 * The black remove circle shown on items while a layout is being edited —
 * visually identical to the one on the footer menu's edit mode
 * (src/components/BottomNav.tsx). Positioned in the item's top-right corner;
 * the parent must be `relative`. Stops pointer events so pressing it never
 * starts a drag or ends edit mode.
 */
export function RemoveCircleButton({ ariaLabel, onRemove }: { ariaLabel: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      data-stat-action
      aria-label={ariaLabel}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-hf-black before:absolute before:-inset-2.5 before:content-['']"
    >
      <IconX size={13} stroke={2.2} color="var(--hf-tan)" />
    </button>
  );
}
