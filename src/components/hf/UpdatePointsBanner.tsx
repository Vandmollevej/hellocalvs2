"use client";

import { useEffect, useRef, useState } from "react";

// Banner "Optjen 20 points ved at opdatere varen" som lag UDEN PÅ siden: det
// ligger over indholdet og skubber aldrig siden (brugerrettelse 2026-10-09).
// z-40: over varesidens favoritikon (z-30), som aldrig må stå oven på
// dropdownen (brugerens regel 2026-10-15).
// Trækstregen kan både minimere banneret (træk op / tryk) og trække en omvendt
// popup ned (træk ned eller tryk på teksten) med kameraet. Bruges kun når
// varen mangler indhold, energi eller produktbillede (src/lib/product-update.ts).
// Den lukkede stribe er KUN teksten — kameraet (og alle andre fotoknapper)
// står først, når banneret er trukket ned (brugerens regel 2026-10-15). Den
// nedtrukne del viser hele kamerasøgeren direkte i dropdownen, aldrig en ny
// side (brugerens regel 2026-10-15, `panel`).
// Scrolles siden nedad, foldes banneret sammen til stregen; når siden igen
// rammer toppen, folder det sig ud til det, det var (brugerens regel
// 2026-10-15). Har brugeren selv foldet det sammen, bliver det sådan.
// Teksten og fotoboksene glider op og ned (brugerens regel 2026-10-15: ikke
// smække ud og ind).
const DRAG_THRESHOLD_PX = 16;
// Så langt nede skal siden være, før banneret foldes sammen.
const SCROLL_COLLAPSE_PX = 24;

type Stage = "collapsed" | "banner" | "panel";

export function UpdatePointsBanner({
  text,
  toggleLabel,
  panel,
}: {
  text: string;
  toggleLabel: string;
  /** Indholdet i den nedtrukne del; får at vide, om den er trukket ned. */
  panel: (open: boolean) => React.ReactNode;
}) {
  const [stage, setStage] = useState<Stage>("banner");
  const startY = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Det, banneret var, før scroll foldede det sammen — null, når det ikke er
  // scroll, der har foldet det sammen.
  const restoreTo = useRef<Stage | null>(null);

  useEffect(() => {
    const lastTop = new WeakMap<object, number>();
    function onScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && rootRef.current?.contains(target)) return;
      const element = target instanceof Element ? target : null;
      const top = element ? element.scrollTop : window.scrollY;
      const key = element ?? window;
      const previous = lastTop.get(key) ?? 0;
      lastTop.set(key, top);
      // Vandrette scroll (karruseller) ændrer ikke scrollTop.
      if (top === previous) return;
      if (top > previous && top > SCROLL_COLLAPSE_PX) {
        setStage((current) => {
          if (current !== "collapsed") restoreTo.current = current;
          return "collapsed";
        });
      } else if (top <= 0 && restoreTo.current) {
        const next = restoreTo.current;
        restoreTo.current = null;
        setStage(next);
      }
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const start = startY.current;
    startY.current = null;
    if (start === null) return;
    const delta = event.clientY - start;
    // Brugerens eget valg vinder over scroll.
    restoreTo.current = null;
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
    <div ref={rootRef} className="absolute inset-x-0 top-0 z-40 max-h-full overflow-y-auto rounded-b-2xl bg-hf-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: showBanner ? "1fr" : "0fr", opacity: showBanner ? 1 : 0 }}
      >
        <div className="overflow-hidden" inert={!showBanner}>
          <button
            type="button"
            onClick={() => {
              restoreTo.current = null;
              setStage("panel");
            }}
            className="hf-type-small hf-type-strong block w-full px-4 pt-3 text-center text-hf-black"
          >
            {text}
          </button>
        </div>
      </div>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out motion-reduce:transition-none"
        style={{ gridTemplateRows: showPanel ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div inert={!showPanel}>{panel(showPanel)}</div>
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
