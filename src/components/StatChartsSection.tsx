"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RemoveCircleButton } from "@/components/ui/RemoveCircleButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import { loadChartLayout, saveChartLayout, statChartDef, DEFAULT_ACTIVE_CHART_KEYS } from "@/lib/stat-charts";

// Graferne øverst på statistiksiden, med samme redigeringsgreb som
// StatCardsGrid: et langt tryk får graferne til at vibrere, et kort tryk på
// baggrunden afslutter, slette-cirklen fjerner en graf, og en løftet graf kan
// trækkes op/ned i listen. Rækkefølgen gemmes via src/lib/stat-charts.ts.

const ENTER_EDIT_DELAY_MS = 500;
const DRAG_DELAY_MS = 250;
const MOVE_TOLERANCE_PX = 8;
const TAP_TOLERANCE_PX = 10;
const REFLOW_EASING = "cubic-bezier(0.2, 0, 0, 1)";

type Pending = { key: string; startX: number; startY: number; pointerType: string; timer: number | null };
type Drag = { key: string; offsetY: number; y: number };

export function StatChartsSection({
  renderChart,
  onShowAddChange,
}: {
  renderChart: (key: string) => React.ReactNode;
  /** True while editing — or when no charts are left, so they can always be added back. */
  onShowAddChange?: (show: boolean) => void;
}) {
  const { t } = useTranslation();
  // localStorage er usynlig for serveren: render standarden først og skift efter mount.
  const [order, setOrder] = useState<string[]>(DEFAULT_ACTIVE_CHART_KEYS);
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const pendingRef = useRef<Pending | null>(null);
  const prevTopsRef = useRef(new Map<string, number>());
  const isFirstSave = useRef(true);
  const stateRef = useRef({ order, editMode, drag });
  useLayoutEffect(() => {
    stateRef.current = { order, editMode, drag };
  });

  useEffect(() => {
    onShowAddChange?.(editMode || order.length === 0);
  }, [editMode, order.length, onShowAddChange]);

  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    saveChartLayout(order);
  }, [order]);

  // Genindlæs, når man vender tilbage fra /statistics/unused-charts.
  useEffect(() => {
    function onFocus() {
      if (stateRef.current.editMode) return;
      setOrder(loadChartLayout());
    }
    onFocus();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  // Den løftede graf følger fingeren; de øvrige glider (FLIP) på plads, når
  // rækkefølgen skifter under den.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const containerTop = container?.getBoundingClientRect().top ?? 0;
    const nextTops = new Map<string, number>();
    itemRefs.current.forEach((el, key) => nextTops.set(key, el.offsetTop));

    itemRefs.current.forEach((el, key) => {
      if (drag?.key === key) {
        el.style.transition = "none";
        el.style.transform = `translateY(${drag.y - drag.offsetY - (containerTop + el.offsetTop)}px)`;
        return;
      }
      const prev = prevTopsRef.current.get(key);
      const next = nextTops.get(key);
      if (prev === undefined || next === undefined || Math.abs(prev - next) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${prev - next}px)`;
      void el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = `transform 180ms ${REFLOW_EASING}`;
        el.style.transform = "";
      });
    });
    prevTopsRef.current = nextTops;
  }, [order, drag]);

  function enterEditMode() {
    setEditMode(true);
  }

  function exitEditMode() {
    setEditMode(false);
    setDrag(null);
  }

  function removeChart(key: string) {
    setOrder((prev) => prev.filter((k) => k !== key));
  }

  function lift(key: string, y: number) {
    const el = itemRefs.current.get(key);
    if (!el) return;
    setDrag({ key, offsetY: y - el.getBoundingClientRect().top, y });
  }

  function onItemPointerDown(event: React.PointerEvent, key: string) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-stat-action], input")) return;
    if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
    const press: Pending = {
      key,
      startX: event.clientX,
      startY: event.clientY,
      pointerType: event.pointerType,
      timer: null,
    };
    pendingRef.current = press;
    if (editMode && event.pointerType === "mouse") return;
    press.timer = window.setTimeout(
      () => {
        if (pendingRef.current !== press) return;
        press.timer = null;
        if (!stateRef.current.editMode) enterEditMode();
        lift(press.key, press.startY);
      },
      editMode ? DRAG_DELAY_MS : ENTER_EDIT_DELAY_MS,
    );
  }

  useEffect(() => {
    function reorder(current: Drag, y: number) {
      const dragged = itemRefs.current.get(current.key);
      const container = containerRef.current;
      if (!dragged || !container) return;
      const containerTop = container.getBoundingClientRect().top;
      const center = y - current.offsetY + dragged.offsetHeight / 2;
      const others = stateRef.current.order.filter((k) => k !== current.key);
      let index = 0;
      for (const key of others) {
        const el = itemRefs.current.get(key);
        if (el && containerTop + el.offsetTop + el.offsetHeight / 2 < center) index += 1;
      }
      const next = [...others.slice(0, index), current.key, ...others.slice(index)];
      if (next.join("|") !== stateRef.current.order.join("|")) setOrder(next);
    }

    function onMove(event: PointerEvent) {
      const press = pendingRef.current;
      const current = stateRef.current.drag;
      if (press && !current) {
        const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
        if (moved <= MOVE_TOLERANCE_PX) return;
        if (press.timer) window.clearTimeout(press.timer);
        pendingRef.current = null;
        if (stateRef.current.editMode && press.pointerType === "mouse") lift(press.key, event.clientY);
        return;
      }
      if (!current) return;
      setDrag({ ...current, y: event.clientY });
      reorder(current, event.clientY);
    }

    function endDrag() {
      const current = stateRef.current.drag;
      if (current) {
        const el = itemRefs.current.get(current.key);
        if (el) {
          el.style.transition = `transform 180ms ${REFLOW_EASING}`;
          el.style.transform = "";
        }
      }
      setDrag(null);
    }

    function onUp() {
      if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
      if (stateRef.current.drag) endDrag();
    }

    function onTouchMove(event: TouchEvent) {
      if (stateRef.current.drag && event.cancelable) event.preventDefault();
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  // Et kort tryk uden for graferne og kontroller afslutter redigeringen.
  useEffect(() => {
    if (!editMode) return;
    let start: { x: number; y: number } | null = null;
    function onDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const interactive = target?.closest(
        "[data-chart-item], [data-stat-item], [data-stat-action], button, a, input, textarea, select, label, [role='button']",
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

  const visible = order.filter((key) => statChartDef(key));
  if (visible.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-4"
      onContextMenu={(event) => {
        if (editMode || pendingRef.current) event.preventDefault();
      }}
    >
      {visible.map((key, index) => {
        const isDragged = drag?.key === key;
        return (
          <div
            key={key}
            ref={(el) => {
              if (el) itemRefs.current.set(key, el);
              else itemRefs.current.delete(key);
            }}
            data-chart-item
            onPointerDown={(event) => onItemPointerDown(event, key)}
            className={`relative touch-pan-y ${isDragged ? "z-30" : ""}`}
          >
            <div
              style={{ animationDelay: `${(index % 3) * 60}ms` }}
              className={`relative rounded-2xl border-[1.5px] ${
                editMode ? "border-dashed border-hf-black/40" : "border-transparent"
              } ${editMode && !isDragged ? "stat-card-editing" : ""} ${isDragged ? "shadow-xl" : ""}`}
            >
              {editMode && (
                <RemoveCircleButton
                  ariaLabel={t("statChartsSection.removeChart")}
                  onRemove={() => removeChart(key)}
                />
              )}
              {renderChart(key)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
