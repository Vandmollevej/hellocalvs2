"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  IconPlus,
  IconCamera,
  IconSearch,
  IconMicrophone,
  type Icon,
} from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

export const HERO_HEIGHT = 300;
const CENTER_Y = HERO_HEIGHT / 2;
const CIRCLE = 46;

export const FAB_SIZE = 64;
const FAB_RADIUS = 14;
export const FAB_INSET = 18;
const DRAG_THRESHOLD = 6;

// Joystick backdrop behind the fanned-out actions, flush against the
// screen edge the FAB sits on. Always visible (not just while open) and
// large enough that a thumb can comfortably roam inside it. 15% bigger
// than the original 72px radius.
const HALF_CIRCLE_RADIUS = 83;

// The action arc is centered on the same point as the backdrop semicircle
// (the screen edge, not the FAB button), so every icon sits the same
// distance from the backdrop's curved edge. Icons sit just outside the
// backdrop, never inside it.
const ARC_GAP = 8;
const RADIUS = HALF_CIRCLE_RADIUS + ARC_GAP + CIRCLE / 2;

// Minimum distance from the FAB center before a drag counts as "aiming at"
// an option, so a small wobble right after pressing down doesn't select
// anything. Kept small so the whole joystick circle is "live" — the user
// shouldn't have to drag all the way out to an icon to register a choice.
const SELECT_DEAD_ZONE = 14;

// Fejlretninger/FEJLLISTE.md #30: the plus sits in its own light circle that
// follows the finger while dragging (clamped so it never leaves the green
// backdrop), and the backdrop's own edge bulges outward toward the drag
// direction — like the light circle is physically pressing into it.
const LIGHT_CIRCLE_SIZE = 40;
const LIGHT_CIRCLE_TRAVEL = HALF_CIRCLE_RADIUS - LIGHT_CIRCLE_SIZE / 2 - 6;
const BULGE_MAX = 20;
// How tightly the bulge concentrates around the drag angle (in degrees) —
// smaller spread = a narrower, more pronounced single bump; larger = a
// broader, softer push.
const BULGE_SPREAD_DEG = 46;
const BULGE_SAMPLE_COUNT = 40;

function backdropPath(bulgeAngleDeg: number | null, bulgeAmount: number) {
  const points: [number, number][] = [];
  for (let i = 0; i <= BULGE_SAMPLE_COUNT; i += 1) {
    const angleDeg = -90 + (180 * i) / BULGE_SAMPLE_COUNT;
    const angleRad = (angleDeg * Math.PI) / 180;
    let radius = HALF_CIRCLE_RADIUS;
    if (bulgeAngleDeg !== null && bulgeAmount > 0) {
      let diff = Math.abs(angleDeg - bulgeAngleDeg);
      if (diff > 180) diff = 360 - diff;
      const falloff = Math.max(0, Math.cos((diff / BULGE_SPREAD_DEG) * (Math.PI / 2)));
      radius += bulgeAmount * Math.max(0, falloff) ** 2;
    }
    const x = radius * Math.cos(angleRad);
    const y = HALF_CIRCLE_RADIUS + radius * Math.sin(angleRad);
    points.push([x, y]);
  }
  const commands = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${commands.join(" ")} L0,${HALF_CIRCLE_RADIUS * 2} L0,0 Z`;
}

// Top to bottom: microphone, pot (own dishes), search, plate (meal), camera (product).
const ANGLES_DEG = [-70, -35, 0, 35, 70];

export type FabSide = "left" | "right";

// The FAB is fixed to the left edge of the hero — it is no longer
// draggable to a custom position.
const SIDE: FabSide = "left";

type Action = {
  key: string;
  href: string;
  label: string;
  icon?: Icon;
  imageSrc?: string;
};

function buildActions(t: (key: string) => string): Action[] {
  return [
    { key: "microphone", href: "/voice", icon: IconMicrophone, label: t("addButton.microphone") },
    { key: "dish", href: "/create-dish", imageSrc: "/icons/pot.png", label: t("addButton.ownDishes") },
    { key: "search", href: "/search", icon: IconSearch, label: t("addButton.search") },
    { key: "meal", href: "/camera?mode=meal", imageSrc: "/icons/plate-camera.png", label: t("addButton.meal") },
    { key: "camera", href: "/camera?mode=product", icon: IconCamera, label: t("addButton.camera") },
  ];
}

// Both functions place icons on an arc centered at the screen edge — the
// same center the backdrop semicircle uses — so every icon ends up exactly
// RADIUS away from that center, i.e. the same margin from the curved edge.
function arcItemCenter(angleDeg: number, containerWidth: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const reach = RADIUS * Math.cos(rad);
  const x = SIDE === "left" ? reach : containerWidth - reach;
  const y = CENTER_Y + RADIUS * Math.sin(rad);
  return { x, y };
}

function arcItemStyle(angleDeg: number): React.CSSProperties {
  const rad = (angleDeg * Math.PI) / 180;
  const reach = RADIUS * Math.cos(rad) - CIRCLE / 2;
  const top = CENTER_Y + RADIUS * Math.sin(rad) - CIRCLE / 2;
  return SIDE === "left" ? { left: reach, top } : { right: reach, top };
}

export function AddButton({ onOpen }: { onOpen?: () => void }) {
  const { t } = useTranslation();
  const actions = buildActions(t);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
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
    const dx = px - fabCenterX;
    const dy = py - fabCenterY;
    const distanceFromFab = Math.hypot(dx, dy);

    const next = distanceFromFab > SELECT_DEAD_ZONE ? nearestKey : null;
    highlightedKeyRef.current = next;
    setHighlightedKey(next);

    // Clamp the light circle's travel to stay inside the green backdrop —
    // it follows the finger's direction but never actually leaves the shape.
    const clampedDistance = Math.min(distanceFromFab, LIGHT_CIRCLE_TRAVEL);
    const angle = Math.atan2(dy, dx);
    setDragOffset({
      x: Math.cos(angle) * clampedDistance,
      y: Math.sin(angle) * clampedDistance,
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    selectingRef.current = false;
    highlightedKeyRef.current = null;
    setHighlightedKey(null);
    setDragOffset(null);
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
      setDragOffset(null);
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

  const dragAngleDeg = dragOffset ? (Math.atan2(dragOffset.y, dragOffset.x) * 180) / Math.PI : null;
  const dragDistance = dragOffset ? Math.hypot(dragOffset.x, dragOffset.y) : 0;
  const bulgeAmount = dragOffset ? Math.min(BULGE_MAX, (dragDistance / LIGHT_CIRCLE_TRAVEL) * BULGE_MAX) : 0;

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: 0, top: CENTER_Y - HALF_CIRCLE_RADIUS, width: HALF_CIRCLE_RADIUS + BULGE_MAX, height: HALF_CIRCLE_RADIUS * 2 }}
        viewBox={`0 0 ${HALF_CIRCLE_RADIUS + BULGE_MAX} ${HALF_CIRCLE_RADIUS * 2}`}
      >
        <path d={backdropPath(dragAngleDeg, bulgeAmount)} fill="var(--hf-green)" />
      </svg>

      <button
        aria-label={open ? t("addButton.closeMenu") : t("addButton.openMenu")}
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
        {/* Fejlretninger/FEJLLISTE.md #30: plusset sidder i sin egen lyse
            cirkel, som følger fingeren under træk (clampet af dragOffset,
            se updateHighlight) — i stedet for at stå fast midt i knappen. */}
        <span
          className="pointer-events-none flex items-center justify-center rounded-full bg-hf-white shadow-sm transition-transform"
          style={{
            width: LIGHT_CIRCLE_SIZE,
            height: LIGHT_CIRCLE_SIZE,
            transform: dragOffset ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
            transitionDuration: dragOffset ? "0ms" : "150ms",
          }}
        >
          <IconPlus size={22} color="var(--hf-color-action)" stroke={2} />
        </span>
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
            {Icon ? (
              <Icon size={20} color={isHighlighted ? "var(--hf-white)" : "var(--hf-black)"} />
            ) : (
              <Image src={action.imageSrc!} alt="" width={22} height={22} className="object-contain" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
