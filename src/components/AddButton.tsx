"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { IconList, type Icon } from "@tabler/icons-react";
import {
  addActionByKey,
  useAddActionsProfile,
  useWheelActionKeys,
  visibleAddActions,
  type AddActionKey,
} from "@/lib/add-actions";
import { loadFabOffsetY, saveFabOffsetY, useFabSide, type FabSide } from "@/lib/frontpage-layout";
import { useTranslation } from "@/i18n/LocaleProvider";

export const HERO_HEIGHT = 300;
const CENTER_Y = HERO_HEIGHT / 2;
const CIRCLE = 46;

export const FAB_SIZE = 64;
const FAB_RADIUS = 14;
const DRAG_THRESHOLD = 6;

// Joystick backdrop behind the fanned-out actions, flush against the
// screen edge the FAB sits on. Always visible (not just while open) and
// large enough that a thumb can comfortably roam inside it. 15% bigger
// than the original 72px radius.
const HALF_CIRCLE_RADIUS = 83;

// The backdrop is a half-disk (flat edge against the screen edge, curved
// edge bulging inward) — its visual "middle" is not the half-disk's own
// bounding-box midpoint. It's the centroid of a half-disk area, which sits
// 4r/3π from the flat edge. The FAB (and its plus) is centered there so it
// reads as sitting in the middle of the green shape, not off to one side.
export const FAB_INSET = Math.round((4 * HALF_CIRCLE_RADIUS) / (3 * Math.PI) - FAB_SIZE / 2);

// The action arc is centered on the same point as the backdrop semicircle
// (the screen edge, not the FAB button), so every icon sits the same
// distance from the backdrop's curved edge. Icons sit just outside the
// backdrop, never inside it.
const ARC_GAP = 52;
const RADIUS = HALF_CIRCLE_RADIUS + ARC_GAP + CIRCLE / 2;

// The highlighted icon steps further out still, so the thumb pressing on it
// doesn't sit right on top of / block the icon it just selected.
const HIGHLIGHT_EXTRA_RADIUS = 14;

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
const BULGE_SAMPLE_COUNT = 48;

// How close (in degrees) to the very pole the bulge tapers to zero. Keeping
// this small means the top/bottom action icons (only ~15deg from a pole)
// still get the (near-)full bulge — only the last few degrees right at the
// flat-edge anchor are pinned down.
const BULGE_POLE_TAPER_DEG = 12;

// The two points where the curve meets the flat edge (angle -90 and +90) are
// fixed anchors — the flat edge is docked against the screen edge and can't
// move. The old model bulged radially from the semicircle's center, but near
// those poles the radial direction is almost purely vertical, so even a
// small bulge there pushed points past y=0 / y=2R (the pole's own y): the
// curve dipped past the anchor, looped back, and — clipped by the SVG's
// exact-fit viewBox — read as a flat/cut edge, like the circle were oval.
//
// The bulge itself is added only to x and scaled by a pin factor that's 0
// exactly at the poles and ramps up to 1 within BULGE_POLE_TAPER_DEG — unlike
// scaling by baseX/R (which fades across the *whole* quarter-circle and left
// the top/bottom action icons, close to the poles, with almost no visible
// bulge at all), this only pins down the last few degrees right at the
// anchor, so dragging toward a top/bottom icon bulges just as much as one at
// the side.
//
// Sampling must be uniform in angle (theta), not in y: near the poles,
// dy/dtheta -> 0, so equal-y steps skip over huge swings in theta/x — the
// very first segment used to leap from x=0 to nearly a third of the radius
// in a single straight line, which read as a flat cut/facet ("lemon" edge)
// right where the curve meets the flat side. Equal-theta steps put more
// points exactly where the curve bends fastest (the poles) and fewer where
// it's already nearly flat (the equator), keeping every segment short.
function backdropPath(bulgeAngleDeg: number | null, bulgeAmount: number) {
  const points: [number, number][] = [];
  for (let i = 0; i <= BULGE_SAMPLE_COUNT; i += 1) {
    const angleDeg = -90 + (180 * i) / BULGE_SAMPLE_COUNT;
    const theta = (angleDeg * Math.PI) / 180;
    const y = HALF_CIRCLE_RADIUS * (1 + Math.sin(theta));
    const baseX = HALF_CIRCLE_RADIUS * Math.cos(theta);
    let x = baseX;
    if (bulgeAngleDeg !== null && bulgeAmount > 0) {
      let diff = Math.abs(angleDeg - bulgeAngleDeg);
      if (diff > 180) diff = 360 - diff;
      const falloff = Math.max(0, Math.cos((diff / BULGE_SPREAD_DEG) * (Math.PI / 2)));
      const pinFactor = Math.min(1, (90 - Math.abs(angleDeg)) / BULGE_POLE_TAPER_DEG);
      x += bulgeAmount * Math.max(0, falloff) ** 2 * pinFactor;
    }
    points.push([x, y]);
  }
  const commands = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${commands.join(" ")} L0,${HALF_CIRCLE_RADIUS * 2} L0,0 Z`;
}

// Angles are spread evenly across the same -75..75 arc regardless of how
// many actions are shown (the fixed "list" slot plus 0-5 user-chosen
// actions, see src/lib/add-actions.ts) — one item sits at the top (-75),
// one at the bottom (75), the rest evenly spaced between them.
function computeAngles(count: number): number[] {
  if (count <= 1) return [0];
  const step = 150 / (count - 1);
  return Array.from({ length: count }, (_, i) => -75 + i * step);
}

// Which screen edge the FAB sits on is a user preference (settings → Visning
// → Forside), not a fixed constant or something draggable to a custom
// position — see src/lib/frontpage-layout.ts, which is also what StatsWheel
// reads (always the opposite edge) so the two can never disagree.
export type { FabSide };

type Action = {
  key: string;
  href: string;
  label: string;
  hint: string;
  icon?: Icon;
  imageSrc?: string;
};

// The top wheel slot is always this fixed "list" action — it opens the new
// /add/menu screen with every add-element, and is not part of the
// user-configurable set below (src/lib/add-actions.ts, settings → Visning →
// Forside).
function buildActions(
  t: (key: string) => string,
  selectedKeys: AddActionKey[],
  allowedKeys: Set<AddActionKey>
): Action[] {
  const listAction: Action = {
    key: "list",
    href: "/add/menu",
    icon: IconList,
    label: t("addButton.list"),
    hint: t("addButton.hint.list"),
  };

  const selected = selectedKeys
    .filter((key) => allowedKeys.has(key))
    .map((key) => addActionByKey(key))
    .filter((action): action is NonNullable<typeof action> => Boolean(action))
    .map<Action>((action) => ({
      key: action.key,
      href: action.href,
      icon: action.icon,
      imageSrc: action.imageSrc,
      label: t(action.labelKey),
      hint: t(action.hintKey),
    }));

  return [listAction, ...selected];
}

// Both functions place icons on an arc centered at the screen edge — the
// same center the backdrop semicircle uses — so every icon ends up exactly
// RADIUS away from that center, i.e. the same margin from the curved edge.
function arcItemCenter(angleDeg: number, containerWidth: number, side: FabSide) {
  const rad = (angleDeg * Math.PI) / 180;
  const reach = RADIUS * Math.cos(rad);
  const x = side === "left" ? reach : containerWidth - reach;
  const y = CENTER_Y + RADIUS * Math.sin(rad);
  return { x, y };
}

function arcItemStyle(angleDeg: number, side: FabSide, isHighlighted: boolean): React.CSSProperties {
  const radius = RADIUS + (isHighlighted ? HIGHLIGHT_EXTRA_RADIUS : 0);
  const rad = (angleDeg * Math.PI) / 180;
  const reach = radius * Math.cos(rad) - CIRCLE / 2;
  const top = CENTER_Y + radius * Math.sin(rad) - CIRCLE / 2;
  return side === "left" ? { left: reach, top } : { right: reach, top };
}

export function AddButton({ onOpen }: { onOpen?: () => void }) {
  const { t } = useTranslation();
  const side = useFabSide();
  const selectedKeys = useWheelActionKeys();
  const profile = useAddActionsProfile();
  const allowedKeys = new Set(visibleAddActions(profile).map((action) => action.key));
  const actions = buildActions(t, selectedKeys, allowedKeys);
  const anglesDeg = computeAngles(actions.length);
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

  // Vertical drag of the whole circle (backdrop + fingerprint + action arc).
  // offsetY is in CSS px relative to the default hero position — see
  // loadFabOffsetY() in src/lib/frontpage-layout.ts for the coordinate system.
  const [offsetY, setOffsetY] = useState(0);
  const offsetYRef = useRef(0);
  const moveDragRef = useRef<{ pointerId: number; startPointerY: number; startOffsetY: number } | null>(null);

  useEffect(() => () => document.body.classList.remove("select-none"), []);

  // Allowed offset range, from the live layout: the green backdrop's top may
  // not rise above the page's top bar, and its bottom may not sink below the
  // top edge of the bottom navigation (measured, so safe-area padding,
  // collapsed/landscape bar and browser chrome are all respected).
  function offsetBounds() {
    const container = containerRef.current;
    if (!container) return null;
    const baseTop = container.getBoundingClientRect().top - offsetYRef.current;
    const topLimit = document.querySelector<HTMLElement>("[data-top-bar]")?.getBoundingClientRect().top ?? 0;
    const bottomLimit =
      document.querySelector<HTMLElement>("[data-bottom-navigation]")?.getBoundingClientRect().top ??
      window.innerHeight;
    const min = topLimit - (baseTop + CENTER_Y - HALF_CIRCLE_RADIUS);
    const max = Math.max(min, bottomLimit - (baseTop + CENTER_Y + HALF_CIRCLE_RADIUS));
    return { min, max };
  }

  function applyOffsetY(next: number) {
    const bounds = offsetBounds();
    const clamped = bounds ? Math.min(bounds.max, Math.max(bounds.min, next)) : next;
    offsetYRef.current = clamped;
    setOffsetY(clamped);
    return clamped;
  }

  // Restore the saved position after mount (server render always uses the
  // default), and re-clamp whenever the viewport or bottom nav changes size
  // so the circle can never end up behind the navigation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage, same as Hero.tsx
    applyOffsetY(loadFabOffsetY());
    const reclamp = () => applyOffsetY(offsetYRef.current);
    window.addEventListener("resize", reclamp);
    window.visualViewport?.addEventListener("resize", reclamp);
    const nav = document.querySelector<HTMLElement>("[data-bottom-navigation]");
    const observer = nav && typeof ResizeObserver !== "undefined" ? new ResizeObserver(reclamp) : null;
    if (nav) observer?.observe(nav);
    return () => {
      window.removeEventListener("resize", reclamp);
      window.visualViewport?.removeEventListener("resize", reclamp);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; applyOffsetY reads refs/DOM
  }, []);

  function handleMovePointerDown(event: React.PointerEvent<SVGPathElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures.
    }
    moveDragRef.current = {
      pointerId: event.pointerId,
      startPointerY: event.clientY,
      startOffsetY: offsetYRef.current,
    };
  }

  function handleMovePointerMove(event: React.PointerEvent<SVGPathElement>) {
    const drag = moveDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    applyOffsetY(drag.startOffsetY + event.clientY - drag.startPointerY);
  }

  function handleMovePointerEnd(event: React.PointerEvent<SVGPathElement>) {
    const drag = moveDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    moveDragRef.current = null;
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Ignore release failures.
    }
    // No snapping: the circle stays exactly where it was released.
    saveFabOffsetY(offsetYRef.current);
  }

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
      const { x, y } = arcItemCenter(anglesDeg[i], rect.width, side);
      const distance = Math.hypot(px - x, py - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestKey = actions[i].key;
      }
    }

    const fabCenterX = side === "left" ? FAB_INSET + FAB_SIZE / 2 : rect.width - FAB_INSET - FAB_SIZE / 2;
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
      // Whether an option was picked or not, this press was consumed by the
      // open menu — closing it either way. A second tap on the FAB with
      // nothing chosen should just dismiss the fanned-out actions.
      setOpen(false);
      if (key) {
        const action = actions.find((a) => a.key === key);
        if (action) router.push(action.href);
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

  // The bulge snaps to whichever icon currently has focus (its fixed arc
  // angle), instead of continuously tracking the raw finger angle — it
  // should only ever point at the highlighted option, never drift toward
  // the exact pointer position.
  const highlightedIndex = highlightedKey ? actions.findIndex((a) => a.key === highlightedKey) : -1;
  const bulgeAngleDeg = highlightedIndex >= 0 ? anglesDeg[highlightedIndex] : null;
  const dragDistance = dragOffset ? Math.hypot(dragOffset.x, dragOffset.y) : 0;
  const bulgeAmount =
    highlightedIndex >= 0 ? Math.min(BULGE_MAX, (dragDistance / LIGHT_CIRCLE_TRAVEL) * BULGE_MAX) : 0;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-30"
      style={{ transform: `translate3d(0, ${offsetY}px, 0)`, willChange: "transform" }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: 0, top: CENTER_Y - HALF_CIRCLE_RADIUS, width: HALF_CIRCLE_RADIUS + BULGE_MAX, height: HALF_CIRCLE_RADIUS * 2 }}
        viewBox={`0 0 ${HALF_CIRCLE_RADIUS + BULGE_MAX} ${HALF_CIRCLE_RADIUS * 2}`}
      >
        {/* Only the painted green shape is a drag handle for moving the whole
            circle vertically; the fingerprint button above it is a separate
            element, so presses on it never reach these handlers. */}
        <path
          d={backdropPath(bulgeAngleDeg, bulgeAmount)}
          fill="var(--hf-green)"
          style={{ pointerEvents: "auto", touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
          onPointerDown={handleMovePointerDown}
          onPointerMove={handleMovePointerMove}
          onPointerUp={handleMovePointerEnd}
          onPointerCancel={handleMovePointerEnd}
        />
      </svg>

      <button
        aria-label={open ? t("addButton.closeMenu") : t("addButton.openMenu")}
        aria-expanded={open}
        data-fingerprint-control
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={endInteraction}
        className="pointer-events-auto absolute z-10 flex items-center justify-center bg-transparent border-0 shadow-none"
        style={{
          [side === "left" ? "left" : "right"]: FAB_INSET,
          top: CENTER_Y - FAB_SIZE / 2,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_RADIUS,
          touchAction: "none",
        } as React.CSSProperties}
      >
        {/* Fejlretninger/FEJLLISTE.md #30: ikonet sidder i sin egen lyse
            cirkel, som følger fingeren under træk (clampet af dragOffset,
            se updateHighlight) — i stedet for at stå fast midt i knappen.
            Erstattede det tidligere IconPlus med et fingeraftryk (bruger-
            leveret public/icons/fingerprint.png) som symbol for at cirklen
            kan navigeres — samme "brightness(0) invert(1)"-hvidgørings-
            mønster som allerede bruges til wheel-actionernes PNG-ikoner
            nedenfor, så den rå PNG altid vises hvid uanset kildefarve. */}
        <span
          className="pointer-events-none flex items-center justify-center rounded-full shadow-sm transition-transform"
          style={{
            width: LIGHT_CIRCLE_SIZE,
            height: LIGHT_CIRCLE_SIZE,
            backgroundColor: "var(--hf-tan-dark)",
            transform: dragOffset ? `translate(${dragOffset.x}px, ${dragOffset.y}px)` : undefined,
            transitionDuration: dragOffset ? "0ms" : "150ms",
          }}
        >
          <Image
            src="/icons/fingerprint.png"
            alt=""
            width={22}
            height={22}
            className="object-contain"
            style={{ filter: "brightness(0) invert(1)" }}
          />
        </span>
      </button>

      {actions.map((action, i) => {
        const isHighlighted = highlightedKey === action.key;
        const Icon = action.icon;
        const itemStyle = arcItemStyle(anglesDeg[i], side, isHighlighted);
        return (
          <div
            key={action.key}
            className="absolute transition-[top,left,right] duration-150"
            style={{ top: itemStyle.top, [side === "left" ? "left" : "right"]: itemStyle[side === "left" ? "left" : "right"], height: CIRCLE }}
          >
            <Link
              href={action.href}
              aria-label={action.label}
              className="absolute flex items-center justify-center rounded-full bg-hf-tan transition-all duration-150"
              style={{
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
                <Image
                  src={action.imageSrc!}
                  alt=""
                  width={22}
                  height={22}
                  className="object-contain"
                  style={isHighlighted ? { filter: "brightness(0) invert(1)" } : undefined}
                />
              )}
            </Link>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute flex items-center whitespace-nowrap font-bold transition-opacity duration-150"
              style={
                side === "left"
                  ? {
                      left: CIRCLE + 12,
                      top: 0,
                      height: CIRCLE,
                      color: "var(--hf-green)",
                      fontSize: 15,
                      opacity: open && isHighlighted ? 1 : 0,
                    }
                  : {
                      right: CIRCLE + 12,
                      top: 0,
                      height: CIRCLE,
                      color: "var(--hf-green)",
                      fontSize: 15,
                      opacity: open && isHighlighted ? 1 : 0,
                    }
              }
            >
              {action.hint}
            </span>
          </div>
        );
      })}
    </div>
  );
}
