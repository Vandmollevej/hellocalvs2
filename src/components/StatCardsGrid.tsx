"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IconPlus, IconX, type Icon } from "@tabler/icons-react";
import {
  loadStatLayout,
  saveStatLayout,
  type StatCardValue,
  type StatGridLayoutItem as LayoutItem,
} from "@/lib/stat-cards";
import { STAT_PERIODS, DEFAULT_STAT_PERIOD, type StatPeriodKey } from "@/lib/stat-periods";

function layoutItemId(item: LayoutItem) {
  return item.type === "stat" ? `stat:${item.key}` : `header:${item.id}`;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}

function periodLabel(key: StatPeriodKey) {
  return STAT_PERIODS.find((p) => p.key === key)?.label ?? "";
}

function cyclePeriod(key: StatPeriodKey, direction: 1 | -1): StatPeriodKey {
  const index = STAT_PERIODS.findIndex((p) => p.key === key);
  const nextIndex = (index + direction + STAT_PERIODS.length) % STAT_PERIODS.length;
  return STAT_PERIODS[nextIndex].key;
}

type DragSource =
  | { kind: "active"; id: string; item: LayoutItem }
  | { kind: "unused"; key: string }
  | { kind: "template" };

type DragContent =
  | { kind: "card"; card: StatCardValue }
  | { kind: "header"; text: string }
  | { kind: "pill"; label: string; icon?: Icon };

type DragState = {
  source: DragSource;
  content: DragContent;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

function CardTile({ card, floating }: { card: StatCardValue; floating?: boolean }) {
  const CardIcon = card.icon;
  return (
    <div className={`flex h-full w-full flex-col rounded-2xl bg-hf-tan p-4 ${floating ? "shadow-xl" : ""}`}>
      <p className="text-xs text-hf-black opacity-60">{card.label}</p>
      <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
        {CardIcon && <CardIcon size={17} stroke={2} />}
        {card.value}
      </p>
    </div>
  );
}

export function StatCardsGrid({
  cardsByPeriod,
  defaultActiveKeys,
}: {
  cardsByPeriod: Record<StatPeriodKey, StatCardValue[]>;
  defaultActiveKeys: string[];
}) {
  const cardByKeyByPeriod = useMemo(() => {
    const map = new Map<StatPeriodKey, Map<string, StatCardValue>>();
    for (const period of STAT_PERIODS) {
      map.set(period.key, new Map((cardsByPeriod[period.key] ?? []).map((c) => [c.key, c])));
    }
    return map;
  }, [cardsByPeriod]);

  const defaultLayout = useMemo<LayoutItem[]>(
    () => defaultActiveKeys.map((key) => ({ type: "stat", key })),
    [defaultActiveKeys],
  );

  const [layout, setLayout] = useState<LayoutItem[]>(() => loadStatLayout(defaultLayout));
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overZone, setOverZone] = useState<"active" | null>(null);
  const [periodByKey, setPeriodByKey] = useState<Record<string, StatPeriodKey>>({});
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);

  const activeRefs = useRef(new Map<string, HTMLElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const pointerDownInfo = useRef<{ x: number; y: number; source: DragSource } | null>(null);
  const isFirstRender = useRef(true);

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
      setLayout(loadStatLayout(defaultLayout));
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enterEditMode() {
    setEditMode(true);
  }

  function exitEditMode() {
    setEditMode(false);
    setDrag(null);
    setOverZone(null);
  }

  function beginDrag(source: DragSource, content: DragContent, x: number, y: number, rect: DOMRect) {
    setDrag({
      source,
      content,
      x,
      y,
      offsetX: x - rect.left,
      offsetY: y - rect.top,
      width: rect.width,
      height: rect.height,
    });
  }

  function onCardPointerDown(
    event: React.PointerEvent,
    source: DragSource,
    content: DragContent,
  ) {
    if (event.target instanceof HTMLInputElement) return;
    pointerDownInfo.current = { x: event.clientX, y: event.clientY, source };
    const rect = event.currentTarget.getBoundingClientRect();
    if (!editMode) {
      longPressTimer.current = window.setTimeout(() => {
        enterEditMode();
        beginDrag(source, content, event.clientX, event.clientY, rect);
      }, 500);
    } else {
      beginDrag(source, content, event.clientX, event.clientY, rect);
    }
  }

  function nearestInsertionIndex(x: number, y: number, excludeId?: string) {
    const entries = layout
      .map((item, index) => ({ item, index, id: layoutItemId(item) }))
      .filter((e) => e.id !== excludeId);
    if (entries.length === 0) return 0;

    let best = entries[0];
    let bestDist = Infinity;
    for (const entry of entries) {
      const el = activeRefs.current.get(entry.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < bestDist) {
        bestDist = dist;
        best = entry;
      }
    }

    const el = activeRefs.current.get(best.id);
    if (!el) return best.index;
    const rect = el.getBoundingClientRect();
    const after = x > rect.left + rect.width / 2;
    return after ? best.index + 1 : best.index;
  }

  function commitDrop(x: number, y: number) {
    setDrag((current) => {
      if (!current) return null;
      const { source } = current;
      const gridRect = gridRef.current?.getBoundingClientRect();
      const droppedOnActive = gridRect
        ? x >= gridRect.left && x <= gridRect.right && y >= gridRect.top && y <= gridRect.bottom
        : false;

      if (droppedOnActive) {
        const excludeId = source.kind === "active" ? source.id : undefined;
        const toIndex = nearestInsertionIndex(x, y, excludeId);
        setLayout((prev) => {
          const next = [...prev];
          let fromIndex = -1;
          let item: LayoutItem;
          if (source.kind === "active") {
            fromIndex = next.findIndex((i) => layoutItemId(i) === source.id);
            item = next[fromIndex];
            next.splice(fromIndex, 1);
          } else if (source.kind === "unused") {
            item = { type: "stat", key: source.key };
          } else {
            item = { type: "header", id: makeId(), text: "Overskrift" };
          }
          let insertAt = toIndex;
          if (fromIndex >= 0 && fromIndex < toIndex) insertAt -= 1;
          insertAt = Math.max(0, Math.min(insertAt, next.length));
          next.splice(insertAt, 0, item);
          return next;
        });
      } else if (source.kind === "active") {
        // Dragged out of the active grid — remove the card (stat card goes back into the pool).
        setLayout((prev) => prev.filter((i) => layoutItemId(i) !== source.id));
      }

      return null;
    });
    setOverZone(null);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const info = pointerDownInfo.current;

      if (longPressTimer.current && info) {
        const dx = event.clientX - info.x;
        const dy = event.clientY - info.y;
        if (Math.hypot(dx, dy) > 10) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }

      // A horizontal swipe on a stat card (outside edit mode) changes the period
      // instead of moving the card.
      if (
        !editMode &&
        !drag &&
        info &&
        info.source.kind === "active" &&
        info.source.item.type === "stat"
      ) {
        const dx = event.clientX - info.x;
        const dy = event.clientY - info.y;
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          setSwipe({ id: info.source.id, dx });
        }
      }

      setDrag((current) => {
        if (!current) return current;
        return { ...current, x: event.clientX, y: event.clientY };
      });

      const activeRect = gridRef.current?.getBoundingClientRect();
      const inActive = activeRect
        ? event.clientX >= activeRect.left &&
          event.clientX <= activeRect.right &&
          event.clientY >= activeRect.top &&
          event.clientY <= activeRect.bottom
        : false;
      setOverZone(inActive ? "active" : null);
    }

    function onUp(event: PointerEvent) {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      setSwipe((current) => {
        if (current && Math.abs(current.dx) > 40) {
          const key = current.id.startsWith("stat:") ? current.id.slice(5) : null;
          if (key) {
            const direction = current.dx < 0 ? 1 : -1;
            setPeriodByKey((prev) => ({
              ...prev,
              [key]: cyclePeriod(prev[key] ?? DEFAULT_STAT_PERIOD, direction),
            }));
          }
        }
        return null;
      });

      pointerDownInfo.current = null;
      commitDrop(event.clientX, event.clientY);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, editMode]);

  function updateHeaderText(id: string, text: string) {
    setLayout((prev) =>
      prev.map((item) => (item.type === "header" && item.id === id ? { ...item, text } : item)),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {editMode && (
        <button
          type="button"
          aria-label="Afslut redigering"
          onPointerDown={(event) => {
            // Backdrop, like the dropdown pattern in StatChart: tapping outside the cards exits edit mode.
            event.stopPropagation();
            exitEditMode();
          }}
          className="fixed inset-0 z-30 cursor-default"
        />
      )}

      <div className="relative z-40 flex items-center justify-between gap-2">
        <p className="hf-heading text-sm text-hf-black opacity-70">Statistik-kort</p>
        <div className="flex items-center gap-2">
          {editMode && (
            <button
              type="button"
              onPointerDown={(e) =>
                onCardPointerDown(e, { kind: "template" }, { kind: "header", text: "Overskrift" })
              }
              className="flex min-h-8 cursor-grab touch-none select-none items-center rounded-full border border-dashed border-hf-black/30 px-3 py-1 text-xs font-semibold text-hf-black opacity-70 active:cursor-grabbing"
            >
              Overskrift
            </button>
          )}
          <Link
            href="/statistics/unused-cards"
            onPointerDown={(event) => event.stopPropagation()}
            className="hf-btn-primary flex min-h-8 items-center gap-1 px-3 py-1 text-xs"
          >
            <IconPlus size={14} stroke={2.5} />
            Tilføj kort
          </Link>
        </div>
      </div>

      <div
        ref={gridRef}
        className={`relative z-40 grid grid-cols-2 gap-3 ${editMode && overZone === "active" ? "rounded-2xl outline-2 outline-dashed outline-hf-green outline-offset-4" : ""}`}
      >
        {layout.map((item, index) => {
          const id = layoutItemId(item);
          const isDragging = drag?.source.kind === "active" && drag.source.id === id;
          const swipeDx = swipe && swipe.id === id ? swipe.dx : null;
          const isSwiping = swipeDx !== null;

          if (item.type === "header") {
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) activeRefs.current.set(id, el);
                  else activeRefs.current.delete(id);
                }}
                style={{ animationDelay: `${(index % 3) * 60}ms` }}
                className={`col-span-2 flex items-center gap-2 rounded-2xl bg-hf-tan-dark px-4 py-3 select-none ${
                  editMode ? "stat-card-editing border-2 border-dashed border-hf-black/30" : ""
                } ${isDragging ? "opacity-0" : ""}`}
                onPointerDown={(e) =>
                  onCardPointerDown(e, { kind: "active", id, item }, { kind: "header", text: item.text })
                }
              >
                <input
                  value={item.text}
                  onChange={(e) => updateHeaderText(item.id, e.target.value)}
                  disabled={!editMode}
                  className="hf-heading w-full bg-transparent text-sm text-hf-black outline-none disabled:opacity-100"
                  aria-label="Omdøb overskrift"
                />
                {editMode && (
                  <button
                    type="button"
                    aria-label="Fjern overskrift"
                    onClick={() => setLayout((prev) => prev.filter((i) => layoutItemId(i) !== id))}
                    className="shrink-0 rounded-full p-1 opacity-60 hover:opacity-100"
                  >
                    <IconX size={16} />
                  </button>
                )}
              </div>
            );
          }

          const period = periodByKey[item.key] ?? DEFAULT_STAT_PERIOD;
          const card = cardByKeyByPeriod.get(period)?.get(item.key);
          if (!card) return null;
          const CardIcon = card.icon;

          return (
            <div
              key={id}
              ref={(el) => {
                if (el) activeRefs.current.set(id, el);
                else activeRefs.current.delete(id);
              }}
              style={{
                animationDelay: `${(index % 3) * 60}ms`,
                transform: swipeDx !== null ? `translateX(${swipeDx}px)` : undefined,
              }}
              onPointerDown={(e) =>
                onCardPointerDown(e, { kind: "active", id, item }, { kind: "card", card })
              }
              className={`touch-none select-none rounded-2xl bg-hf-tan p-4 ${!isSwiping ? "transition-transform" : ""} ${
                editMode ? "stat-card-editing cursor-grab border-2 border-dashed border-hf-black/30 active:cursor-grabbing" : ""
              } ${isDragging ? "opacity-0" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-hf-black opacity-60">{card.label}</p>
              </div>
              <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
                {CardIcon && <CardIcon size={17} stroke={2} />}
                {card.value}
              </p>
              {!editMode && (
                <p className="mt-0.5 text-[10px] font-normal text-hf-black opacity-50">
                  {periodLabel(period)}
                </p>
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
            <CardTile card={drag.content.card} floating />
          ) : drag.content.kind === "header" ? (
            <div className="flex h-full w-full items-center gap-2 rounded-2xl bg-hf-tan-dark px-4 py-3 shadow-xl">
              <span className="hf-heading text-sm text-hf-black">{drag.content.text}</span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center gap-1.5 rounded-full bg-hf-black px-3 py-2 text-xs font-semibold text-hf-white shadow-xl">
              {drag.content.icon && <drag.content.icon size={14} />}
              {drag.content.label}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
