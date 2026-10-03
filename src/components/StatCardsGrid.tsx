"use client";

import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  accordionAt,
  accordionRange,
  isHalfWidthStatItem,
  loadStatLayout,
  makeEmptyStatSlot,
  normalizeStatLayout,
  saveStatLayout,
  type StatCardValue,
  SPORT_STAT_KEY_PREFIX,
  type StatGridLayoutItem as LayoutItem,
} from "@/lib/stat-cards";
import { useTranslation } from "@/i18n/LocaleProvider";
import { StatCardIcon } from "@/components/StatCardIcon";
import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";
import { UncertaintyLine } from "@/components/ui/UncertaintyLine";
import { RemoveCircleButton } from "@/components/ui/RemoveCircleButton";
import { Skeleton } from "@/components/hf/Skeleton";
import { EnergyChip } from "@/components/calendar/EnergyChip";
import { useIsClientRender } from "@/lib/use-client-render";
import { HfChevron } from "@/components/hf/HfChevron";

// The grid is two columns of physical slots: a run of half-width items (cards
// and explicit empty slots) always has an even length, so every item's index
// maps to a fixed left/right position and CSS grid never packs cards to the
// left. Headers and dividers span a full row between those runs.
//
// A fold-out section (accordion) is two markers in the same flat list (see
// StatAccordionLayoutItem in src/lib/stat-cards.ts); the rows between them
// are drawn inside its frame, and not at all while it is closed. Lifting its
// header lifts the whole section, open or closed, and it lands as one block
// between two top-level rows (never inside another section). A card let go
// on a closed section's header goes in at its end.
//
// Dragging lifts the item itself — frame, remove circle and all — and it
// follows the finger. The grid meanwhile already shows the result of letting
// go: a card's landing slot is marked and the card it would swap with has
// moved to the card's old slot; a header's landing row is a dashed
// placeholder. On release the item glides the short way from under the
// finger into that spot, and nothing else moves.

function layoutItemId(item: LayoutItem) {
  if (item.type === "stat") return `stat:${item.key}`;
  return `${item.type}:${item.id}`;
}

/** Index of the first item of every visual row (a pair of slots or one full-width item). */
function rowStarts(items: LayoutItem[]) {
  const starts: number[] = [];
  let i = 0;
  while (i < items.length) {
    starts.push(i);
    i += isHalfWidthStatItem(items[i]) ? 2 : 1;
  }
  return starts;
}

function endsWithEmptyRow(layout: LayoutItem[]) {
  const n = layout.length;
  return (
    n >= 2 &&
    layout[n - 1].type === "empty" &&
    layout[n - 2].type === "empty" &&
    rowStarts(layout).includes(n - 2)
  );
}

/**
 * While editing there is always one free row at the bottom — of the grid and
 * of every fold-out section — so a card can be moved further down or into
 * an empty section.
 */
function withTrailingEmptyRow(layout: LayoutItem[]) {
  const next: LayoutItem[] = [];
  for (const item of layout) {
    if (item.type === "accordionEnd" && !endsWithEmptyRow(next)) next.push(makeEmptyStatSlot(), makeEmptyStatSlot());
    next.push(item);
  }
  if (!endsWithEmptyRow(next)) next.push(makeEmptyStatSlot(), makeEmptyStatSlot());
  return next;
}

/** The layout without the lifted item — for a section, without its whole block. */
function withoutItem(layout: LayoutItem[], item: LayoutItem) {
  if (item.type === "accordion") {
    const range = accordionRange(layout, item.id);
    if (range) return [...layout.slice(0, range.start), ...layout.slice(range.end + 1)];
  }
  const id = layoutItemId(item);
  return layout.filter((other) => layoutItemId(other) !== id);
}

/** What moves when the item is lifted: the item, or a section's whole block. */
function liftedBlock(layout: LayoutItem[], item: LayoutItem) {
  if (item.type === "accordion") {
    const range = accordionRange(layout, item.id);
    if (range) return layout.slice(range.start, range.end + 1);
  }
  return [item];
}

/** Number of cards inside a section. */
function accordionCardCount(layout: LayoutItem[], id: string) {
  const range = accordionRange(layout, id);
  if (!range) return 0;
  return layout.slice(range.start + 1, range.end).filter((item) => item.type === "stat").length;
}

function scrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

type Position = { left: number; top: number };

type DragState = {
  id: string;
  item: LayoutItem;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type PendingPress = {
  id: string;
  item: LayoutItem;
  startX: number;
  startY: number;
  pointerType: string;
  rect: { left: number; top: number; width: number; height: number };
  timer: number | null;
};

// Long-press before an item lifts: outside edit mode it also enters edit
// mode. Moving the finger further than the tolerance first means the user is
// scrolling, so the press is dropped and the browser keeps the gesture.
const ENTER_EDIT_DELAY_MS = 500;
const DRAG_DELAY_MS = 250;
const MOVE_TOLERANCE_PX = 8;
const TAP_TOLERANCE_PX = 10;
const REFLOW_MS = 180;
const REFLOW_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const SLIDE_ANIMATION_ID = "stat-grid-slide";
const LIFT_SHADOW = "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)";
const EDIT_OUTLINE = "border-[1.5px] border-dashed border-hf-black/40";

/** Where an item is drawn inside the grid: its layout box plus any slide still in flight. */
function drawnPosition(el: HTMLElement): Position {
  const transform = getComputedStyle(el).transform;
  const shift = transform && transform !== "none" ? new DOMMatrixReadOnly(transform) : null;
  return { left: el.offsetLeft + (shift?.m41 ?? 0), top: el.offsetTop + (shift?.m42 ?? 0) };
}

/**
 * Slides an item from `dx`/`dy` away back to its layout box. A script
 * animation overrides edit mode's wobble while it runs, and the wobble
 * resumes by itself afterwards. `landing` is a dropped item settling from
 * under the finger: it stays on top and its lift shadow fades.
 */
function slide(el: HTMLElement, dx: number, dy: number, landing: boolean) {
  el.getAnimations().forEach((animation) => {
    if (animation.id === SLIDE_ANIMATION_ID) animation.cancel();
  });
  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px)`, zIndex: landing ? 20 : 10, ...(landing ? { boxShadow: LIFT_SHADOW } : {}) },
      { transform: "translate(0px, 0px)", zIndex: landing ? 20 : 10, ...(landing ? { boxShadow: "none" } : {}) },
    ],
    { duration: REFLOW_MS, easing: REFLOW_EASING, id: SLIDE_ANIMATION_ID },
  );
}

type GridReflowProps = {
  /** A new value whenever items may have moved. */
  items: unknown;
  elements: { current: Map<string, HTMLElement> };
  /** A dropped item starts from here (the floating copy's spot) instead of its old place. */
  settleFrom: { current: { id: string; position: Position } | null };
  /** Items that jump to their new place instead of sliding. */
  jumps: (id: string) => boolean;
  children: ReactNode;
};

/**
 * FLIP reflow: every item that changes place slides there instead of
 * teleporting. A class component because getSnapshotBeforeUpdate runs right
 * before React touches the DOM, so the starting point is exactly where each
 * item is drawn at that moment — also mid-slide, and independent of scrolling.
 */
class GridReflow extends Component<GridReflowProps, unknown, Map<string, Position> | null> {
  getSnapshotBeforeUpdate(prevProps: Readonly<GridReflowProps>) {
    const settle = this.props.settleFrom.current;
    if (prevProps.items === this.props.items && !settle) return null;
    const before = new Map<string, Position>();
    this.props.elements.current.forEach((el, id) => before.set(id, drawnPosition(el)));
    if (settle) before.set(settle.id, settle.position);
    return before;
  }

  componentDidUpdate(_prevProps: Readonly<GridReflowProps>, _prevState: unknown, before: Map<string, Position> | null) {
    if (!before) return;
    const settle = this.props.settleFrom.current;
    this.props.settleFrom.current = null;
    this.props.elements.current.forEach((el, id) => {
      const from = before.get(id);
      if (!from || this.props.jumps(id)) return;
      const dx = from.left - el.offsetLeft;
      const dy = from.top - el.offsetTop;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      slide(el, dx, dy, settle?.id === id);
    });
  }

  render() {
    return this.props.children;
  }
}

// "1.234 kcal" / "30 min · 250 kcal" → tal med kyllingelår (indtag) eller
// flamme (forbrændt) i stedet for enheden (design.md §6.16). Kortets eget
// ikon er allerede kyllingelår/flamme for "Kalorier" og "Forbrændt", så dér
// bærer kortikonet betydningen, og chippen viser kun tallet.
const KCAL_VALUE_PATTERN = /^(.*?)(\d[\d.,]*)\s+kcal$/;
function isBurnedCard(key: string) {
  return key === "burned" || key.startsWith(SPORT_STAT_KEY_PREFIX);
}
function StatCardValueText({ card }: { card: StatCardValue }) {
  const match = card.value.match(KCAL_VALUE_PATTERN);
  if (!match) return <>{card.value}</>;
  if (card.key === "calories" || card.key === "burned") return <>{match[1]}{match[2]}</>;
  return (
    <>
      {match[1]}
      <EnergyChip kind={isBurnedCard(card.key) ? "burned" : "intake"} text={match[2]} iconSize={18} />
    </>
  );
}


function StatCardFace({
  card,
  noDataText,
  loading = false,
}: {
  card: StatCardValue | undefined;
  noDataText: string;
  loading?: boolean;
}) {
  if (!card && loading) {
    // Kort, der først findes, når data er hentet (fx sportskort): samme to
    // linjer som et færdigt kort, men som skitser (design.md §6.14), så
    // kortet har sin endelige højde fra første billede.
    return (
      <>
        <p className="hf-type-small flex items-center" style={{ minHeight: "1lh" }}>
          <Skeleton type="caption" width="70%" height={14} />
        </p>
        <p className="hf-type-body-lg hf-heading mt-1 flex items-center gap-1.5" style={{ minHeight: "1lh" }}>
          <Skeleton type="icon" />
          <Skeleton type="body" width={56} height={20} />
        </p>
      </>
    );
  }
  if (!card) {
    // The key is a real, saved part of the layout (e.g. a sport-activity
    // card with no data in the currently selected period) — keep its slot.
    return <p className="hf-type-small text-text-muted">{noDataText}</p>;
  }
  return (
    <>
      <p className="hf-type-small text-text-secondary">{card.label}</p>
      <p className="hf-type-body-lg hf-heading mt-1 flex items-center gap-1.5 text-hf-black">
        <StatCardIcon icon={card.icon} iconSrc={card.iconSrc} />
        {card.loading ? (
          <Skeleton type="body" width={56} height={20} />
        ) : (
          <span className="inline-flex items-center gap-1">
            {card.uncertainty?.estimated ? <UncertaintyTilde /> : null}
            <StatCardValueText card={card} />
          </span>
        )}
      </p>
    </>
  );
}

// Usikkerheds-~ (docs/DECISIONS.md 2026-09-24): den grå linje under et
// næringsstof-kort, foldet ind indtil brugeren trykker på pilen (eller har
// slået automatisk udfoldning til). Pilen stopper pointerdown, så et tryk
// aldrig starter kortets træk-og-slip.
function CardUncertainty({ card, expanded, onToggle }: { card: StatCardValue; expanded: boolean; onToggle: () => void }) {
  const u = card.uncertainty;
  if (!u) return null;
  return (
    <>
      {expanded && (
        <UncertaintyLine className="mt-2" estimated={u.estimated} tolerance={u.tolerance} unit={u.unit} digits={u.digits} />
      )}
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={card.label}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onToggle}
        className="hf-type-small mt-1 text-hf-black/40"
      >
        {expanded ? "▴" : "▾"}
      </button>
    </>
  );
}

// Brugerens egne overskrifter er den ene fælles overskrift med streger
// (.hf-type-section-title). Gitteret styrer selv afstanden mellem felterne,
// så klassens luft over/under nulstilles via dens egne variabler.
const GRID_SECTION_TITLE =
  "hf-type-section-title [--hf-section-title-space-above:0px] [--hf-section-title-space-below:0px]";

function HeadingContent({ text }: { text: string }) {
  return <h2 className={GRID_SECTION_TITLE}>{text}</h2>;
}

export function StatCardsGrid({
  cards,
  defaultActiveKeys,
  highlightRecommendedLimits = false,
  autoExpandUncertainty = false,
  loading = false,
  onShowAddChange,
  onEditModeChange,
}: {
  cards: StatCardValue[];
  defaultActiveKeys: string[];
  highlightRecommendedLimits?: boolean;
  autoExpandUncertainty?: boolean;
  /** True while editing — or when the grid is empty, so cards can always be added back. */
  onShowAddChange?: (show: boolean) => void;
  /** True while the grid is in edit mode (long press). */
  onEditModeChange?: (editing: boolean) => void;
  /** Data hentes stadig: kort uden værdi endnu tegnes som skitser i stedet for "ingen data". */
  loading?: boolean;
}) {
  // Kort hvor brugeren har vendt den grå usikkerhedslinje i forhold til
  // udgangspunktet (autoExpandUncertainty).
  const [uncertaintyToggled, setUncertaintyToggled] = useState<Set<string>>(() => new Set());
  function toggleUncertainty(key: string) {
    setUncertaintyToggled((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const { t } = useTranslation();
  const cardByKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);

  const defaultLayout = useMemo<LayoutItem[]>(
    () => defaultActiveKeys.map((key) => ({ type: "stat", key })),
    [defaultActiveKeys],
  );

  // The saved layout lives in localStorage, which the server can't see. When
  // the grid is drawn in the browser (always on the statistics page) the saved
  // layout is used from the very first frame, so no card ever changes place
  // after loading; only during hydration of server HTML does the default come
  // first (and the focus effect below switches after mount).
  const clientRender = useIsClientRender();
  const [layout, setLayout] = useState<LayoutItem[]>(() =>
    clientRender ? loadStatLayout(defaultLayout) : normalizeStatLayout(defaultLayout),
  );
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Card drag: the slot (layout index) the card lands in — null while the
  // finger is outside the grid, where letting go takes the card off — or the
  // closed section it goes into. Header/divider/section drag: the index (in
  // the layout without the lifted item) where the dashed placeholder sits.
  const [slotTarget, setSlotTarget] = useState<number | null>(null);
  const [accordionTarget, setAccordionTarget] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  // Header being renamed, or section whose title is being renamed.
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const itemRefs = useRef(new Map<string, HTMLElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingPress | null>(null);
  // The lifted item, updated synchronously: touch handlers must know at once
  // that an item is lifted, not one render later.
  const dragRef = useRef<DragState | null>(null);
  // Pointer handlers bound in the effect below, reachable from a press's own
  // touch listeners (see bindTouchTarget).
  const handlersRef = useRef<{ move: (x: number, y: number) => void; up: () => void; cancel: () => void } | null>(null);
  const touchTargetCleanupRef = useRef<(() => void) | null>(null);
  const settleRef = useRef<{ id: string; position: Position } | null>(null);
  const isFirstRender = useRef(true);

  // Latest values for the window-level pointer listeners, which are bound once.
  const stateRef = useRef({ layout, editMode, drag, insertAt, slotTarget, accordionTarget });
  useLayoutEffect(() => {
    stateRef.current = { layout, editMode, drag, insertAt, slotTarget, accordionTarget };
  });

  const dragId = drag?.id ?? null;
  const dragItem = drag?.item ?? null;
  const isCardDrag = dragItem !== null && isHalfWidthStatItem(dragItem);

  // What is rendered while something is lifted: the grid as it will be once
  // it is let go (see the comment at the top).
  const renderItems = useMemo<(LayoutItem | { type: "preview" })[]>(() => {
    if (!dragId || !dragItem) return layout;
    if (isHalfWidthStatItem(dragItem)) {
      if (accordionTarget !== null) return layout;
      const from = layout.findIndex((item) => layoutItemId(item) === dragId);
      const to = slotTarget ?? from;
      if (from < 0 || to === from || to >= layout.length) return layout;
      const next = [...layout];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    }
    const rest = withoutItem(layout, dragItem);
    if (insertAt === null) return rest;
    const at = Math.min(insertAt, rest.length);
    return [...rest.slice(0, at), { type: "preview" as const }, ...rest.slice(at)];
  }, [layout, dragId, dragItem, insertAt, slotTarget, accordionTarget]);

  const hasItems = layout.some((item) => item.type !== "empty");
  useEffect(() => {
    onShowAddChange?.(editMode || !hasItems);
  }, [editMode, hasItems, onShowAddChange]);

  useEffect(() => {
    onEditModeChange?.(editMode);
  }, [editMode, onEditModeChange]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveStatLayout(layout);
  }, [layout]);

  // Reload the layout if it was changed elsewhere (e.g. the unused-cards
  // page) as soon as the user navigates back to this page/component.
  useEffect(() => {
    function onFocus() {
      if (stateRef.current.editMode) return;
      setLayout(loadStatLayout(defaultLayout));
    }
    onFocus();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [defaultLayout]);

  function setLiveDrag(next: DragState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function enterEditMode() {
    setEditMode(true);
    setLayout((prev) => withTrailingEmptyRow(prev));
  }

  function exitEditMode() {
    setEditMode(false);
    dragRef.current = null;
    setDrag(null);
    setSlotTarget(null);
    setAccordionTarget(null);
    setInsertAt(null);
    setEditingHeaderId(null);
    setLayout((prev) => normalizeStatLayout(prev));
  }

  function removeItem(id: string) {
    setLayout((prev) => {
      const target = prev.find((item) => layoutItemId(item) === id);
      if (target?.type === "accordion") {
        // Removing a section keeps its cards: they move out into the grid
        // where the section was (without the free row editing gave it).
        const range = accordionRange(prev, target.id);
        if (!range) return prev;
        const contents = prev.slice(range.start + 1, range.end);
        while (endsWithEmptyRow(contents)) contents.splice(-2, 2);
        return [...prev.slice(0, range.start), ...contents, ...prev.slice(range.end + 1)];
      }
      return prev.flatMap((item) => {
        if (layoutItemId(item) !== id) return [item];
        // A card leaves its slot empty — the rest of the grid must not shift.
        return item.type === "stat" ? [makeEmptyStatSlot()] : [];
      });
    });
  }

  function toggleAccordion(id: string) {
    setLayout((prev) =>
      prev.map((item) => (item.type === "accordion" && item.id === id ? { ...item, open: !item.open } : item)),
    );
  }

  function startDrag(press: PendingPress, x: number, y: number) {
    const current = stateRef.current.layout;
    const index = current.findIndex((item) => layoutItemId(item) === press.id);
    const isCard = isHalfWidthStatItem(press.item);
    setEditingHeaderId(null);
    // A full-width item starts out where it is: everything before it is
    // unchanged in the layout without it, so its index is the insert index.
    setInsertAt(!isCard && index >= 0 ? index : null);
    setSlotTarget(isCard && index >= 0 ? index : null);
    setAccordionTarget(null);
    setLiveDrag({
      id: press.id,
      item: press.item,
      x,
      y,
      offsetX: press.startX - press.rect.left,
      offsetY: press.startY - press.rect.top,
      width: press.rect.width,
      height: press.rect.height,
    });
  }

  function onItemPointerDown(event: React.PointerEvent<HTMLElement>, id: string, item: LayoutItem) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-stat-action], input")) return;
    if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);

    // The item's box without edit mode's wobble, which would tilt and enlarge
    // the bounding rect.
    const el = event.currentTarget;
    const gridRect = gridRef.current?.getBoundingClientRect();
    const press: PendingPress = {
      id,
      item,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      rect: {
        left: (gridRect?.left ?? 0) + el.offsetLeft,
        top: (gridRect?.top ?? 0) + el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight,
      },
      timer: null,
    };
    pendingRef.current = press;
    // The finger may land on an SVG icon; the touch listeners behave the same there.
    if (event.pointerType !== "mouse" && event.target instanceof Element) bindTouchTarget(event.target as HTMLElement);

    // A mouse in edit mode picks the item up as soon as it moves (see onMove);
    // touch always needs a short, still press so a swipe stays a scroll.
    if (editMode && event.pointerType === "mouse") return;
    press.timer = window.setTimeout(
      () => {
        if (pendingRef.current !== press) return;
        press.timer = null;
        if (!stateRef.current.editMode) enterEditMode();
        startDrag(press, press.startX, press.startY);
      },
      editMode ? DRAG_DELAY_MS : ENTER_EDIT_DELAY_MS,
    );
  }

  /**
   * iOS keeps sending a touch's events to the element the finger first landed
   * on — even after React has taken that element out of the page, which
   * lifting does (a card's contents give way to its slot marker, a header
   * leaves the grid). Events on a detached element never reach document or
   * window, so nothing stopped the page from scrolling and the item stopped
   * following the finger. The element's own listeners still get them.
   */
  function bindTouchTarget(target: HTMLElement) {
    touchTargetCleanupRef.current?.();
    function onTouchMove(event: TouchEvent) {
      if (dragRef.current && event.cancelable) event.preventDefault();
      if (target.isConnected) return; // Reaches the window listeners as usual.
      const touch = event.changedTouches[0];
      if (touch) handlersRef.current?.move(touch.clientX, touch.clientY);
    }
    function onTouchEnd(event: TouchEvent) {
      cleanup();
      if (target.isConnected) return;
      if (event.type === "touchcancel") handlersRef.current?.cancel();
      else handlersRef.current?.up();
    }
    function cleanup() {
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
      if (touchTargetCleanupRef.current === cleanup) touchTargetCleanupRef.current = null;
    }
    target.addEventListener("touchmove", onTouchMove, { passive: false });
    target.addEventListener("touchend", onTouchEnd);
    target.addEventListener("touchcancel", onTouchEnd);
    touchTargetCleanupRef.current = cleanup;
  }

  function updateTargets(x: number, y: number, current: DragState) {
    const grid = gridRef.current;
    if (!grid) return;
    const gridRect = grid.getBoundingClientRect();

    // Everything is measured from layout boxes (offsetTop/Left), not from
    // where items are drawn, so items sliding out of the way never change
    // what is under the finger.
    if (isHalfWidthStatItem(current.item)) {
      const inside = x >= gridRect.left && x <= gridRect.right && y >= gridRect.top && y <= gridRect.bottom;
      if (!inside) {
        setSlotTarget(null);
        return;
      }
      let hit: number | null = null;
      for (const el of Array.from(grid.querySelectorAll<HTMLElement>("[data-slot-index]"))) {
        const left = gridRect.left + el.offsetLeft;
        const top = gridRect.top + el.offsetTop;
        if (x >= left && x < left + el.offsetWidth && y >= top && y < top + el.offsetHeight) {
          hit = Number(el.dataset.slotIndex);
          break;
        }
      }
      // A closed section's header takes the card in at the section's end.
      let into: string | null = null;
      if (hit === null) {
        for (const el of Array.from(grid.querySelectorAll<HTMLElement>("[data-accordion-drop]"))) {
          const left = gridRect.left + el.offsetLeft;
          const top = gridRect.top + el.offsetTop;
          if (x >= left && x < left + el.offsetWidth && y >= top && y < top + el.offsetHeight) {
            into = el.dataset.accordionDrop ?? null;
            break;
          }
        }
      }
      const own = stateRef.current.layout.findIndex((item) => layoutItemId(item) === current.id);
      // Crossing the gap between two slots (or a header) keeps the last slot,
      // so the grid doesn't flicker; back inside the grid it is at least the
      // card's own slot again.
      if (into !== null) {
        setAccordionTarget(into);
        setSlotTarget(own >= 0 ? own : null);
        return;
      }
      setAccordionTarget(null);
      if (hit !== null) setSlotTarget(hit);
      else if (stateRef.current.slotTarget === null || stateRef.current.accordionTarget !== null) {
        setSlotTarget(own >= 0 ? own : null);
      }
      return;
    }

    // Header/divider/section: the placeholder goes before the first drawn
    // row whose center lies below the finger. Rows inside a closed section
    // aren't drawn, so they are never candidates; a section only lands
    // between top-level rows. Rows below the placeholder only ever move
    // further down, so the choice is stable while it shifts them.
    const rest = withoutItem(stateRef.current.layout, current.item);
    const topLevelOnly = current.item.type === "accordion";
    const candidates: number[] = [];
    let boundary = 0;
    for (const start of rowStarts(rest)) {
      const first = rest[start];
      if (first.type === "accordionEnd") continue;
      if (topLevelOnly && accordionAt(rest, start) !== null) continue;
      const el = itemRefs.current.get(layoutItemId(first));
      if (!el) continue;
      candidates.push(start);
      if (gridRect.top + el.offsetTop + el.offsetHeight / 2 < y) boundary += 1;
    }
    setInsertAt(boundary < candidates.length ? candidates[boundary] : rest.length);
  }

  /**
   * Lets go of the lifted item. It lands where the grid already shows it and
   * glides there from under the finger; a cancelled drag glides back home. A
   * card let go outside the grid is taken off and simply disappears.
   */
  function drop(current: DragState, cancelled: boolean) {
    const { layout: currentLayout, insertAt: at, slotTarget: target, accordionTarget: into } = stateRef.current;
    const isCard = isHalfWidthStatItem(current.item);
    const from = currentLayout.findIndex((item) => layoutItemId(item) === current.id);

    if (!cancelled && isCard && target === null && into === null) {
      removeItem(current.id);
    } else if (!cancelled && isCard && into !== null && from >= 0) {
      // Into a closed section: the card leaves its slot empty and goes in at
      // the section's end — into its free row when editing gave it one.
      const next = [...currentLayout];
      next[from] = makeEmptyStatSlot();
      const range = accordionRange(next, into);
      if (range) {
        if (endsWithEmptyRow(next.slice(0, range.end))) next[range.end - 2] = current.item;
        else next.splice(range.end, 0, current.item);
        setLayout(withTrailingEmptyRow(normalizeStatLayout(next)));
      }
    } else {
      const gridRect = gridRef.current?.getBoundingClientRect();
      settleRef.current = {
        id: current.id,
        position: {
          left: current.x - current.offsetX - (gridRect?.left ?? 0),
          top: current.y - current.offsetY - (gridRect?.top ?? 0),
        },
      };
      if (!cancelled && isCard && target !== null && from >= 0 && target !== from) {
        // Card onto a card or an empty slot: the two swap places, so an empty
        // slot keeps existing where the card came from.
        const next = [...currentLayout];
        [next[from], next[target]] = [next[target], next[from]];
        setLayout(next);
      } else if (!cancelled && !isCard && at !== null) {
        const rest = withoutItem(currentLayout, current.item);
        const block = liftedBlock(currentLayout, current.item);
        const index = Math.min(at, rest.length);
        setLayout([...rest.slice(0, index), ...block, ...rest.slice(index)]);
      }
    }

    setLiveDrag(null);
    setSlotTarget(null);
    setAccordionTarget(null);
    setInsertAt(null);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      move(event.clientX, event.clientY);
    }

    function move(x: number, y: number) {
      const press = pendingRef.current;
      const current = dragRef.current;

      if (press && !current) {
        const moved = Math.hypot(x - press.startX, y - press.startY);
        if (moved <= MOVE_TOLERANCE_PX) return;
        if (press.timer) window.clearTimeout(press.timer);
        pendingRef.current = null;
        // Mouse in edit mode: moving is the drag. Touch: moving first is a scroll.
        if (stateRef.current.editMode && press.pointerType === "mouse") {
          startDrag(press, x, y);
        }
        return;
      }

      if (!current) return;
      setLiveDrag({ ...current, x, y });
      updateTargets(x, y, current);
    }

    function onUp() {
      const press = pendingRef.current;
      const current = dragRef.current;
      if (press?.timer) window.clearTimeout(press.timer);
      pendingRef.current = null;

      if (current) {
        drop(current, false);
        return;
      }
      // A short tap on a header's title while editing renames it. The same
      // tap on a section's header renames it while editing and opens or
      // closes it otherwise.
      if (press && stateRef.current.editMode && press.item.type === "header") {
        setEditingHeaderId(press.item.id);
      } else if (press && press.item.type === "accordion") {
        if (stateRef.current.editMode) setEditingHeaderId(press.item.id);
        else toggleAccordion(press.item.id);
      }
    }

    function onCancel() {
      if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
      const current = dragRef.current;
      if (current) drop(current, true);
    }

    // Items use `touch-action: pan-y` so a swipe on them scrolls the page. Only
    // once an item has actually been lifted does the page stop scrolling.
    function onTouchMove(event: TouchEvent) {
      if (dragRef.current && event.cancelable) event.preventDefault();
    }

    handlersRef.current = { move, up: onUp, cancel: onCancel };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      handlersRef.current = null;
      touchTargetCleanupRef.current?.();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.removeEventListener("touchmove", onTouchMove);
    };
    // Handlers read live state through stateRef; binding once is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll while an item is held near the top/bottom of the screen, so it
  // can be carried past what is currently visible.
  const isDragging = drag !== null;
  useEffect(() => {
    if (!isDragging) return;
    const scroller = scrollParent(gridRef.current);
    if (!scroller) return;
    let frame = 0;
    function tick() {
      const current = dragRef.current;
      if (current && scroller) {
        const bounds = scroller.getBoundingClientRect();
        const edge = 72;
        let speed = 0;
        if (current.y < bounds.top + edge) speed = -Math.ceil((bounds.top + edge - current.y) / 6);
        else if (current.y > bounds.bottom - edge) speed = Math.ceil((current.y - (bounds.bottom - edge)) / 6);
        if (speed !== 0) {
          scroller.scrollTop += speed;
          updateTargets(current.x, current.y, current);
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isDragging]);

  // Tapping anywhere that isn't a stat item or a control ends edit mode. It's
  // decided on release, and only for a tap — a swipe on the background still
  // just scrolls (nothing here calls preventDefault).
  useEffect(() => {
    if (!editMode) return;
    let start: { x: number; y: number } | null = null;
    function onDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const interactive = target?.closest(
        "[data-stat-item], [data-stat-action], button, a, input, textarea, select, label, [role='button']",
      );
      start = interactive ? null : { x: event.clientX, y: event.clientY };
    }
    function onUp(event: PointerEvent) {
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      start = null;
      if (moved <= TAP_TOLERANCE_PX) exitEditMode();
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
    };
  }, [editMode]);

  function updateHeaderText(id: string, text: string) {
    setLayout((prev) =>
      prev.map((item) => {
        if (item.type === "header" && item.id === id) return { ...item, text };
        if (item.type === "accordion" && item.id === id) return { ...item, title: text };
        return item;
      }),
    );
  }

  function registerRef(id: string) {
    return (el: HTMLElement | null) => {
      if (el) itemRefs.current.set(id, el);
      else itemRefs.current.delete(id);
    };
  }

  // During a card drag the lifted card's slot marker and empty slots just
  // appear where they belong; only cards slide out of the way.
  function jumps(id: string) {
    return isCardDrag && (id === dragId || id.startsWith("empty:"));
  }

  function cardBorder(card: StatCardValue | undefined) {
    const showLimitWarning = highlightRecommendedLimits && card?.outsideRecommendedRange === true;
    return editMode
      ? `border-[1.5px] border-dashed ${showLimitWarning ? "border-hf-red-dark" : "border-hf-black/40"}`
      : `border ${showLimitWarning ? "border-hf-red-dark" : "border-transparent"}`;
  }

  function accordionHeader(item: Extract<LayoutItem, { type: "accordion" }>, count: number) {
    return (
      <>
        <span className="hf-type-body hf-type-strong min-w-0 flex-1 truncate">{item.title}</span>
        <span className="hf-type-small text-text-secondary">{count}</span>
        <HfChevron direction={item.open ? "down" : "right"} />
      </>
    );
  }

  /** The lifted item under the finger: exactly how it looks in the grid while editing. */
  function renderLifted(item: LayoutItem) {
    if (item.type === "header") {
      return (
        <div className={`relative h-full w-full rounded-2xl px-3 py-2 ${EDIT_OUTLINE}`}>
          <RemoveCircleButton ariaLabel={t("statCardsGrid.removeHeading")} onRemove={() => undefined} />
          <HeadingContent text={item.text} />
        </div>
      );
    }
    if (item.type === "divider") {
      return (
        <div className={`relative flex h-full w-full items-center justify-center rounded-2xl ${EDIT_OUTLINE}`}>
          <div className="h-0.5 w-[80%] bg-hf-black" />
          <RemoveCircleButton ariaLabel={t("statCardsGrid.removeDivider")} onRemove={() => undefined} />
        </div>
      );
    }
    if (item.type === "accordion") {
      // The whole section travels, but only its header is under the finger.
      return (
        <div
          aria-expanded={item.open}
          className={`hf-control-row hf-selected-open relative flex h-full w-full items-center gap-2 rounded-2xl bg-hf-tan px-4 ${EDIT_OUTLINE}`}
        >
          <RemoveCircleButton ariaLabel={t("statCardsGrid.removeAccordion")} onRemove={() => undefined} />
          {accordionHeader(item, accordionCardCount(layout, item.id))}
        </div>
      );
    }
    if (item.type !== "stat") return null;
    const card = cardByKey.get(item.key);
    return (
      <div
        className={`relative h-full w-full rounded-2xl p-4 ${card || loading ? "bg-hf-tan" : "bg-hf-tan/50"} ${cardBorder(card)}`}
      >
        <RemoveCircleButton
          ariaLabel={t("nav.removeItemAriaLabel", { item: card?.label ?? item.key })}
          onRemove={() => undefined}
        />
        <StatCardFace card={card} noDataText={t("statCardsGrid.noData")} loading={loading} />
      </div>
    );
  }

  const itemBase = "relative select-none touch-pan-y [-webkit-touch-callout:none]";

  type RenderItem = (typeof renderItems)[number];

  function renderItem(item: RenderItem, index: number): ReactNode {
    const wobbleDelay = { animationDelay: `${(index % 3) * 60}ms` };

    if (item.type === "preview") {
      return (
        <div
          key="heading-preview"
          ref={(el) => {
            registerRef("heading-preview")(el);
            if (el && !el.dataset.entered) {
              el.dataset.entered = "1";
              el.animate(
                [
                  { height: "0px", opacity: 0 },
                  { height: `${drag?.height ?? 48}px`, opacity: 1 },
                ],
                { duration: REFLOW_MS, easing: REFLOW_EASING },
              );
            }
          }}
          aria-hidden="true"
          className={`hf-type-small col-span-2 flex items-center justify-center overflow-hidden rounded-2xl text-hf-black/50 ${EDIT_OUTLINE}`}
          style={{ height: drag?.height ?? 48 }}
        >
          {drag?.item.type === "header" ? drag.item.text : drag?.item.type === "accordion" ? drag.item.title : null}
        </div>
      );
    }

    const id = layoutItemId(item);

    if (item.type === "empty") {
      return (
        <div
          key={id}
          ref={registerRef(id)}
          data-slot-index={index}
          aria-hidden="true"
          className={`min-h-[76px] rounded-2xl border-[1.5px] border-dashed ${
            editMode ? "border-hf-black/40" : "border-transparent"
          }`}
        />
      );
    }

    if (item.type === "header") {
      return (
        <div
          key={id}
          ref={registerRef(id)}
          data-stat-item
          style={wobbleDelay}
          onPointerDown={(e) => onItemPointerDown(e, id, item)}
          className={`${itemBase} col-span-2 rounded-2xl border-[1.5px] px-1 py-2 ${
            editMode ? `stat-card-editing ${EDIT_OUTLINE} px-3` : "border-transparent"
          }`}
        >
          {editMode && (
            <RemoveCircleButton ariaLabel={t("statCardsGrid.removeHeading")} onRemove={() => removeItem(id)} />
          )}
          {editingHeaderId === item.id ? (
            <div className={GRID_SECTION_TITLE}>
              <input
                autoFocus
                value={item.text}
                size={Math.max(item.text.length, 1)}
                onChange={(e) => updateHeaderText(item.id, e.target.value)}
                onBlur={() => setEditingHeaderId(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="min-w-0 max-w-full select-text bg-transparent text-center outline-none"
                aria-label={t("statCardsGrid.renameHeading")}
              />
            </div>
          ) : (
            <HeadingContent text={item.text} />
          )}
        </div>
      );
    }

    if (item.type === "divider") {
      return (
        <div
          key={id}
          ref={registerRef(id)}
          data-stat-item
          style={wobbleDelay}
          onPointerDown={(e) => onItemPointerDown(e, id, item)}
          className={`${itemBase} col-span-2 flex h-5 items-center justify-center rounded-2xl border-[1.5px] ${
            editMode ? `stat-card-editing ${EDIT_OUTLINE}` : "border-transparent"
          }`}
        >
          <div className="h-0.5 w-[80%] bg-hf-black" />
          {editMode && (
            <RemoveCircleButton ariaLabel={t("statCardsGrid.removeDivider")} onRemove={() => removeItem(id)} />
          )}
        </div>
      );
    }

    // Section markers are drawn by renderAccordion, never on their own.
    if (item.type === "accordion" || item.type === "accordionEnd") return null;

    const card = cardByKey.get(item.key);

    if (id === dragId) {
      // The card itself floats under the finger. Its place in the grid
      // only marks where it lands, keeping the card's size so nothing
      // shifts when it is let go.
      return (
        <div
          key={id}
          ref={registerRef(id)}
          data-slot-index={index}
          aria-hidden="true"
          className={`relative rounded-2xl border-[1.5px] border-dashed p-4 ${
            slotTarget === null || accordionTarget !== null ? "border-hf-black/40" : "border-hf-black bg-hf-black/5"
          }`}
        >
          <div className="invisible">
            <StatCardFace card={card} noDataText={t("statCardsGrid.noData")} loading={loading} />
          </div>
        </div>
      );
    }

    return (
      <div
        key={id}
        ref={registerRef(id)}
        data-stat-item
        data-slot-index={index}
        style={wobbleDelay}
        onPointerDown={(e) => onItemPointerDown(e, id, item)}
        className={`${itemBase} rounded-2xl p-4 ${card || loading ? "bg-hf-tan" : "bg-hf-tan/50"} ${cardBorder(card)} ${
          editMode ? "stat-card-editing cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {editMode && (
          <RemoveCircleButton
            ariaLabel={t("nav.removeItemAriaLabel", { item: card?.label ?? item.key })}
            onRemove={() => removeItem(id)}
          />
        )}
        <StatCardFace card={card} noDataText={t("statCardsGrid.noData")} loading={loading} />
        {card && !editMode && (
          <CardUncertainty
            card={card}
            expanded={autoExpandUncertainty !== uncertaintyToggled.has(card.key)}
            onToggle={() => toggleUncertainty(card.key)}
          />
        )}
      </div>
    );
  }

  /**
   * A fold-out section: its header row (the lifted/edited item) and, when
   * open, its rows in a nested two-column grid. Neither wrapper is
   * positioned, so every item's offsets stay relative to the outer grid and
   * the drag maths need no special case for rows inside a section.
   */
  function renderAccordion(
    item: Extract<LayoutItem, { type: "accordion" }>,
    index: number,
    inner: ReactNode[],
    count: number,
  ): ReactNode {
    const id = layoutItemId(item);
    const wobbleDelay = { animationDelay: `${(index % 3) * 60}ms` };
    const isTarget = accordionTarget === item.id;
    return (
      <div
        key={id}
        className={`col-span-2 rounded-2xl border-[1.5px] bg-hf-tan ${
          editMode ? "border-dashed border-hf-black/40" : "border-transparent"
        }`}
      >
        <div
          ref={registerRef(id)}
          data-stat-item
          data-accordion-drop={item.open ? undefined : item.id}
          role="button"
          aria-expanded={item.open}
          style={wobbleDelay}
          onPointerDown={(e) => onItemPointerDown(e, id, item)}
          className={`${itemBase} hf-control-row hf-selected-open flex items-center gap-2 px-4 ${
            item.open ? "rounded-t-2xl" : "rounded-2xl"
          } ${editMode ? "stat-card-editing" : ""} ${
            isTarget ? "shadow-[inset_0_0_0_2px_var(--hf-black)]" : ""
          }`}
        >
          {editMode && (
            <RemoveCircleButton ariaLabel={t("statCardsGrid.removeAccordion")} onRemove={() => removeItem(id)} />
          )}
          {editingHeaderId === item.id ? (
            <input
              autoFocus
              value={item.title}
              onChange={(e) => updateHeaderText(item.id, e.target.value)}
              onBlur={() => setEditingHeaderId(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              className="hf-type-body hf-type-strong min-w-0 flex-1 select-text bg-transparent outline-none"
              aria-label={t("statCardsGrid.renameAccordion")}
            />
          ) : (
            <span className="hf-type-body hf-type-strong min-w-0 flex-1 truncate">{item.title}</span>
          )}
          <span className="hf-type-small text-text-secondary">{count}</span>
          <button
            type="button"
            data-stat-action
            aria-label={item.open ? t("statCardsGrid.closeAccordion") : t("statCardsGrid.openAccordion")}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              toggleAccordion(item.id);
            }}
            className="-mr-2 flex shrink-0 p-2"
          >
            <HfChevron direction={item.open ? "down" : "right"} />
          </button>
        </div>
        {item.open && (
          <div className="rounded-b-2xl bg-hf-cream p-3">
            <div className="grid grid-cols-2 gap-4">{inner}</div>
          </div>
        )}
      </div>
    );
  }

  /** Walks the flat list and nests each section's rows under its header. */
  function renderRange(items: RenderItem[], from: number, to: number): ReactNode[] {
    const nodes: ReactNode[] = [];
    let i = from;
    while (i < to) {
      const item = items[i];
      if (item.type === "accordion") {
        let end = items.findIndex((other, at) => at > i && other.type === "accordionEnd" && other.id === item.id);
        if (end < 0 || end > to) end = to;
        let count = 0;
        for (let k = i + 1; k < end; k += 1) if (items[k].type === "stat") count += 1;
        nodes.push(renderAccordion(item, i, item.open ? renderRange(items, i + 1, end) : [], count));
        i = end + 1;
        continue;
      }
      if (item.type !== "accordionEnd") nodes.push(renderItem(item, i));
      i += 1;
    }
    return nodes;
  }

  return (
    <div className="flex flex-col gap-4">
      <GridReflow items={renderItems} elements={itemRefs} settleFrom={settleRef} jumps={jumps}>
        <div
          ref={gridRef}
          className="relative grid grid-cols-2 gap-4"
          onContextMenu={(event) => {
            if (editMode || pendingRef.current) event.preventDefault();
          }}
        >
          {renderRange(renderItems, 0, renderItems.length)}
        </div>
      </GridReflow>

      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-2xl bg-hf-cream"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
            height: drag.height,
            boxShadow: LIFT_SHADOW,
          }}
        >
          {renderLifted(drag.item)}
        </div>
      )}
    </div>
  );
}
