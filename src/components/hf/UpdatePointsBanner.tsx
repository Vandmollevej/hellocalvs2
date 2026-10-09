"use client";

import { useRef, useState } from "react";
import Link from "next/link";

// Hvidt banner øverst på varesiden: "Optjen 20 points ved at opdatere varen".
// Kan trækkes ned/skubbes op (eller trykkes på grebet), så kun den smalle
// bund-bar med grebet vises. Bruges kun når varen mangler indhold, energi,
// logo eller produktbillede (src/lib/product-update.ts).
const DRAG_THRESHOLD_PX = 16;

export function UpdatePointsBanner({
  href,
  text,
  toggleLabel,
  action,
}: {
  href: string;
  text: string;
  toggleLabel: string;
  action?: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const startY = useRef<number | null>(null);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const start = startY.current;
    startY.current = null;
    if (start === null) return;
    const delta = event.clientY - start;
    if (delta <= -DRAG_THRESHOLD_PX) setCollapsed(true);
    else if (delta >= DRAG_THRESHOLD_PX) setCollapsed(false);
    else setCollapsed((current) => !current);
  }

  return (
    <div className="sticky top-0 z-30 bg-hf-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: collapsed ? "0fr" : "1fr" }}
      >
        <div className="overflow-hidden">
          <Link
            href={href}
            tabIndex={collapsed ? -1 : 0}
            className="hf-type-small hf-type-strong flex items-center justify-center px-4 py-3 text-center text-hf-black"
          >
            {text}
          </Link>
          {action && <div className="px-4 pb-3">{action}</div>}
        </div>
      </div>
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startY.current = null;
        }}
        className="flex h-6 w-full items-center justify-center touch-none"
      >
        <span
          aria-hidden="true"
          className="block h-1 w-10 rounded-full bg-hf-inactive"
        />
      </button>
    </div>
  );
}
