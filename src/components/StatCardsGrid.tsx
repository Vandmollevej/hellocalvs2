"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";
import { UncertaintyLine } from "@/components/ui/UncertaintyLine";
import { RemoveCircleButton } from "@/components/ui/RemoveCircleButton";

// The grid is two columns of physical slots: a run of half-width items (cards
// and explicit empty slots) always has an even length, so every item's index
// maps to a fixed left/right position and CSS grid never packs cards to the
// left. Headers and dividers span a full row between those runs.

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

type DragContent =
  | { kind: "card"; card: StatCardValue }
  | { kind: "header"; text: string }
  | { kind: "divider" }
  | { kind: "pill"; label: string };

type DragState = {
  id: string;
  item: LayoutItem;
  content: DragContent;
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
  content: DragContent;
  startX: number;
  startY: number;
  pointerType: string;
  rect: DOMRect;
  timer: number | null;
};

// Long-press before an item lifts: outside edit mode it also enters edit
// mode. Moving the finger further than the tolerance first means the user is
// scrolling, so the press is dropped and the browser keeps the gesture.
const ENTER_EDIT_DELAY_MS = 500;
const DRAG_DELAY_MS = 250;
const MOVE_TOLERANCE_PX = 8;
const TAP_TOLERANCE_PX = 10;
const REFLOW_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const EDIT_OUTLINE = "border-[1.5px] border-dashed border-hf-black/40";

function CardTile({
  card,
  floating,
  highlightRecommendedLimits = false,
}: {
  card: StatCardValue;
  floating?: boolean;
  highlightRecommendedLimits?: boolean;
}) {
  const showLimitWarning = highlightRecommendedLimits && card.outsideRecommendedRange === true;
  return (
    <div
      className={`flex h-full w-full flex-col rounded-2xl bg-hf-tan p-4 ${
        showLimitWarning ? "border border-hf-red-dark" : "border border-transparent"
      } ${floating ? "shadow-xl" : ""}`}
    >
      <p className="hf-type-small text-text-secondary">{card.label}</p>
      <p className="hf-type-body-lg hf-heading mt-1 flex items-center gap-1.5 text-hf-black">
        <StatCardIcon icon={card.icon} iconSrc={card.iconSrc} />
        <span>
          {card.uncertainty?.estimated ? <UncertaintyTilde /> : null}
          {card.value}
        </span>
      </p>
    </div>
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

function HeadingContent({ text }: { text: string }) {
  return (
    <>
      <p className="hf-type-body hf-heading text-hf-black">{text}</p>
      <div className="mt-2 h-px w-full bg-hf-gray-border" />
    </>
  );
}

export function StatCardsGrid({
  cards,
  defaultActiveKeys,
  highlightRecommendedLimits = false,
  autoExpandUncertainty = false,
  onShowAddChange,
}: {
  cards: StatCardValue[];
  defaultActiveKeys: string[];
  highlightRecommendedLimits?: boolean;
  autoExpandUncertainty?: boolean;
  /** True while editing — or when the grid is empty, so cards can always be added back. */
  onShowAddChange?: (show: boolean) => void;
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

  // The saved layout lives in localStorage, which the server can't see: render
  // the default first (matching the server HTML) and switch after mount.
  const [layout, setLayout] = useState<LayoutItem[]>(() => normalizeStatLayout(defaultLayout));
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Card drag: the slot under the finger. Header/divider drag: the row
  // boundary (index into the row starts) where the dashed preview sits.
  const [slotTarget, setSlotTarget] = useState<string | null>(null);
  const [headingBoundary, setHeadingBoundary] = useState<number | null>(null);
  const [editingHeaderId, setEditingHeaderId] = useState<string | null>(null);

  const itemRefs = useRef(new Map<string, HTMLElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingPress | null>(null);
  const isFirstRender = useRef(true);
  // FLIP-style reorder animation, mirroring BottomNav.tsx's icon-reorder
  // mechanism: rects are captured each time the effect runs and diffed against
  // the freshly-measured post-render position, so every item that shifts
  // (including rows making room for a header preview) slides there instead of
  // teleporting.
  const prevRectsRef = useRef(new Map<string, DOMRect>());

  // Latest values for the window-level pointer listeners, which are bound once.
  const stateRef = useRef({ layout, editMode, drag, headingBoundary, slotTarget });
  useLayoutEffect(() => {
    stateRef.current = { layout, editMode, drag, headingBoundary, slotTarget };
  });

  // What is rendered: while a header/divider is dragged it leaves its spot and a
  // dashed placeholder appears at the row boundary it would drop into.
  const renderItems = useMemo<(LayoutItem | { type: "preview" })[]>(() => {
    if (!drag || isHalfWidthStatItem(drag.item)) return layout;
    const rest = layout.filter((item) => layoutItemId(item) !== drag.id);
    if (headingBoundary === null) return rest;
    const starts = rowStarts(rest);
    const insertAt = headingBoundary < starts.length ? starts[headingBoundary] : rest.length;
    return [...rest.slice(0, insertAt), { type: "preview" as const }, ...rest.slice(insertAt)];
  }, [layout, drag, headingBoundary]);

  const hasItems = layout.some((item) => item.type !== "empty");
  useEffect(() => {
    onShowAddChange?.(editMode || !hasItems);
  }, [editMode, hasItems, onShowAddChange]);

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

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    itemRefs.current.forEach((el, id) => nextRects.set(id, el.getBoundingClientRect()));

    itemRefs.current.forEach((el, id) => {
      const prev = prevRectsRef.current.get(id);
      const next = nextRects.get(id);
      if (!prev || !next) return; // newly inserted item — no previous position to animate from
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

      // Edit mode's continuous "wobble" animation also drives `transform`, and an
      // animation wins over an inline transform — so it has to be suspended for
      // the slide to actually be visible, then handed back afterwards.
      el.style.animation = "none";
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      // Force layout so the transform above applies before we animate away from it.
      void el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = `transform 180ms ${REFLOW_EASING}`;
        el.style.transform = "";
      });
      window.setTimeout(() => {
        el.style.transition = "";
        el.style.animation = "";
      }, 220);
    });

    prevRectsRef.current = nextRects;
  }, [renderItems]);

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
    let boundary: number | null = null;
    if (!isHalfWidthStatItem(press.item)) {
      const index = current.findIndex((item) => layoutItemId(item) === press.id);
      const rest = current.filter((item) => layoutItemId(item) !== press.id);
      const starts = rowStarts(rest);
      const at = starts.indexOf(index);
      boundary = at >= 0 ? at : starts.length;
    }
    setEditingHeaderId(null);
    setHeadingBoundary(boundary);
    setSlotTarget(null);
    setDrag({
      id: press.id,
      item: press.item,
      content: press.content,
      x,
      y,
      offsetX: press.startX - press.rect.left,
      offsetY: press.startY - press.rect.top,
      width: press.rect.width,
      height: press.rect.height,
    });
  }

  function onItemPointerDown(event: React.PointerEvent, id: string, item: LayoutItem, content: DragContent) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-stat-action], input")) return;
    if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);

    const press: PendingPress = {
      id,
      item,
      content,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      rect: event.currentTarget.getBoundingClientRect(),
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
    if (isHalfWidthStatItem(current.item)) {
      const hit = document.elementFromPoint(x, y);
      const slot = hit instanceof HTMLElement ? hit.closest<HTMLElement>("[data-stat-slot]") : null;
      const target = slot?.dataset.statId ?? null;
      setSlotTarget(target && target !== current.id ? target : null);
      return;
    }
    // Header/divider: the boundary is the number of rows whose center lies
    // above the finger. Rows below the preview only ever move further down,
    // so the choice is stable while the preview shifts them.
    const rest = stateRef.current.layout.filter((item) => layoutItemId(item) !== current.id);
    const starts = rowStarts(rest);
    let boundary = 0;
    for (const start of starts) {
      const el = itemRefs.current.get(layoutItemId(rest[start]));
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top + rect.height / 2 < y) boundary += 1;
    }
    setHeadingBoundary(boundary);
  }

  function commitDrop(current: DragState, x: number, y: number) {
    const { layout: currentLayout, headingBoundary: boundary, slotTarget: target } = stateRef.current;

    if (!isHalfWidthStatItem(current.item)) {
      if (boundary === null) return;
      const rest = currentLayout.filter((item) => layoutItemId(item) !== current.id);
      const starts = rowStarts(rest);
      const insertAt = boundary < starts.length ? starts[boundary] : rest.length;
      setLayout([...rest.slice(0, insertAt), current.item, ...rest.slice(insertAt)]);
      return;
    }

    if (target) {
      // Card onto a card or an empty slot: the two swap places, so an empty
      // slot keeps existing where the card came from.
      const from = currentLayout.findIndex((item) => layoutItemId(item) === current.id);
      const to = currentLayout.findIndex((item) => layoutItemId(item) === target);
      if (from < 0 || to < 0) return;
      const next = [...currentLayout];
      [next[from], next[to]] = [next[to], next[from]];
      setLayout(next);
      return;
    }

    const gridRect = gridRef.current?.getBoundingClientRect();
    const insideGrid = gridRect
      ? x >= gridRect.left && x <= gridRect.right && y >= gridRect.top && y <= gridRect.bottom
      : true;
    if (!insideGrid && current.item.type === "stat") removeItem(current.id);
  }

  function endDrag() {
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

    function onUp(event: PointerEvent) {
      const press = pendingRef.current;
      const current = stateRef.current.drag;
      if (press?.timer) window.clearTimeout(press.timer);
      pendingRef.current = null;

      if (current) {
        commitDrop(current, event.clientX, event.clientY);
        endDrag();
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
      if (stateRef.current.drag) endDrag();
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

  const itemBase = "relative select-none touch-pan-y [-webkit-touch-callout:none]";

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={gridRef}
        className="relative grid grid-cols-2 gap-4"
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
                      { duration: 180, easing: REFLOW_EASING },
                    );
                  }
                }}
                aria-hidden="true"
                className={`hf-type-small col-span-2 flex items-center justify-center overflow-hidden rounded-2xl text-hf-black/50 ${EDIT_OUTLINE}`}
                style={{ height: drag?.height ?? 48 }}
              >
                {drag?.content.kind === "header" ? drag.content.text : null}
              </div>
            );
          }

          const id = layoutItemId(item);
          const isDragged = drag?.id === id;

          if (item.type === "empty") {
            const isTarget = slotTarget === id;
            return (
              <div
                key={id}
                ref={registerRef(id)}
                data-stat-slot
                data-stat-id={id}
                aria-hidden="true"
                className={`min-h-[76px] rounded-2xl border-[1.5px] border-dashed ${
                  !editMode
                    ? "border-transparent"
                    : isTarget
                      ? "border-hf-black bg-hf-black/5"
                      : "border-hf-black/40"
                }`}
              />
            );
          }

          if (item.type === "header") {
            const content: DragContent = { kind: "header", text: item.text };
            return (
              <div
                key={id}
                ref={registerRef(id)}
                data-stat-item
                style={wobbleDelay}
                onPointerDown={(e) => onItemPointerDown(e, id, item, content)}
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
                      className="hf-type-body hf-heading w-full select-text bg-transparent text-hf-black outline-none"
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
                onPointerDown={(e) => onItemPointerDown(e, id, item, { kind: "divider" })}
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
          const isTarget = slotTarget === id;
          const label = card?.label ?? item.key;
          const showLimitWarning = highlightRecommendedLimits && card?.outsideRecommendedRange === true;
          const border = editMode
            ? `border-[1.5px] border-dashed ${
                isTarget ? "border-hf-black" : showLimitWarning ? "border-hf-red-dark" : "border-hf-black/40"
              }`
            : `border ${showLimitWarning ? "border-hf-red-dark" : "border-transparent"}`;

          return (
            <div
              key={id}
              ref={registerRef(id)}
              data-stat-item
              data-stat-slot
              data-stat-id={id}
              style={wobbleDelay}
              onPointerDown={(e) =>
                onItemPointerDown(e, id, item, card ? { kind: "card", card } : { kind: "pill", label })
              }
              className={`${itemBase} rounded-2xl p-4 ${card ? "bg-hf-tan" : "bg-hf-tan/50"} ${border} ${
                editMode ? "stat-card-editing cursor-grab active:cursor-grabbing" : ""
              } ${isDragged ? "opacity-40" : ""}`}
            >
              {editMode && (
                <RemoveCircleButton
                  ariaLabel={t("nav.removeItemAriaLabel", { item: label })}
                  onRemove={() => removeItem(id)}
                />
              )}
              {card ? (
                <>
                  <p className="hf-type-small text-text-secondary">{card.label}</p>
                  <p className="hf-type-body-lg hf-heading mt-1 flex items-center gap-1.5 text-hf-black">
                    <StatCardIcon icon={card.icon} iconSrc={card.iconSrc} />
                    <span>
                      {card.uncertainty?.estimated ? <UncertaintyTilde /> : null}
                      {card.value}
                    </span>
                  </p>
                  {!editMode && (
                    <CardUncertainty
                      card={card}
                      expanded={autoExpandUncertainty !== uncertaintyToggled.has(card.key)}
                      onToggle={() => toggleUncertainty(card.key)}
                    />
                  )}
                </>
              ) : (
                // The key is a real, saved part of the layout (e.g. a sport-activity
                // card with no data in the currently selected period) — keep its slot.
                <p className="hf-type-small text-text-muted">{t("statCardsGrid.noData")}</p>
              )}
            </div>
          );
        })}
      </div>

      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50"
          style={{
            left: drag.x - drag.offsetX,
            top: drag.y - drag.offsetY,
            width: drag.width,
            height: drag.height,
          }}
        >
          {drag.content.kind === "card" ? (
            <CardTile
              card={drag.content.card}
              floating
              highlightRecommendedLimits={highlightRecommendedLimits}
            />
          ) : drag.content.kind === "header" ? (
            <div className="h-full w-full rounded-2xl bg-hf-tan px-3 py-2 shadow-xl">
              <HeadingContent text={drag.content.text} />
            </div>
          ) : drag.content.kind === "divider" ? (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-hf-tan shadow-xl">
              <div className="h-0.5 w-[80%] bg-hf-black" />
            </div>
          ) : (
            <div className="hf-type-small flex h-full w-full items-center justify-center rounded-2xl bg-hf-tan/80 p-4 text-hf-black shadow-xl">
              {drag.content.label}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
