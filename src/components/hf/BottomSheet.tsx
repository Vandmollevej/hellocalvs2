"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Bundarket (KRAV.md "Bundark", docs/DECISIONS.md 2026-09-27): det faste
// vindue for alle screen-overlays/popups. Glider op nedefra, har trækstregen
// øverst (samme streg som kalenderens nat/dag-håndtag) og kan trækkes ned.
// Et hurtigt nedadgående swipe — eller et træk forbi 30 % af højden — lukker
// det; ellers glider det tilbage. Klik på scrim og Escape lukker også.
//
// Renderes betinget af forælderen ({open && <BottomSheet …/>}). Knapper inde
// i arket ("Spring over", "Luk") skal bruge useBottomSheetClose(), så de får
// samme glid-ud-animation som et træk, før forælderens onClose kaldes.

const CLOSE_MS = 280;
const START_DRAG_PX = 6;
const CLOSE_VELOCITY_PX_PER_MS = 0.5;
const CLOSE_FRACTION = 0.3;

const BottomSheetCloseContext = createContext<() => void>(() => {});

function stopPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

export function useBottomSheetClose() {
  return useContext(BottomSheetCloseContext);
}

/** Knap der lukker arket med glid-ud-animationen (fx "Spring over"); onClick køres først. */
export function BottomSheetCloseButton({
  onClick,
  className,
  children,
}: {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const close = useBottomSheetClose();
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        onClick?.();
        close();
      }}
    >
      {children}
    </button>
  );
}

/** Sideprikker til trin/slides i et bundark (aktiv = brand-grøn). */
export function BottomSheetDots({
  count,
  active,
  label,
  onSelect,
}: {
  count: number;
  active: number;
  label: string;
  onSelect?: (index: number) => void;
}) {
  return (
    <div className="hf-bottom-sheet__dots" role="img" aria-label={label}>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={`hf-bottom-sheet__dot ${index === active ? "hf-bottom-sheet__dot--active" : ""}`}
          onClick={onSelect ? () => onSelect(index) : undefined}
        />
      ))}
    </div>
  );
}

type DragState = {
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  active: boolean;
  fromHandle: boolean;
  /** Intet element mellem fingeren og arket er scrollet ned. */
  atTop: boolean;
};

function contentIsAtTop(target: EventTarget | null, panel: HTMLElement) {
  let node = target instanceof Element ? target : null;
  while (node && node !== panel) {
    if (node.scrollTop > 0) return false;
    node = node.parentElement;
  }
  return true;
}

export function BottomSheet({
  onClose,
  title,
  ariaLabel,
  footer,
  children,
  size = "auto",
  className = "",
  panelStyle,
}: {
  onClose: () => void;
  title?: React.ReactNode;
  /** Tilgængeligt navn, når arket ikke har en synlig titel. */
  ariaLabel?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** "full" = næsten hele skærmhøjden (som referencebilledet), "half" = halv skærmhøjde (vilkårsarket), "auto" = indholdets højde. */
  size?: "auto" | "half" | "full";
  className?: string;
  /** Fx en anden baggrund (guidens skærmfarve). */
  panelStyle?: React.CSSProperties;
}) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const offsetRef = useRef(0);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const [phase, setPhase] = useState<"enter" | "open" | "closing">("enter");
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setDragging(false);
    setPhase("closing");
    window.setTimeout(() => onCloseRef.current(), CLOSE_MS);
  }, []);

  // Første frame står arket under skærmkanten, næste frame glider det op.
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("open")));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Kun det øverste ark lukker, når ark ligger oven på hinanden (fx
      // vilkårsarket over startguiden).
      const sheets = document.querySelectorAll(".hf-bottom-sheet");
      if (sheets[sheets.length - 1] !== rootRef.current) return;
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Træk: touch på hele arket (indholdet kun når det er scrollet helt op),
  // mus kun på trækstregen. Non-passive touchmove, så et nedadgående træk i
  // toppen af indholdet flytter arket i stedet for at scrolle/overscrolle.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    function begin(y: number, target: EventTarget | null) {
      if (closingRef.current) return;
      dragRef.current = {
        startY: y,
        lastY: y,
        lastT: performance.now(),
        velocity: 0,
        active: false,
        fromHandle: Boolean(grabRef.current && target instanceof Node && grabRef.current.contains(target)),
        atTop: panel ? contentIsAtTop(target, panel) : true,
      };
    }

    function move(y: number, event: Event) {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = y - drag.startY;
      if (!drag.active) {
        if (dy > START_DRAG_PX && (drag.fromHandle || drag.atTop)) {
          drag.active = true;
          drag.startY = y;
          setPanelHeight(panel?.offsetHeight ?? 0);
          setDragging(true);
        } else if (Math.abs(dy) > START_DRAG_PX) {
          // Almindelig scroll i indholdet — slip trækket.
          dragRef.current = null;
          return;
        } else {
          return;
        }
      }
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      const dt = now - drag.lastT;
      if (dt > 0) drag.velocity = (y - drag.lastY) / dt;
      drag.lastY = y;
      drag.lastT = now;
      const next = Math.max(0, y - drag.startY);
      offsetRef.current = next;
      setOffset(next);
    }

    function end() {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag?.active) return;
      const height = panel?.offsetHeight ?? 1;
      const flicked = drag.velocity > CLOSE_VELOCITY_PX_PER_MS && offsetRef.current > START_DRAG_PX;
      if (flicked || offsetRef.current > height * CLOSE_FRACTION) {
        close();
      } else {
        setDragging(false);
        offsetRef.current = 0;
        setOffset(0);
      }
    }

    const onTouchStart = (event: TouchEvent) => begin(event.touches[0].clientY, event.target);
    const onTouchMove = (event: TouchEvent) => move(event.touches[0].clientY, event);
    const onMouseMove = (event: MouseEvent) => move(event.clientY, event);
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      end();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (!grabRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
      begin(event.clientY, event.target);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    panel.addEventListener("touchstart", onTouchStart, { passive: true });
    panel.addEventListener("touchmove", onTouchMove, { passive: false });
    panel.addEventListener("touchend", end);
    panel.addEventListener("touchcancel", end);
    panel.addEventListener("mousedown", onMouseDown);
    return () => {
      panel.removeEventListener("touchstart", onTouchStart);
      panel.removeEventListener("touchmove", onTouchMove);
      panel.removeEventListener("touchend", end);
      panel.removeEventListener("touchcancel", end);
      panel.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [close]);

  if (typeof document === "undefined") return null;

  const shown = phase === "open";
  const scrimOpacity = !shown ? 0 : panelHeight > 0 ? Math.max(0, 1 - offset / panelHeight) : 1;

  return createPortal(
    <BottomSheetCloseContext.Provider value={close}>
      {/* React-events bobler gennem portaler til forælderens komponenttræ
          (fx kalenderens swipe/zoom-håndtering) — stop dem ved arkets rod. */}
      <div
        ref={rootRef}
        className={`hf-bottom-sheet ${size === "auto" ? "" : `hf-bottom-sheet--${size}`} ${className}`}
        onClick={stopPropagation}
        onPointerDown={stopPropagation}
        onPointerMove={stopPropagation}
        onPointerUp={stopPropagation}
        onPointerCancel={stopPropagation}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
        onTouchMove={stopPropagation}
        onTouchEnd={stopPropagation}
        onWheel={stopPropagation}
        onKeyDown={stopPropagation}
      >
        <div className="hf-bottom-sheet__scrim" style={{ opacity: scrimOpacity }} onClick={close} aria-hidden="true" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel}
          className="hf-bottom-sheet__panel"
          style={{
            ...panelStyle,
            // I hvile: ingen transform, ellers bliver panelet containing block
            // for position:fixed-modaler inde i arket (fx tilsætningsstof-info).
            transform: !shown ? "translateY(100%)" : offset > 0 ? `translateY(${offset}px)` : "none",
            transition: dragging ? "none" : `transform ${CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
          }}
        >
          <div ref={grabRef} className="hf-bottom-sheet__grab" aria-hidden="true">
            <span className="hf-bottom-sheet__handle" />
          </div>
          {title && (
            <h2 id={titleId} className="hf-bottom-sheet__title hf-type-page-title">
              {title}
            </h2>
          )}
          <div ref={bodyRef} className="hf-bottom-sheet__body">
            {children}
          </div>
          {footer && <div className="hf-bottom-sheet__footer">{footer}</div>}
        </div>
      </div>
    </BottomSheetCloseContext.Provider>,
    document.body
  );
}
