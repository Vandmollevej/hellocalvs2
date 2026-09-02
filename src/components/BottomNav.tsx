"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  IconPlus,
  IconApple,
  IconCalendar,
  IconCamera,
  IconSearch,
  IconMicrophone,
  IconUser,
  IconX,
  IconRecycle,
} from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

const ICON_SIZE = 24;
const NAV_ACTIVE_COLOR = "#232323";
const NAV_INACTIVE_COLOR = "#656565";
const NAV_BORDER_COLOR = "#afadaa";
const PANEL_ICON_SIZE = 24;
const STORAGE_KEY = "hellocal:bottomnav:v1";
const LONG_PRESS_MS = 550;
const READY_MS = 1000;
const MOVE_CANCEL_PX = 10;
const SHEET_CLOSE_PX = 60;
const FLIP_MS = 200;
const PAGE_SIZE = 4;
const EDGE_ZONE_PX = 36;
const EDGE_HOLD_MS = 650;
const SWIPE_MIN_RATIO = 0.22;
const PAGE_ANIM_MS = 220;

function TrendIcon({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline
        points="2,19 9,12 14,15 22,3"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="19" r="1.6" fill={color} />
      <circle cx="14" cy="15" r="1.6" fill={color} />
      <circle cx="22" cy="3" r="1.6" fill={color} />
    </svg>
  );
}

type NavItem = {
  key: string;
  href: string;
  // Translation key under the "nav" namespace (src/i18n/locales/*.json).
  // The `key` field above stays the stable internal identity used for
  // localStorage layout persistence and must not be translated.
  labelKey: string;
  render: (color: string, size: number) => React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "tilfoej",
    href: "/",
    labelKey: "add",
    render: (color, size) => <IconPlus size={size} stroke={1.6} color={color} />,
  },
  {
    key: "madvarer",
    href: "/foods",
    labelKey: "foods",
    render: (color, size) => <IconApple size={size} stroke={1.6} color={color} />,
  },
  {
    key: "kalender",
    href: "/calendar",
    labelKey: "calendar",
    render: (color, size) => <IconCalendar size={size} stroke={1.6} color={color} />,
  },
  {
    key: "statistik",
    href: "/statistics",
    labelKey: "statistics",
    render: (color, size) => <TrendIcon color={color} size={size} />,
  },
  {
    key: "kamera",
    href: "/camera",
    labelKey: "camera",
    render: (color, size) => <IconCamera size={size} stroke={1.6} color={color} />,
  },
  {
    key: "soeg",
    href: "/search",
    labelKey: "search",
    render: (color, size) => <IconSearch size={size} stroke={1.6} color={color} />,
  },
  {
    key: "stemme",
    href: "/voice",
    labelKey: "voice",
    render: (color, size) => <IconMicrophone size={size} stroke={1.6} color={color} />,
  },
  {
    key: "profil",
    href: "/profile",
    labelKey: "profile",
    render: (color, size) => <IconUser size={size} stroke={1.6} color={color} />,
  },
];

const ITEMS_BY_KEY = new Map(NAV_ITEMS.map((item) => [item.key, item]));
const DEFAULT_ACTIVE = ["tilfoej", "madvarer", "kalender", "statistik"];
const DEFAULT_INACTIVE = NAV_ITEMS.map((i) => i.key).filter(
  (k) => !DEFAULT_ACTIVE.includes(k),
);

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  if (out.length === 0) out.push([]);
  return out;
}

function loadLayout(): { active: string[]; inactive: string[] } {
  if (typeof window === "undefined") {
    return { active: DEFAULT_ACTIVE, inactive: DEFAULT_INACTIVE };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { active: DEFAULT_ACTIVE, inactive: DEFAULT_INACTIVE };
    const parsed = JSON.parse(raw) as { active?: string[]; inactive?: string[] };
    const knownKeys = new Set(NAV_ITEMS.map((i) => i.key));
    const active = (parsed.active ?? []).filter((k) => knownKeys.has(k));
    const placed = new Set(active);
    const inactive = (parsed.inactive ?? []).filter((k) => knownKeys.has(k) && !placed.has(k));
    NAV_ITEMS.forEach((item) => {
      if (!active.includes(item.key) && !inactive.includes(item.key)) {
        inactive.push(item.key);
      }
    });
    if (active.length === 0) return { active: DEFAULT_ACTIVE, inactive: DEFAULT_INACTIVE };
    return { active, inactive };
  } catch {
    return { active: DEFAULT_ACTIVE, inactive: DEFAULT_INACTIVE };
  }
}

type DragState = {
  key: string;
  source: "active" | "inactive";
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  ready: boolean;
  overTarget: boolean;
};

type PageSwipeState = {
  pointerId: number;
  startX: number;
  offsetX: number;
};

function overRect(el: HTMLElement | null, clientX: number, clientY: number) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const [activeKeys, setActiveKeys] = useState<string[]>(DEFAULT_ACTIVE);
  const [inactiveKeys, setInactiveKeys] = useState<string[]>(DEFAULT_INACTIVE);
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [sheetSnapping, setSheetSnapping] = useState(false);
  const [sheetDragActive, setSheetDragActive] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSwipe, setPageSwipe] = useState<PageSwipeState | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeHoldDir = useRef(0);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pageSwipeRef = useRef<PageSwipeState | null>(null);
  const activeKeysRef = useRef(activeKeys);
  const pageRef = useRef(page);
  const sheetDrag = useRef<{ pointerId: number; startY: number } | null>(null);
  const prevRects = useRef(new Map<string, DOMRect>());

  const pages = chunk(activeKeys, PAGE_SIZE);
  const currentPage = Math.min(page, pages.length - 1);

  useEffect(() => {
    const layout = loadLayout();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setActiveKeys(layout.active);
    setInactiveKeys(layout.inactive);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ active: activeKeys, inactive: inactiveKeys }),
    );
  }, [activeKeys, inactiveKeys, hydrated]);

  useEffect(() => {
    activeKeysRef.current = activeKeys;
  }, [activeKeys]);

  useEffect(() => {
    pageRef.current = currentPage;
  }, [currentPage]);

  // FLIP-animate icons that shift position when the active/inactive lists reorder.
  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();
    itemRefs.current.forEach((el, key) => {
      nextRects.set(key, el.getBoundingClientRect());
    });
    itemRefs.current.forEach((el, key) => {
      if (dragRef.current?.moved && dragRef.current.key === key) return;
      const prev = prevRects.current.get(key);
      const next = nextRects.get(key);
      if (!prev || !next) return;
      const dx = prev.left - next.left;
      const dy = prev.top - next.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => {
        el.style.transition = `transform ${FLIP_MS}ms ease`;
        el.style.transform = "";
      });
    });
    prevRects.current = nextRects;
  }, [activeKeys, inactiveKeys]);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const clearReadyTimer = useCallback(() => {
    if (readyTimer.current) {
      clearTimeout(readyTimer.current);
      readyTimer.current = null;
    }
  }, []);

  const clearEdgeHoldTimer = useCallback(() => {
    if (edgeHoldTimer.current) {
      clearTimeout(edgeHoldTimer.current);
      edgeHoldTimer.current = null;
    }
    edgeHoldDir.current = 0;
  }, []);

  const finishDrag = useCallback((clientX: number, clientY: number) => {
    clearReadyTimer();
    clearEdgeHoldTimer();
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;

    if (!current.moved) {
      if (current.source === "inactive") {
        setInactiveKeys((prev) => prev.filter((k) => k !== current.key));
        setActiveKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
      }
      return;
    }

    if (current.source === "active" && overRect(panelRef.current, clientX, clientY)) {
      setActiveKeys((prev) => prev.filter((k) => k !== current.key));
      setInactiveKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
      return;
    }

    if (current.source === "inactive") {
      if (overRect(barRef.current, clientX, clientY)) {
        setInactiveKeys((prev) => prev.filter((k) => k !== current.key));
        setActiveKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
      }
    }
  }, [clearReadyTimer, clearEdgeHoldTimer]);

  useEffect(() => {
    if (!drag) return;

    function onMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      const dx = e.clientX - current.x;
      const dy = e.clientY - current.y;
      const justStartedMoving = !current.moved && Math.hypot(dx, dy) > MOVE_CANCEL_PX;
      const moved = current.moved || justStartedMoving;
      if (justStartedMoving) clearReadyTimer();
      const overTarget = moved
        ? current.source === "active"
          ? overRect(panelRef.current, e.clientX, e.clientY)
          : overRect(barRef.current, e.clientX, e.clientY)
        : false;
      const next = { ...current, x: e.clientX, y: e.clientY, moved, overTarget };
      dragRef.current = next;
      setDrag(next);

      if (moved && current.source === "active") {
        const barRect = barRef.current?.getBoundingClientRect();
        const totalPages = Math.max(1, Math.ceil(activeKeysRef.current.length / PAGE_SIZE));
        if (barRect) {
          const nearLeft = e.clientX - barRect.left < EDGE_ZONE_PX && pageRef.current > 0;
          const nearRight =
            barRect.right - e.clientX < EDGE_ZONE_PX && pageRef.current < totalPages - 1;
          const dir = nearLeft ? -1 : nearRight ? 1 : 0;
          if (dir !== 0) {
            if (edgeHoldDir.current !== dir) {
              clearEdgeHoldTimer();
              edgeHoldDir.current = dir;
              edgeHoldTimer.current = setTimeout(() => {
                const total = Math.max(1, Math.ceil(activeKeysRef.current.length / PAGE_SIZE));
                setPage((p) => Math.min(total - 1, Math.max(0, p + dir)));
                edgeHoldTimer.current = null;
                edgeHoldDir.current = 0;
              }, EDGE_HOLD_MS);
            }
          } else {
            clearEdgeHoldTimer();
          }
        }

        const currentPageKeys = new Set(chunk(activeKeysRef.current, PAGE_SIZE)[pageRef.current] ?? []);
        let closestKey: string | null = null;
        let closestDist = Infinity;
        itemRefs.current.forEach((el, key) => {
          if (key === current.key) return;
          if (!currentPageKeys.has(key)) return;
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const dist = Math.abs(cx - e.clientX);
          if (dist < closestDist) {
            closestDist = dist;
            closestKey = key;
          }
        });
        if (closestKey) {
          setActiveKeys((prev) => {
            const from = prev.indexOf(current.key);
            const to = prev.indexOf(closestKey as string);
            if (from === -1 || to === -1 || from === to) return prev;
            const copy = [...prev];
            copy.splice(from, 1);
            copy.splice(to, 0, current.key);
            return copy;
          });
        }
      }
    }

    function onUp(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      finishDrag(e.clientX, e.clientY);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearEdgeHoldTimer();
    };
  }, [drag, finishDrag, clearReadyTimer, clearEdgeHoldTimer]);

  function beginPageSwipe(pointerId: number, startX: number) {
    const state: PageSwipeState = { pointerId, startX, offsetX: 0 };
    pageSwipeRef.current = state;
    setPageSwipe(state);
  }

  useEffect(() => {
    if (!pageSwipe) return;

    function onMove(e: PointerEvent) {
      const current = pageSwipeRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const totalPages = Math.max(1, Math.ceil(activeKeysRef.current.length / PAGE_SIZE));
      let offsetX = e.clientX - current.startX;
      if ((pageRef.current === 0 && offsetX > 0) || (pageRef.current === totalPages - 1 && offsetX < 0)) {
        offsetX *= 0.3;
      }
      const next = { ...current, offsetX };
      pageSwipeRef.current = next;
      setPageSwipe(next);
    }

    function onUp(e: PointerEvent) {
      const current = pageSwipeRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const rect = barRef.current?.getBoundingClientRect();
      const width = rect?.width || 1;
      const ratio = current.offsetX / width;
      const totalPages = Math.max(1, Math.ceil(activeKeysRef.current.length / PAGE_SIZE));
      pageSwipeRef.current = null;
      setPageSwipe(null);
      if (ratio <= -SWIPE_MIN_RATIO && pageRef.current < totalPages - 1) {
        setPage((p) => Math.min(totalPages - 1, p + 1));
      } else if (ratio >= SWIPE_MIN_RATIO && pageRef.current > 0) {
        setPage((p) => Math.max(0, p - 1));
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pageSwipe]);

  function beginDrag(key: string, source: "active" | "inactive", e: React.PointerEvent) {
    clearReadyTimer();
    const state: DragState = {
      key,
      source,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      ready: false,
      overTarget: false,
    };
    dragRef.current = state;
    setDrag(state);
    readyTimer.current = setTimeout(() => {
      if (dragRef.current && dragRef.current.key === key && !dragRef.current.moved) {
        const next = { ...dragRef.current, ready: true };
        dragRef.current = next;
        setDrag(next);
      }
    }, READY_MS);
  }

  function handleActivePointerDown(key: string, e: React.PointerEvent) {
    if (editMode) {
      beginDrag(key, "active", e);
      return;
    }
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      setEditMode(true);
      beginDrag(key, "active", e.nativeEvent as unknown as React.PointerEvent);
    }, LONG_PRESS_MS);
  }

  function handleActivePointerMove(e: React.PointerEvent) {
    if (editMode || !pressStart.current) return;
    const start = pressStart.current;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearLongPress();
      pressStart.current = null;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal && pages.length > 1) {
        beginPageSwipe(e.pointerId, start.x);
      }
    }
  }

  function handleActivePointerUp(key: string, href: string) {
    const hadTimer = longPressTimer.current !== null;
    clearLongPress();
    if (editMode) return;
    if (hadTimer && pressStart.current) {
      pressStart.current = null;
      router.push(href);
    }
  }

  function handleEmptySlotPointerDown(e: React.PointerEvent) {
    beginPageSwipe(e.pointerId, e.clientX);
  }

  function removeFromActive(key: string) {
    setActiveKeys((prev) => prev.filter((k) => k !== key));
    setInactiveKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function resetLayout() {
    setActiveKeys(DEFAULT_ACTIVE);
    setInactiveKeys(DEFAULT_INACTIVE);
    setPage(0);
  }

  function closePanel() {
    setEditMode(false);
  }

  function handleSheetPointerDown(e: React.PointerEvent) {
    sheetDrag.current = { pointerId: e.pointerId, startY: e.clientY };
    setSheetSnapping(false);
    setSheetDragActive(true);
  }

  useEffect(() => {
    if (!sheetDragActive) return;

    function onMove(e: PointerEvent) {
      const current = sheetDrag.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const dy = Math.max(0, e.clientY - current.startY);
      setSheetOffset(dy);
    }

    function onUp(e: PointerEvent) {
      const current = sheetDrag.current;
      if (!current || e.pointerId !== current.pointerId) return;
      sheetDrag.current = null;
      setSheetDragActive(false);
      setSheetSnapping(true);
      setSheetOffset((offset) => {
        if (offset > SHEET_CLOSE_PX) {
          closePanel();
        }
        return 0;
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [sheetDragActive]);

  const draggedKey = drag?.moved ? drag.key : null;
  const draggedOverPanel = drag?.moved && drag.source === "active" && drag.overTarget;
  const draggedOverBar = drag?.moved && drag.source === "inactive" && drag.overTarget;
  const trackOffsetPx = pageSwipe?.offsetX ?? 0;

  return (
    <div className="relative select-none [-webkit-touch-callout:none]">
      {editMode && (
        <div
          className="fixed inset-0 z-40 bg-hf-black/10"
          aria-hidden="true"
          onClick={closePanel}
        />
      )}

      {editMode && (
        <div
          ref={panelRef}
          className={`hf-nav-panel-in absolute bottom-full left-0 right-0 z-50 rounded-t-2xl border border-b-0 px-4 pb-3 pt-2 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] ${
            draggedOverBar ? "border-dashed border-hf-gray-dark" : "border-hf-tan-dark"
          }`}
          style={{
            backgroundColor: "var(--hf-tan)",
            transform: sheetOffset ? `translateY(${sheetOffset}px)` : undefined,
            transition: sheetSnapping ? "transform 180ms ease-out" : undefined,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closePanel();
          }}
        >
          <div
            className="-mx-4 mb-1 flex justify-center py-1.5 touch-none"
            onPointerDown={handleSheetPointerDown}
            aria-hidden="true"
          >
            <span className="h-1.5 w-10 rounded-full bg-hf-black/30" />
          </div>

          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--hf-black)", fontFamily: "var(--font-hf-body)" }}
            >
              Træk et ikon ned i menuen
            </span>
            <button
              type="button"
              onClick={closePanel}
              className="text-[13px] font-semibold"
              style={{ color: "var(--hf-green)", fontFamily: "var(--font-hf-body)" }}
            >
              Færdig
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {inactiveKeys.map((key) => {
              const item = ITEMS_BY_KEY.get(key);
              if (!item) return null;
              const isPlaceholder = draggedKey === key && drag?.source === "inactive";
              const isReady =
                drag?.key === key && drag.source === "inactive" && !drag.moved && drag.ready;
              return (
                <button
                  key={key}
                  type="button"
                  ref={(el) => {
                    if (el) itemRefs.current.set(key, el);
                    else itemRefs.current.delete(key);
                  }}
                  onPointerDown={(e) => beginDrag(key, "inactive", e)}
                  className={`flex h-[64px] w-16 flex-none flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 touch-none select-none ${
                    isPlaceholder
                      ? "border-dashed border-hf-gray-dark bg-transparent"
                      : isReady
                        ? "border-dashed border-hf-gray-dark bg-hf-gray-light"
                        : "border-hf-gray-light bg-hf-gray-light"
                  }`}
                  aria-label={t("nav.addItemAriaLabel", { item: t(`nav.${item.labelKey}`) })}
                >
                  <span className={`flex flex-col items-center gap-1 ${isPlaceholder ? "invisible" : ""}`}>
                    {item.render("var(--hf-black)", PANEL_ICON_SIZE)}
                    <span
                      className="text-[10px] leading-tight text-center"
                      style={{ color: "var(--hf-black)", fontFamily: "var(--font-hf-body)" }}
                    >
                      {t(`nav.${item.labelKey}`)}
                    </span>
                  </span>
                </button>
              );
            })}
            {inactiveKeys.length === 0 && (
              <span
                className="text-[12px]"
                style={{ color: "var(--hf-gray-dark)", fontFamily: "var(--font-hf-body)" }}
              >
                {t("nav.allIconsInUse")}
              </span>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={resetLayout}
              aria-label={t("nav.resetMenuAriaLabel")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-hf-green text-hf-white"
            >
              <IconRecycle size={20} />
            </button>
          </div>
        </div>
      )}

      <nav
        ref={barRef}
        className={`relative border-t bg-hf-tan-dark pb-6 pt-2 ${
          draggedOverPanel ? "border-dashed border-hf-gray-dark" : ""
        }`}
        style={draggedOverPanel ? undefined : { borderTopColor: NAV_BORDER_COLOR }}
        aria-label={t("nav.mainNavigationAriaLabel")}
      >
        {pages.length > 1 && (
          <div className="mb-1.5 flex justify-center gap-1" aria-hidden="true">
            {pages.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor: i === currentPage ? "var(--hf-black)" : "var(--hf-gray-light)",
                }}
              />
            ))}
          </div>
        )}
        <div className="overflow-hidden">
          <div
            className="flex"
            style={{
              transform: `translateX(calc(${-currentPage * 100}% + ${trackOffsetPx}px))`,
              transition: pageSwipe ? "none" : `transform ${PAGE_ANIM_MS}ms ease`,
            }}
          >
            {pages.map((pageKeys, pageIndex) => (
              <div
                key={pageIndex}
                className="grid w-full flex-none grid-cols-4 items-start justify-items-center"
                aria-hidden={pageIndex !== currentPage}
              >
                {Array.from({ length: PAGE_SIZE }, (_, slotIndex) => {
                  const key = pageKeys[slotIndex];
                  if (!key) {
                    return (
                      <div
                        key={`empty-${pageIndex}-${slotIndex}`}
                        className="h-[58px] w-16 touch-none select-none"
                        onPointerDown={handleEmptySlotPointerDown}
                      />
                    );
                  }
                  const item = ITEMS_BY_KEY.get(key);
                  if (!item) return <div key={key} className="h-[58px] w-16" />;
                  const active = pathname === item.href;
                  const color = active ? NAV_ACTIVE_COLOR : NAV_INACTIVE_COLOR;
                  const isPlaceholder = draggedKey === key && drag?.source === "active";
                  const isReady =
                    drag?.key === key && drag.source === "active" && !drag.moved && drag.ready;
                  return (
                    <button
                      key={key}
                      type="button"
                      ref={(el) => {
                        if (el) itemRefs.current.set(key, el);
                        else itemRefs.current.delete(key);
                      }}
                      aria-label={t(`nav.${item.labelKey}`)}
                      aria-current={active ? "page" : undefined}
                      onPointerDown={(e) => handleActivePointerDown(key, e)}
                      onPointerMove={handleActivePointerMove}
                      onPointerUp={() => handleActivePointerUp(key, item.href)}
                      className={`relative flex h-[58px] w-16 flex-none flex-col items-center justify-center gap-1 rounded-xl touch-none select-none ${
                        editMode ? "border" : "border-transparent"
                      } ${
                        isReady || isPlaceholder
                          ? "border-dashed border-hf-gray-dark"
                          : editMode
                            ? "border-hf-gray-light"
                            : ""
                      } ${editMode && !isPlaceholder && !isReady ? "hf-nav-jiggle" : ""}`}
                    >
                      {editMode && !isPlaceholder && (
                        <span
                          role="button"
                          aria-label={t("nav.removeItemAriaLabel", { item: t(`nav.${item.labelKey}`) })}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromActive(key);
                          }}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-hf-black"
                        >
                          <IconX size={13} stroke={2.2} color="var(--hf-tan)" />
                        </span>
                      )}
                      <span className={`flex flex-col items-center gap-2 ${isPlaceholder ? "invisible" : ""}`}>
                        {item.render(color, ICON_SIZE)}
                        <span className="hf-type-tab" style={{ color }}>
                          {t(`nav.${item.labelKey}`)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {drag?.moved && (
        <div
          className="pointer-events-none fixed z-50 flex w-16 flex-col items-center gap-1 opacity-90"
          style={{ left: drag.x - 32, top: drag.y - 32 }}
        >
          {ITEMS_BY_KEY.get(drag.key)?.render("var(--hf-black)", ICON_SIZE)}
        </div>
      )}
    </div>
  );
}
