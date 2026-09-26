"use client";

import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  isHalfWidthStatItem,
  loadStatLayout,
  makeEmptyStatSlot,
  normalizeStatLayout,
  saveStatLayout,
  type StatCardValue,
  type StatGridLayoutItem as LayoutItem,
} from "@/lib/stat-cards";
import { useTranslation } from "@/i18n/LocaleProvider";
import { StatCardIcon } from "@/components/StatCardIcon";
import { RemoveCircleButton } from "@/components/ui/RemoveCircleButton";

// The grid is two columns of physical slots: a run of half-width items (cards
// and explicit empty slots) always has an even length, so every item's index
// maps to a fixed left/right position and CSS grid never packs cards to the
// left. Headers and dividers span a full row between those runs.
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

/** While editing there is always one free row at the bottom, so a card can be moved further down. */
function withTrailingEmptyRow(layout: LayoutItem[]) {
  const n = layout.length;
  const hasEmptyRow =
    n >= 2 &&
    layout[n - 1].type === "empty" &&
    layout[n - 2].type === "empty" &&
    rowStarts(layout).includes(n - 2);
  return hasEmptyRow ? layout : [...layout, makeEmptyStatSlot(), makeEmptyStatSlot()];
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

function StatCardFace({ card, noDataText }: { card: StatCardValue | undefined; noDataText: string }) {
  if (!card) {
    // The key is a real, saved part of the layout (e.g. a sport-activity
    // card with no data in the currently selected period) — keep its slot.
    return <p className="text-xs text-hf-black opacity-40">{noDataText}</p>;
  }
  return (
    <>
      <p className="text-xs text-hf-black opacity-60">{card.label}</p>
      <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
        <StatCardIcon icon={card.icon} iconSrc={card.iconSrc} />
        {card.value}
      </p>
    </>
  );
}

function HeadingContent({ text }: { text: string }) {
  return (
    <>
      <p className="hf-heading text-sm text-hf-black">{text}</p>
      <div className="mt-2 h-px w-full bg-hf-gray-border" />
    </>
  );
}

export function StatCardsGrid({
  cards,
  defaultActiveKeys,
  highlightRecommendedLimits = false,
}: {
  cards: StatCardValue[];
  defaultActiveKeys: string[];
  highlightRecommendedLimits?: boolean;
}) {
  const { t } = useTranslation();
  const cardByKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);

  const defaultLayout = useMemo<LayoutItem[]>(
    () => defaultActiveKeys.map((key) => ({ type: "stat", key })),
    [defaultActiveKeys],
  );

  // The saved layout lives in localStorage, which the server can't see: render
  // the default first (matching the server HTML) and switch after mount.
  const [layout, setLayout] = useState<LayoutItem[]>(() => normalizeStatLayout(defaultLayout));
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Card drag: the slot (layout index) the card lands in — null while the
  // finger is outside the grid, where letting go takes the card off. Header/
  // divider drag: the row boundary (index into the row starts) where the
  // dashed placeholder sits.
  const [slotTarget, setSlotTarget] = useState<number | null>(null);
  const [headingBoundary, setHeadingBoundary] = useState<number | null>(null);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const itemRefs = useRef(new Map<string, HTMLElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingPress | null>(null);
  const settleRef = useRef<{ id: string; position: Position } | null>(null);
  const isFirstRender = useRef(true);

  // Latest values for the window-level pointer listeners, which are bound once.
  const stateRef = useRef({ layout, editMode, drag, headingBoundary, slotTarget });
  useLayoutEffect(() => {
    stateRef.current = { layout, editMode, drag, headingBoundary, slotTarget };
  });

  const dragId = drag?.id ?? null;
  const dragItem = drag?.item ?? null;
  const isCardDrag = dragItem !== null && isHalfWidthStatItem(dragItem);

  // What is rendered while something is lifted: the grid as it will be once
  // it is let go (see the comment at the top).
  const renderItems = useMemo<(LayoutItem | { type: "preview" })[]>(() => {
    if (!dragId || !dragItem) return layout;
    if (isHalfWidthStatItem(dragItem)) {
      const from = layout.findIndex((item) => layoutItemId(item) === dragId);
      const to = slotTarget ?? from;
      if (from < 0 || to === from || to >= layout.length) return layout;
      const next = [...layout];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    }
    const rest = layout.filter((item) => layoutItemId(item) !== dragId);
    if (headingBoundary === null) return rest;
    const starts = rowStarts(rest);
    const insertAt = headingBoundary < starts.length ? starts[headingBoundary] : rest.length;
    return [...rest.slice(0, insertAt), { type: "preview" as const }, ...rest.slice(insertAt)];
  }, [layout, dragId, dragItem, headingBoundary, slotTarget]);

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

  function enterEditMode() {
    setEditMode(true);
    setLayout((prev) => withTrailingEmptyRow(prev));
  }

  function exitEditMode() {
    setEditMode(false);
    setDrag(null);
    setSlotTarget(null);
    setHeadingBoundary(null);
    setEditingHeaderId(null);
    setLayout((prev) => normalizeStatLayout(prev));
  }

  function removeItem(id: string) {
    setLayout((prev) =>
      prev.flatMap((item) => {
        if (layoutItemId(item) !== id) return [item];
        // A card leaves its slot empty — the rest of the grid must not shift.
        return item.type === "stat" ? [makeEmptyStatSlot()] : [];
      }),
    );
  }

  function startDrag(press: PendingPress, x: number, y: number) {
    const current = stateRef.current.layout;
    const index = current.findIndex((item) => layoutItemId(item) === press.id);
    let boundary: number | null = null;
    if (!isHalfWidthStatItem(press.item)) {
      const rest = current.filter((item) => layoutItemId(item) !== press.id);
      const starts = rowStarts(rest);
      const at = starts.indexOf(index);
      boundary = at >= 0 ? at : starts.length;
    }
    setEditingHeaderId(null);
    setHeadingBoundary(boundary);
    setSlotTarget(isHalfWidthStatItem(press.item) && index >= 0 ? index : null);
    setDrag({
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
      // Crossing the gap between two slots (or a header) keeps the last slot,
      // so the grid doesn't flicker; back inside the grid it is at least the
      // card's own slot again.
      if (hit !== null) setSlotTarget(hit);
      else if (stateRef.current.slotTarget === null) {
        const own = stateRef.current.layout.findIndex((item) => layoutItemId(item) === current.id);
        setSlotTarget(own >= 0 ? own : null);
      }
      return;
    }

    // Header/divider: the boundary is the number of rows whose center lies
    // above the finger. Rows below the placeholder only ever move further
    // down, so the choice is stable while it shifts them.
    const rest = stateRef.current.layout.filter((item) => layoutItemId(item) !== current.id);
    let boundary = 0;
    for (const start of rowStarts(rest)) {
      const el = itemRefs.current.get(layoutItemId(rest[start]));
      if (!el) continue;
      if (gridRect.top + el.offsetTop + el.offsetHeight / 2 < y) boundary += 1;
    }
    setHeadingBoundary(boundary);
  }

  /**
   * Lets go of the lifted item. It lands where the grid already shows it and
   * glides there from under the finger; a cancelled drag glides back home. A
   * card let go outside the grid is taken off and simply disappears.
   */
  function drop(current: DragState, cancelled: boolean) {
    const { layout: currentLayout, headingBoundary: boundary, slotTarget: target } = stateRef.current;
    const isCard = isHalfWidthStatItem(current.item);
    const from = currentLayout.findIndex((item) => layoutItemId(item) === current.id);

    if (!cancelled && isCard && target === null) {
      removeItem(current.id);
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
      } else if (!cancelled && !isCard && boundary !== null) {
        const rest = currentLayout.filter((item) => layoutItemId(item) !== current.id);
        const starts = rowStarts(rest);
        const insertAt = boundary < starts.length ? starts[boundary] : rest.length;
        setLayout([...rest.slice(0, insertAt), current.item, ...rest.slice(insertAt)]);
      }
    }

    setDrag(null);
    setSlotTarget(null);
    setHeadingBoundary(null);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const press = pendingRef.current;
      const current = stateRef.current.drag;

      if (press && !current) {
        const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
        if (moved <= MOVE_TOLERANCE_PX) return;
        if (press.timer) window.clearTimeout(press.timer);
        pendingRef.current = null;
        // Mouse in edit mode: moving is the drag. Touch: moving first is a scroll.
        if (stateRef.current.editMode && press.pointerType === "mouse") {
          startDrag(press, event.clientX, event.clientY);
        }
        return;
      }

      if (!current) return;
      setDrag({ ...current, x: event.clientX, y: event.clientY });
      updateTargets(event.clientX, event.clientY, current);
    }

    function onUp() {
      const press = pendingRef.current;
      const current = stateRef.current.drag;
      if (press?.timer) window.clearTimeout(press.timer);
      pendingRef.current = null;

      if (current) {
        drop(current, false);
        return;
      }
      // A short tap on a header's title while editing renames it.
      if (press && stateRef.current.editMode && press.item.type === "header") {
        setEditingHeaderId(press.item.id);
      }
    }

    function onCancel() {
      if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
      const current = stateRef.current.drag;
      if (current) drop(current, true);
    }

    // Items use `touch-action: pan-y` so a swipe on them scrolls the page. Only
    // once an item has actually been lifted does the page stop scrolling.
    function onTouchMove(event: TouchEvent) {
      if (stateRef.current.drag && event.cancelable) event.preventDefault();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
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
      const current = stateRef.current.drag;
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
      prev.map((item) => (item.type === "header" && item.id === id ? { ...item, text } : item)),
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
    if (item.type !== "stat") return null;
    const card = cardByKey.get(item.key);
    return (
      <div
        className={`relative h-full w-full rounded-2xl p-4 ${card ? "bg-hf-tan" : "bg-hf-tan/50"} ${cardBorder(card)}`}
      >
        <RemoveCircleButton
          ariaLabel={t("nav.removeItemAriaLabel", { item: card?.label ?? item.key })}
          onRemove={() => undefined}
        />
        <StatCardFace card={card} noDataText={t("statCardsGrid.noData")} />
      </div>
    );
  }

  const itemBase = "relative select-none touch-pan-y [-webkit-touch-callout:none]";

  return (
    <div className="flex flex-col gap-3">
      <GridReflow items={renderItems} elements={itemRefs} settleFrom={settleRef} jumps={jumps}>
        <div
          ref={gridRef}
          className="relative grid grid-cols-2 gap-3"
          onContextMenu={(event) => {
            if (editMode || pendingRef.current) event.preventDefault();
          }}
        >
          {renderItems.map((item, index) => {
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
                  className={`col-span-2 flex items-center justify-center overflow-hidden rounded-2xl text-xs text-hf-black/50 ${EDIT_OUTLINE}`}
                  style={{ height: drag?.height ?? 48 }}
                >
                  {drag?.item.type === "header" ? drag.item.text : null}
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
                    <>
                      <input
                        autoFocus
                        value={item.text}
                        onChange={(e) => updateHeaderText(item.id, e.target.value)}
                        onBlur={() => setEditingHeaderId(null)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className="hf-heading w-full select-text bg-transparent text-sm text-hf-black outline-none"
                        aria-label={t("statCardsGrid.renameHeading")}
                      />
                      <div className="mt-2 h-px w-full bg-hf-gray-border" />
                    </>
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
                    slotTarget === null ? "border-hf-black/40" : "border-hf-black bg-hf-black/5"
                  }`}
                >
                  <div className="invisible">
                    <StatCardFace card={card} noDataText={t("statCardsGrid.noData")} />
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
                className={`${itemBase} rounded-2xl p-4 ${card ? "bg-hf-tan" : "bg-hf-tan/50"} ${cardBorder(card)} ${
                  editMode ? "stat-card-editing cursor-grab active:cursor-grabbing" : ""
                }`}
              >
                {editMode && (
                  <RemoveCircleButton
                    ariaLabel={t("nav.removeItemAriaLabel", { item: card?.label ?? item.key })}
                    onRemove={() => removeItem(id)}
                  />
                )}
                <StatCardFace card={card} noDataText={t("statCardsGrid.noData")} />
              </div>
            );
          })}
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
