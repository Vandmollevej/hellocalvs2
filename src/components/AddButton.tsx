"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconPlus,
  IconCamera,
  IconSearch,
  IconMicrophone,
  IconSoup,
  type Icon,
} from "@tabler/icons-react";
import { IconPlateCutlery } from "@/components/icons/PlateCutlery";

export const HERO_HEIGHT = 280;
const CENTER_Y = HERO_HEIGHT / 2;
const RADIUS = 92;
const CIRCLE = 46;

export const FAB_SIZE = 64;
const FAB_RADIUS = 14;
export const FAB_INSET = 18;
const DRAG_THRESHOLD = 6;

// Half circle backdrop behind the fanned-out actions, flush against the
// screen edge the FAB sits on.
const HALF_CIRCLE_RADIUS = 48;

// Minimum distance from the FAB center before a drag counts as "aiming at"
// an option, so a small wobble right after pressing down doesn't select
// anything.
const SELECT_DEAD_ZONE = 30;

const ANGLES_DEG = [-70, -35, 0, 35, 70];

export type FabSide = "left" | "right";

// The FAB is fixed to the left edge of the hero — it is no longer
// draggable to a custom position.
const SIDE: FabSide = "left";

const actions: { key: string; href: string; icon: Icon; label: string }[] = [
  { key: "maaltid", href: "/kamera?mode=maaltid", icon: IconPlateCutlery, label: "Måltid" },
  { key: "kamera", href: "/kamera?mode=produkt", icon: IconCamera, label: "Kamera" },
  { key: "soeg", href: "/soeg", icon: IconSearch, label: "Søg" },
  { key: "mikrofon", href: "/stemme", icon: IconMicrophone, label: "Mikrofon" },
  { key: "ret", href: "/opret-ret", icon: IconSoup, label: "Egne retter" },
];

function arcItemCenter(angleDeg: number, containerWidth: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const inward = RADIUS * Math.cos(rad);
  const fabCenterX = SIDE === "left" ? FAB_INSET + FAB_SIZE / 2 : containerWidth - FAB_INSET - FAB_SIZE / 2;
  const x = SIDE === "left" ? fabCenterX + inward : fabCenterX - inward;
  const y = CENTER_Y + RADIUS * Math.sin(rad);
  return { x, y };
}

function arcItemStyle(angleDeg: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180;
  const inward = RADIUS * Math.cos(rad) - CIRCLE / 2;
  const top = CENTER_Y + RADIUS * Math.sin(rad) - CIRCLE / 2;
  const horizontalInset = FAB_INSET + FAB_SIZE / 2 + inward;
  return SIDE === "left" ? { left: horizontalInset, top } : { right: horizontalInset, top };
}

export function AddButton({ onOpen }: { onOpen?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const selectingRef = useRef(false);
  const highlightedKeyRef = useRef<string | null>(null);
  const wasOpenOnPressRef = useRef(false);

  useEffect(() => () => document.body.classList.remove("select-none"), []);

  function startSelecting(pointerId: number, target: HTMLButtonElement) {
    selectingRef.current = true;
    document.body.classList.add("select-none");
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Ignore capture failures (e.g. pointer already released).
    }
  }

  function updateHighlight(event: React.PointerEvent<HTMLButtonElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;

    let nearestKey: string | null = null;
    let nearestDistance = Infinity;
    for (let i = 0; i < actions.length; i += 1) {
      const { x, y } = arcItemCenter(ANGLES_DEG[i], rect.width);
      const distance = Math.hypot(px - x, py - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestKey = actions[i].key;
      }
    }

    const fabCenterX = SIDE === "left" ? FAB_INSET + FAB_SIZE / 2 : rect.width - FAB_INSET - FAB_SIZE / 2;
    const fabCenterY = CENTER_Y;
    const distanceFromFab = Math.hypot(px - fabCenterX, py - fabCenterY);

    const next = distanceFromFab > SELECT_DEAD_ZONE ? nearestKey : null;
    highlightedKeyRef.current = next;
    setHighlightedKey(next);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    selectingRef.current = false;
    highlightedKeyRef.current = null;
    setHighlightedKey(null);
    wasOpenOnPressRef.current = open;

    if (open) {
      // Menu is already open: this press aims straight at picking an option.
      startSelecting(event.pointerId, event.currentTarget);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (pointerStart.current) {
      const dx = event.clientX - pointerStart.current.x;
      const dy = event.clientY - pointerStart.current.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) movedRef.current = true;
    }

    if (selectingRef.current) {
      updateHighlight(event);
      return;
    }

    // Moving before the menu is open means the user is aiming for an option
    // directly instead of just tapping — open the menu and start selecting.
    if (movedRef.current && !wasOpenOnPressRef.current && !open) {
      onOpen?.();
      setOpen(true);
      startSelecting(event.pointerId, event.currentTarget);
      updateHighlight(event);
    }
  }

  function endInteraction(event: React.PointerEvent<HTMLButtonElement>) {
    if (selectingRef.current) {
      selectingRef.current = false;
      document.body.classList.remove("select-none");
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
      const key = highlightedKeyRef.current;
      setHighlightedKey(null);
      pointerStart.current = null;
      if (key) {
        const action = actions.find((a) => a.key === key);
        setOpen(false);
        if (action) router.push(action.href);
        return true;
      }
      return true;
    }
    pointerStart.current = null;
    return false;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const handledBySelection = endInteraction(event);
    if (handledBySelection) return;
    if (!movedRef.current) {
      if (!open) onOpen?.();
      setOpen((v) => !v);
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      {open && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bg-hf-green transition-opacity duration-200"
          style={{
            [SIDE === "left" ? "left" : "right"]: 0,
            top: CENTER_Y - HALF_CIRCLE_RADIUS,
            width: HALF_CIRCLE_RADIUS,
            height: HALF_CIRCLE_RADIUS * 2,
            borderRadius:
              SIDE === "left"
                ? `0 ${HALF_CIRCLE_RADIUS * 2}px ${HALF_CIRCLE_RADIUS * 2}px 0`
                : `${HALF_CIRCLE_RADIUS * 2}px 0 0 ${HALF_CIRCLE_RADIUS * 2}px`,
            opacity: 0.92,
          } as React.CSSProperties}
        />
      )}

      <button
        aria-label={open ? "Luk tilføj-menu" : "Åbn tilføj-menu"}
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endInteraction}
        className="absolute z-10 flex items-center justify-center bg-transparent border-0 shadow-none"
        style={{
          [SIDE === "left" ? "left" : "right"]: FAB_INSET,
          top: CENTER_Y - FAB_SIZE / 2,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_RADIUS,
          touchAction: "none",
        } as React.CSSProperties}
      >
        <IconPlus size={26} color={open ? "var(--hf-white)" : "var(--hf-fab)"} stroke={2} />
      </button>

      {actions.map((action, i) => {
        const isHighlighted = highlightedKey === action.key;
        const Icon = action.icon;
        return (
          <Link
            key={action.key}
            href={action.href}
            aria-label={action.label}
            className="absolute flex items-center justify-center rounded-full bg-hf-tan transition-all duration-150"
            style={{
              ...arcItemStyle(ANGLES_DEG[i]),
              width: CIRCLE,
              height: CIRCLE,
              opacity: open ? 1 : 0,
              pointerEvents: open ? "auto" : "none",
              transform: open ? `scale(${isHighlighted ? 1.35 : 1})` : "scale(0.4)",
              backgroundColor: isHighlighted ? "var(--hf-green)" : undefined,
              boxShadow: isHighlighted ? "0 4px 14px rgba(0,0,0,0.25)" : undefined,
            }}
          >
            <Icon size={20} color={isHighlighted ? "var(--hf-white)" : "var(--hf-black)"} />
          </Link>
        );
      })}
    </div>
  );
}
