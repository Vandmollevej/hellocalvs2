"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { IconCamera } from "@tabler/icons-react";

// Banner "Optjen 20 points ved at opdatere varen" som lag UDEN PÅ siden: det
// ligger over indholdet og skubber aldrig siden (brugerrettelse 2026-10-09).
// Trækstregen kan både minimere banneret (træk op / tryk) og trække en omvendt
// popup ned (træk ned) med et kamerafelt pr. manglende ting. Bruges kun når
// varen mangler indhold, energi eller produktbillede (src/lib/product-update.ts).
const DRAG_THRESHOLD_PX = 16;

type Stage = "collapsed" | "banner" | "panel";

export type UpdateTile = { kind: string; label: string };

export function UpdatePointsBanner({
  href,
  text,
  toggleLabel,
  tiles,
  action,
}: {
  href: string;
  text: string;
  toggleLabel: string;
  tiles: UpdateTile[];
  action?: React.ReactNode;
}) {
  const [stage, setStage] = useState<Stage>("banner");
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
    if (delta >= DRAG_THRESHOLD_PX) {
      setStage((current) => (current === "collapsed" ? "banner" : "panel"));
    } else if (delta <= -DRAG_THRESHOLD_PX) {
      setStage((current) => (current === "panel" ? "banner" : "collapsed"));
    } else {
      setStage((current) => (current === "banner" ? "collapsed" : current === "collapsed" ? "banner" : "banner"));
    }
  }

  const showBanner = stage !== "collapsed";
  const showPanel = stage === "panel";

  return (
    <div className="absolute inset-x-0 top-0 z-30 bg-hf-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
      {showBanner && (
        <Link
          href={href}
          className="hf-type-small hf-type-strong block px-4 pt-3 text-center text-hf-black"
        >
          {text}
        </Link>
      )}
      {showBanner && action && <div className="px-4 pt-2">{action}</div>}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: showPanel ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="flex justify-center gap-4 px-4 pt-3" inert={!showPanel}>
            {tiles.map((tile) => (
              <Link
                key={tile.kind}
                href={href}
                className="flex w-24 flex-col items-center gap-2 text-center"
              >
                <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-hf-cream text-hf-black">
                  <IconCamera size={32} aria-hidden="true" />
                </span>
                <span className="hf-type-small text-hf-black">{tile.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        aria-label={toggleLabel}
        aria-expanded={stage !== "collapsed"}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startY.current = null;
        }}
        className="flex h-5 w-full items-center justify-center touch-none"
      >
        <span aria-hidden="true" className="block h-1 w-10 rounded-full bg-hf-inactive" />
      </button>
    </div>
  );
}
