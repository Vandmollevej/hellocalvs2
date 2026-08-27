"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@tabler/icons-react";

const ICON_SIZE = 30;
const STORAGE_KEY = "hellocal:bottomnav:v1";
const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 10;

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
  label: string;
  render: (color: string, size: number) => React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "tilfoej",
    href: "/",
    label: "Tilføj",
    render: (color, size) => <IconPlus size={size} stroke={1.6} color={color} />,
  },
  {
    key: "madvarer",
    href: "/madvarer",
    label: "Madvarer",
    render: (color, size) => <IconApple size={size} stroke={1.6} color={color} />,
  },
  {
    key: "kalender",
    href: "/kalender",
    label: "Kalender",
    render: (color, size) => <IconCalendar size={size} stroke={1.6} color={color} />,
  },
  {
    key: "statistik",
    href: "/statistik",
    label: "Statistik",
    render: (color, size) => <TrendIcon color={color} size={size} />,
  },
  {
    key: "kamera",
    href: "/kamera",
    label: "Kamera",
    render: (color, size) => <IconCamera size={size} stroke={1.6} color={color} />,
  },
  {
    key: "soeg",
    href: "/soeg",
    label: "Søg",
    render: (color, size) => <IconSearch size={size} stroke={1.6} color={color} />,
  },
  {
    key: "stemme",
    href: "/stemme",
    label: "Stemme",
    render: (color, size) => <IconMicrophone size={size} stroke={1.6} color={color} />,
  },
  {
    key: "profil",
    href: "/profil",
    label: "Profil",
    render: (color, size) => <IconUser size={size} stroke={1.6} color={color} />,
  },
];

const ITEMS_BY_KEY = new Map(NAV_ITEMS.map((item) => [item.key, item]));
const DEFAULT_ACTIVE = ["tilfoej", "madvarer", "kalender", "statistik"];
const DEFAULT_INACTIVE = NAV_ITEMS.map((i) => i.key).filter(
  (k) => !DEFAULT_ACTIVE.includes(k),
);

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
};

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [activeKeys, setActiveKeys] = useState<string[]>(DEFAULT_ACTIVE);
  const [inactiveKeys, setInactiveKeys] = useState<string[]>(DEFAULT_INACTIVE);
  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const barRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);

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

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const finishDrag = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current) return;

      const overRect = (el: HTMLElement | null) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
      };

      if (!current.moved) {
        if (current.source === "inactive") {
          setInactiveKeys((prev) => prev.filter((k) => k !== current.key));
          setActiveKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
        }
        return;
      }

      if (current.source === "active" && overRect(panelRef.current)) {
        setActiveKeys((prev) => prev.filter((k) => k !== current.key));
        setInactiveKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
        return;
      }

      if (current.source === "inactive") {
        if (overRect(barRef.current)) {
          setInactiveKeys((prev) => prev.filter((k) => k !== current.key));
          setActiveKeys((prev) => (prev.includes(current.key) ? prev : [...prev, current.key]));
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!drag) return;

    function onMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      const dx = e.clientX - current.x;
      const dy = e.clientY - current.y;
      const moved = current.moved || Math.hypot(dx, dy) > MOVE_CANCEL_PX;
      const next = { ...current, x: e.clientX, y: e.clientY, moved };
      dragRef.current = next;
      setDrag(next);

      if (moved && current.source === "active") {
        let closestKey: string | null = null;
        let closestDist = Infinity;
        itemRefs.current.forEach((el, key) => {
          if (key === current.key) return;
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
    };
  }, [drag, finishDrag]);

  function beginDrag(key: string, source: "active" | "inactive", e: React.PointerEvent) {
    const state: DragState = {
      key,
      source,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
    dragRef.current = state;
    setDrag(state);
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
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
      clearLongPress();
      pressStart.current = null;
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

  function removeFromActive(key: string) {
    setActiveKeys((prev) => prev.filter((k) => k !== key));
    setInactiveKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  const draggedKey = drag?.moved ? drag.key : null;

  return (
    <div className="relative">
      {editMode && (
        <div
          ref={panelRef}
          className="hf-nav-panel-in absolute bottom-full left-0 right-0 rounded-t-2xl border border-b-0 border-hf-tan-dark bg-hf-tan px-4 pb-3 pt-3 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <span
              className="text-[13px] font-medium"
              style={{ color: "var(--hf-black)", fontFamily: "var(--font-hf-body)" }}
            >
              Træk et ikon ned i menuen
            </span>
            <button
              type="button"
              onClick={() => setEditMode(false)}
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
              const hidden = draggedKey === key && drag?.source === "inactive";
              return (
                <button
                  key={key}
                  type="button"
                  onPointerDown={(e) => beginDrag(key, "inactive", e)}
                  className="flex w-16 flex-col items-center gap-1 rounded-xl bg-hf-gray-light px-1 py-2 touch-none"
                  style={{ opacity: hidden ? 0.25 : 1 }}
                  aria-label={`Tilføj ${item.label}`}
                >
                  {item.render("var(--hf-black)", 24)}
                  <span
                    className="text-[10px] leading-tight text-center"
                    style={{ color: "var(--hf-black)", fontFamily: "var(--font-hf-body)" }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
            {inactiveKeys.length === 0 && (
              <span
                className="text-[12px]"
                style={{ color: "var(--hf-gray-dark)", fontFamily: "var(--font-hf-body)" }}
              >
                Alle ikoner er i brug.
              </span>
            )}
          </div>
        </div>
      )}

      <nav
        ref={barRef}
        className="flex items-start border-t border-hf-tan-dark bg-hf-tan pb-6 pt-3"
        aria-label="Hovednavigation"
      >
        {activeKeys.map((key, i) => {
          const item = ITEMS_BY_KEY.get(key);
          if (!item) return null;
          const active = pathname === item.href;
          const color = active ? "var(--hf-black)" : "var(--hf-gray)";
          const isDragged = draggedKey === key && drag?.source === "active";
          return (
            <button
              key={key}
              type="button"
              ref={(el) => {
                if (el) itemRefs.current.set(key, el);
                else itemRefs.current.delete(key);
              }}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onPointerDown={(e) => handleActivePointerDown(key, e)}
              onPointerMove={handleActivePointerMove}
              onPointerUp={() => handleActivePointerUp(key, item.href)}
              className={`relative flex flex-1 flex-col items-center gap-1 touch-none ${
                i < activeKeys.length - 1 ? "border-r border-hf-tan-dark" : ""
              } ${editMode && !isDragged ? "hf-nav-jiggle" : ""}`}
              style={{
                animationDelay: editMode ? `${(i % 2) * 0.08}s` : undefined,
                opacity: isDragged ? 0.25 : 1,
              }}
            >
              {editMode && (
                <span
                  role="button"
                  aria-label={`Fjern ${item.label}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromActive(key);
                  }}
                  className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-hf-black"
                >
                  <IconX size={13} stroke={2.2} color="var(--hf-tan)" />
                </span>
              )}
              {item.render(color, ICON_SIZE)}
              <span
                className="text-[12px]"
                style={{ color, fontFamily: "var(--font-hf-body)" }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
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
