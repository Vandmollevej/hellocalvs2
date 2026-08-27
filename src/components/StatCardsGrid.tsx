"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconGripVertical, IconX, type Icon } from "@tabler/icons-react";
import type { StatCardValue } from "@/lib/stat-cards";

type StatLayoutItem = { type: "stat"; key: string };
type HeaderLayoutItem = { type: "header"; id: string; text: string };
type LayoutItem = StatLayoutItem | HeaderLayoutItem;

const STORAGE_KEY = "hellocal.statistik.layout";

function layoutItemId(item: LayoutItem) {
  return item.type === "stat" ? `stat:${item.key}` : `header:${item.id}`;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}`;
}

function loadLayout(defaultLayout: LayoutItem[]): LayoutItem[] {
  if (typeof window === "undefined") return defaultLayout;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultLayout;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return defaultLayout;
  } catch {
    return defaultLayout;
  }
}

type DragSource =
  | { kind: "active"; id: string; item: LayoutItem }
  | { kind: "unused"; key: string }
  | { kind: "template" };

type DragState = {
  source: DragSource;
  label: string;
  icon?: Icon;
  x: number;
  y: number;
};

export function StatCardsGrid({
  cards,
  defaultActiveKeys,
}: {
  cards: StatCardValue[];
  defaultActiveKeys: string[];
}) {
  const cardByKey = useMemo(() => new Map(cards.map((c) => [c.key, c])), [cards]);
  const defaultLayout = useMemo<LayoutItem[]>(
    () => defaultActiveKeys.map((key) => ({ type: "stat", key })),
    [defaultActiveKeys],
  );

  const [layout, setLayout] = useState<LayoutItem[]>(() => loadLayout(defaultLayout));
  const [editMode, setEditMode] = useState(false);
  const [panelPosition, setPanelPosition] = useState<"above" | "below">("below");
  const [drag, setDrag] = useState<DragState | null>(null);
  const [overZone, setOverZone] = useState<"active" | "unused" | null>(null);

  const activeRefs = useRef(new Map<string, HTMLElement>());
  const gridRef = useRef<HTMLDivElement>(null);
  const unusedPanelRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // localStorage utilgængelig — ignorér.
    }
  }, [layout]);

  const activeKeys = useMemo(
    () => new Set(layout.filter((i): i is StatLayoutItem => i.type === "stat").map((i) => i.key)),
    [layout],
  );
  const unusedCards = useMemo(() => cards.filter((c) => !activeKeys.has(c.key)), [cards, activeKeys]);

  function enterEditMode() {
    setEditMode(true);
    const rect = gridRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setPanelPosition(spaceBelow >= spaceAbove ? "below" : "above");
    }
  }

  function exitEditMode() {
    setEditMode(false);
    setDrag(null);
    setOverZone(null);
  }

  function beginDrag(source: DragSource, label: string, icon: Icon | undefined, x: number, y: number) {
    setDrag({ source, label, icon, x, y });
  }

  function onCardPointerDown(
    event: React.PointerEvent,
    source: DragSource,
    label: string,
    icon?: Icon,
  ) {
    if (event.target instanceof HTMLInputElement) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    if (!editMode) {
      longPressTimer.current = window.setTimeout(() => {
        enterEditMode();
        beginDrag(source, label, icon, event.clientX, event.clientY);
      }, 500);
    } else {
      beginDrag(source, label, icon, event.clientX, event.clientY);
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
        // Trukket ud af det aktive gitter — fjern kortet (statistik-kort lægges tilbage i puljen).
        setLayout((prev) => prev.filter((i) => layoutItemId(i) !== source.id));
      }

      return null;
    });
    setOverZone(null);
  }

  useEffect(() => {
    function onMove(event: PointerEvent) {
      if (longPressTimer.current && pointerStart.current) {
        const dx = event.clientX - pointerStart.current.x;
        const dy = event.clientY - pointerStart.current.y;
        if (Math.hypot(dx, dy) > 10) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      setDrag((current) => {
        if (!current) return current;
        return { ...current, x: event.clientX, y: event.clientY };
      });

      const activeRect = gridRef.current?.getBoundingClientRect();
      const unusedRect = unusedPanelRef.current?.getBoundingClientRect();
      const inActive = activeRect
        ? event.clientX >= activeRect.left &&
          event.clientX <= activeRect.right &&
          event.clientY >= activeRect.top &&
          event.clientY <= activeRect.bottom
        : false;
      const inUnused = unusedRect
        ? event.clientX >= unusedRect.left &&
          event.clientX <= unusedRect.right &&
          event.clientY >= unusedRect.top &&
          event.clientY <= unusedRect.bottom
        : false;
      setOverZone(inActive ? "active" : inUnused ? "unused" : null);
    }

    function onUp(event: PointerEvent) {
      if (longPressTimer.current) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      pointerStart.current = null;
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
  }, [drag]);

  function updateHeaderText(id: string, text: string) {
    setLayout((prev) =>
      prev.map((item) => (item.type === "header" && item.id === id ? { ...item, text } : item)),
    );
  }

  const panel = (
    <div
      ref={unusedPanelRef}
      className={`rounded-2xl border border-hf-tan-dark p-3 transition-colors ${
        overZone === "unused" ? "bg-hf-tan" : "bg-hf-tan/90"
      }`}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
        Ubrugte kort
      </p>
      <div className="grid max-h-[45vh] grid-cols-2 gap-3 overflow-y-auto pb-2">
        {unusedCards.map((card) => {
          const CardIcon = card.icon;
          return (
            <div
              key={card.key}
              onPointerDown={(e) =>
                onCardPointerDown(e, { kind: "unused", key: card.key }, card.label, card.icon)
              }
              className="cursor-grab touch-none rounded-2xl bg-hf-white p-3 opacity-80 active:cursor-grabbing"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-hf-black opacity-60">{card.label}</p>
                <IconGripVertical size={14} className="opacity-40" />
              </div>
              <p className="hf-heading mt-1 flex items-center gap-1.5 text-lg text-hf-black">
                <CardIcon size={16} stroke={2} />
                {card.value}
              </p>
            </div>
          );
        })}
        {unusedCards.length === 0 && (
          <p className="col-span-2 py-2 text-center text-xs text-hf-black opacity-50">
            Alle kort er i brug
          </p>
        )}
      </div>

      <div className="mt-2 border-t border-hf-tan-dark pt-2">
        <div
          onPointerDown={(e) => onCardPointerDown(e, { kind: "template" }, "Overskrift")}
          className="flex min-h-11 cursor-grab touch-none items-center justify-center gap-2 rounded-xl border border-dashed border-hf-black/30 text-sm font-semibold text-hf-black opacity-70 active:cursor-grabbing"
        >
          <IconGripVertical size={14} />
          Overskrift
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="hf-heading text-sm text-hf-black opacity-70">Statistik-kort</p>
        {editMode && (
          <button
            type="button"
            onClick={exitEditMode}
            className="hf-btn-primary flex min-h-8 items-center gap-1 px-3 py-1 text-xs"
          >
            <IconCheck size={14} stroke={2.5} />
            Færdig
          </button>
        )}
      </div>

      {editMode && panelPosition === "above" && panel}

      <div ref={gridRef} className={`grid grid-cols-2 gap-3 ${editMode && overZone === "active" ? "rounded-2xl outline-2 outline-dashed outline-hf-green outline-offset-4" : ""}`}>
        {layout.map((item, index) => {
          const id = layoutItemId(item);
          const isDragging = drag?.source.kind === "active" && drag.source.id === id;

          if (item.type === "header") {
            return (
              <div
                key={id}
                ref={(el) => {
                  if (el) activeRefs.current.set(id, el);
                  else activeRefs.current.delete(id);
                }}
                style={{ animationDelay: `${(index % 3) * 60}ms` }}
                className={`col-span-2 flex items-center gap-2 rounded-2xl bg-hf-tan-dark px-4 py-3 ${
                  editMode ? "stat-card-editing" : ""
                } ${isDragging ? "opacity-30" : ""}`}
                onPointerDown={(e) => onCardPointerDown(e, { kind: "active", id, item }, item.text)}
              >
                {editMode ? (
                  <IconGripVertical size={16} className="shrink-0 opacity-50" />
                ) : null}
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

          const card = cardByKey.get(item.key);
          if (!card) return null;
          const CardIcon = card.icon;

          return (
            <div
              key={id}
              ref={(el) => {
                if (el) activeRefs.current.set(id, el);
                else activeRefs.current.delete(id);
              }}
              style={{ animationDelay: `${(index % 3) * 60}ms` }}
              onPointerDown={(e) => onCardPointerDown(e, { kind: "active", id, item }, card.label, card.icon)}
              className={`touch-none rounded-2xl bg-hf-tan p-4 ${editMode ? "stat-card-editing cursor-grab active:cursor-grabbing" : ""} ${
                isDragging ? "opacity-30" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-hf-black opacity-60">{card.label}</p>
                {editMode && <IconGripVertical size={14} className="opacity-40" />}
              </div>
              <p className="hf-heading mt-1 flex items-center gap-1.5 text-xl text-hf-black">
                {CardIcon && <CardIcon size={17} stroke={2} />}
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      {editMode && panelPosition === "below" && panel}

      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 flex items-center gap-1.5 rounded-xl bg-hf-black px-3 py-2 text-xs font-semibold text-hf-white shadow-xl"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {drag.icon && <drag.icon size={14} />}
          {drag.label}
        </div>
      )}
    </div>
  );
}
