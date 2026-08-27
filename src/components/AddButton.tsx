"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  IconPlus,
  IconToolsKitchen2,
  IconCamera,
  IconSearch,
  IconMicrophone,
} from "@tabler/icons-react";

export const HERO_HEIGHT = 280;
const CENTER_Y = HERO_HEIGHT / 2;
const RADIUS = 92;
const CIRCLE = 46;

export const FAB_SIZE = 64;
const FAB_RADIUS = 14;
export const FAB_INSET = 18;
const VERTICAL_RANGE = 70;
const LONG_PRESS_MS = 420;
const DRAG_THRESHOLD = 6;

const ANGLES_DEG = [-60, -20, 20, 60];

export type FabSide = "left" | "right";
export type FabPosition = { side: FabSide; offsetY: number };

const STORAGE_KEY = "hellocal.fabPosition";
const DEFAULT_POSITION: FabPosition = { side: "left", offsetY: 0 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readStoredPosition(): FabPosition {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POSITION;
    const parsed = JSON.parse(raw) as Partial<FabPosition>;
    const side: FabSide = parsed.side === "right" ? "right" : "left";
    const offsetY = clamp(Number(parsed.offsetY) || 0, -VERTICAL_RANGE, VERTICAL_RANGE);
    return { side, offsetY };
  } catch {
    return DEFAULT_POSITION;
  }
}

let cachedPosition: FabPosition | null = null;
const positionListeners = new Set<() => void>();

function getPositionSnapshot(): FabPosition {
  if (!cachedPosition) cachedPosition = readStoredPosition();
  return cachedPosition;
}

function getServerPositionSnapshot(): FabPosition {
  return DEFAULT_POSITION;
}

function subscribeToPosition(listener: () => void) {
  positionListeners.add(listener);
  return () => positionListeners.delete(listener);
}

function setStoredPosition(next: FabPosition) {
  cachedPosition = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Prototype: ignore storage failures (private browsing, quota, ...).
  }
  positionListeners.forEach((listener) => listener());
}

export function useFabPosition() {
  const position = useSyncExternalStore(
    subscribeToPosition,
    getPositionSnapshot,
    getServerPositionSnapshot,
  );
  return [position, setStoredPosition] as const;
}

const actions = [
  { key: "maaltid", href: "/kamera?mode=maaltid", icon: <IconToolsKitchen2 size={20} color="var(--hf-black)" />, label: "Måltid" },
  { key: "kamera", href: "/kamera?mode=produkt", icon: <IconCamera size={20} color="var(--hf-black)" />, label: "Kamera" },
  { key: "soeg", href: "/soeg", icon: <IconSearch size={20} color="var(--hf-black)" />, label: "Søg" },
  { key: "mikrofon", href: "/stemme", icon: <IconMicrophone size={20} color="var(--hf-black)" />, label: "Mikrofon" },
];

function arcItemStyle(angleDeg: number, side: FabSide, offsetY: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180;
  const inward = RADIUS * Math.cos(rad) - CIRCLE / 2;
  const top = CENTER_Y + offsetY + RADIUS * Math.sin(rad) - CIRCLE / 2;
  const horizontalInset = FAB_INSET + FAB_SIZE / 2 + inward;
  return side === "left" ? { left: horizontalInset, top } : { right: horizontalInset, top };
}

export function AddButton({
  position,
  onPositionChange,
  onOpen,
}: {
  position: FabPosition;
  onPositionChange: (position: FabPosition) => void;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragPreview, setDragPreview] = useState<FabPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const draggingRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => clearLongPressTimer, []);

  useEffect(() => {
    document.body.classList.toggle("select-none", dragging);
    return () => document.body.classList.remove("select-none");
  }, [dragging]);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    draggingRef.current = false;
    clearLongPressTimer();
    const pointerId = event.pointerId;
    const target = event.currentTarget;
    longPressTimer.current = window.setTimeout(() => {
      if (movedRef.current) return;
      draggingRef.current = true;
      setDragging(true);
      setDragPreview(position);
      try {
        target.setPointerCapture(pointerId);
      } catch {
        // Ignore capture failures (e.g. pointer already released).
      }
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (pointerStart.current) {
      const dx = event.clientX - pointerStart.current.x;
      const dy = event.clientY - pointerStart.current.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD) movedRef.current = true;
    }
    if (!draggingRef.current) {
      if (movedRef.current) clearLongPressTimer();
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const relX = event.clientX - rect.left;
    const side: FabSide = relX < rect.width / 2 ? "left" : "right";
    const offsetY = clamp(event.clientY - rect.top - CENTER_Y, -VERTICAL_RANGE, VERTICAL_RANGE);
    setDragPreview({ side, offsetY });
  }

  function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    clearLongPressTimer();
    if (draggingRef.current) {
      draggingRef.current = false;
      setDragging(false);
      if (dragPreview) onPositionChange(dragPreview);
      setDragPreview(null);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore release failures.
      }
    }
    pointerStart.current = null;
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const wasDragging = draggingRef.current;
    endDrag(event);
    if (!wasDragging && !movedRef.current) {
      if (!open) onOpen?.();
      setOpen((v) => !v);
    }
  }

  const activePosition = dragPreview ?? position;

  return (
    <div ref={containerRef} className="absolute inset-0">
      {dragging && dragPreview && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-dashed border-hf-gray opacity-60"
            style={{
              [position.side === "left" ? "left" : "right"]: FAB_INSET,
              top: CENTER_Y + position.offsetY - FAB_SIZE / 2,
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: FAB_RADIUS,
            } as React.CSSProperties}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-dashed border-hf-green bg-hf-green-light/30"
            style={{
              [dragPreview.side === "left" ? "left" : "right"]: FAB_INSET,
              top: CENTER_Y + dragPreview.offsetY - FAB_SIZE / 2,
              width: FAB_SIZE,
              height: FAB_SIZE,
              borderRadius: FAB_RADIUS,
            } as React.CSSProperties}
          />
        </>
      )}

      <button
        aria-label={open ? "Luk tilføj-menu" : "Åbn tilføj-menu"}
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endDrag}
        className={`absolute flex items-center justify-center bg-transparent border-0 shadow-none ${
          dragging ? "" : "transition-[left,right,top] duration-300 ease-out"
        }`}
        style={{
          [activePosition.side === "left" ? "left" : "right"]: FAB_INSET,
          top: CENTER_Y + activePosition.offsetY - FAB_SIZE / 2,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_RADIUS,
          opacity: dragging ? 0.4 : 1,
          touchAction: "none",
        } as React.CSSProperties}
      >
        <IconPlus size={26} color="var(--hf-fab)" stroke={2} />
      </button>

      {actions.map((action, i) => (
        <Link
          key={action.key}
          href={action.href}
          aria-label={action.label}
          className="absolute flex items-center justify-center rounded-full bg-hf-tan transition-all duration-200"
          style={{
            ...arcItemStyle(ANGLES_DEG[i], position.side, position.offsetY),
            width: CIRCLE,
            height: CIRCLE,
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transform: open ? "scale(1)" : "scale(0.4)",
          }}
        >
          {action.icon}
        </Link>
      ))}
    </div>
  );
}
