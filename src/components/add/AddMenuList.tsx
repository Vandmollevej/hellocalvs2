"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { MealShareBar } from "@/components/family/MealShareBar";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { RemoveCircleButton } from "@/components/ui/RemoveCircleButton";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
import { loadAddMenuLayout, saveAddMenuLayout } from "@/lib/add-menu-layout";
import { useIsClientRender } from "@/lib/use-client-render";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Tilføj"-menuen: 3D-ikon-felter (2 kolonner på mobil, 5 på bredere
// skærme) i det beige kort. Vises af AddMenuSheet (forsidehjulets "Se alle"
// og kalenderens "Tilføj" på en time) og af /add/menu; arket scroller, når
// felterne ikke kan være der. Aktivitet og menstruation er felter som resten
// (ejerens valg 2026-10-03); menstruation kun for kvinder med cyklus slået
// til, via visibleAddActions(). Målvægt vises ikke her.
//
// Redigering (samme setup som bundmenuen og statistikken): et langt tryk på et
// felt får felterne til at vibrere; så kan et felt holdes inde og trækkes til en
// ny plads, slette-cirklen fjerner det, og "Tilføj" øverst til højre viser de
// fjernede felter, så de kan sættes ind igen. "Færdig" (eller et tryk på
// baggrunden) afslutter. Rækkefølgen gemmes i localStorage (add-menu-layout.ts).
//
// date/time (kalenderens tilfælde) sendes videre på hver href som ekstra
// query-parametre, så /foods lander registreringen på det valgte klokkeslæt.
const TILES = [
  { key: "food", href: "/search", icon: "/icons/add/food.webp" },
  { key: "scan", href: "/camera?mode=product", icon: "/icons/add/scan.webp" },
  { key: "platePhoto", href: "/camera?mode=meal", icon: "/icons/add/plate-photo.webp" },
  { key: "dish", href: "/create-dish", icon: "/icons/add/dish.webp" },
  { key: "voice", href: "/voice", icon: "/icons/add/voice.webp" },
  { key: "weight", href: "/weight/create", icon: "/icons/add/weight.webp" },
  { key: "drink", href: "/water/create", icon: "/icons/add/drink.webp" },
  { key: "body", href: "/profile/body-measurements", icon: "/icons/add/body.webp" },
  { key: "activity", href: "/activity/create", icon: "/icons/activity-3d.png" },
  { key: "period", href: "/period/create", icon: "/icons/add/period.svg", requiresCycleTracking: true },
] as const;

const ALL_KEYS = TILES.map((tile) => tile.key);
const ENTER_EDIT_DELAY_MS = 500;
const DRAG_DELAY_MS = 250;
const MOVE_TOLERANCE_PX = 8;
const TAP_TOLERANCE_PX = 10;

type Pending = { key: string; startX: number; startY: number; pointerType: string; timer: number | null };
type Drag = { key: string; offsetX: number; offsetY: number; x: number; y: number };

export function AddMenuList({ date, time }: { date?: string | null; time?: string | null }) {
  const { t } = useTranslation();
  const profile = useAddActionsProfile();
  const showPeriod = visibleAddActions(profile).some((action) => action.key === "menstrualCycle");
  const available = TILES.filter((tile) => !("requiresCycleTracking" in tile) || showPeriod);

  const clientRender = useIsClientRender();
  const [order, setOrder] = useState<string[]>(() => (clientRender ? loadAddMenuLayout(ALL_KEYS) : [...ALL_KEYS]));
  const [editMode, setEditMode] = useState(false);
  const [showTray, setShowTray] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const pendingRef = useRef<Pending | null>(null);
  const suppressClickRef = useRef(false);
  const isFirstSave = useRef(true);
  const stateRef = useRef({ order, editMode, drag });
  useLayoutEffect(() => {
    stateRef.current = { order, editMode, drag };
  });

  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    saveAddMenuLayout(order, ALL_KEYS);
  }, [order]);

  const tiles = order.flatMap((key) => available.filter((tile) => tile.key === key));
  const removed = available.filter((tile) => !order.includes(tile.key));
  const trayOpen = editMode && (showTray || tiles.length === 0);

  // Det løftede felt følger fingeren; de øvrige står på deres gitterplads.
  useLayoutEffect(() => {
    itemRefs.current.forEach((el, key) => {
      if (drag?.key === key) {
        el.style.transform = `translate(${drag.x - drag.offsetX - el.offsetLeft}px, ${drag.y - drag.offsetY - el.offsetTop}px)`;
      } else {
        el.style.transform = "";
      }
    });
  }, [order, drag]);

  function exitEditMode() {
    setEditMode(false);
    setShowTray(false);
    setDrag(null);
  }

  function lift(key: string, x: number, y: number) {
    const el = itemRefs.current.get(key);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDrag({ key, offsetX: x - rect.left, offsetY: y - rect.top, x, y });
  }

  function onItemPointerDown(event: React.PointerEvent, key: string) {
    if (event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("[data-stat-action]")) return;
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
        suppressClickRef.current = true;
        if (!stateRef.current.editMode) setEditMode(true);
        lift(press.key, press.startX, press.startY);
      },
      editMode ? DRAG_DELAY_MS : ENTER_EDIT_DELAY_MS,
    );
  }

  useEffect(() => {
    function reorder(current: Drag, x: number, y: number) {
      const px = x - current.offsetX;
      const py = y - current.offsetY;
      const dragged = itemRefs.current.get(current.key);
      if (!dragged) return;
      const cx = px + dragged.offsetWidth / 2;
      const cy = py + dragged.offsetHeight / 2;
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      const currentOrder = stateRef.current.order;
      for (const key of currentOrder) {
        if (key === current.key) continue;
        const el = itemRefs.current.get(key);
        if (!el) continue;
        const left = containerRect.left + el.offsetLeft;
        const top = containerRect.top + el.offsetTop;
        if (cx >= left && cx <= left + el.offsetWidth && cy >= top && cy <= top + el.offsetHeight) {
          const others = currentOrder.filter((k) => k !== current.key);
          others.splice(currentOrder.indexOf(key), 0, current.key);
          if (others.join("|") !== currentOrder.join("|")) setOrder(others);
          return;
        }
      }
    }

    function onMove(event: PointerEvent) {
      const press = pendingRef.current;
      const current = stateRef.current.drag;
      if (press && !current) {
        const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
        if (moved <= MOVE_TOLERANCE_PX) return;
        if (press.timer) window.clearTimeout(press.timer);
        pendingRef.current = null;
        if (stateRef.current.editMode && press.pointerType === "mouse") {
          suppressClickRef.current = true;
          lift(press.key, press.startX, press.startY);
        }
        return;
      }
      if (!current) return;
      setDrag({ ...current, x: event.clientX, y: event.clientY });
      reorder(current, event.clientX, event.clientY);
    }

    function onUp() {
      if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
      setDrag(null);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
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

  // Et kort tryk uden for felterne og kontroller afslutter redigeringen.
  useEffect(() => {
    if (!editMode) return;
    let start: { x: number; y: number } | null = null;
    function onDown(event: PointerEvent) {
      const target = event.target instanceof Element ? event.target : null;
      const interactive = target?.closest("[data-add-tile], [data-stat-action], button, a, input, label, [role='button']");
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

  const context = new URLSearchParams();
  if (date) context.set("date", date);
  if (time) context.set("time", time);
  const suffix = context.toString();
  const withContext = (href: string) =>
    suffix ? `${href}${href.includes("?") ? "&" : "?"}${suffix}` : href;

  function renderIcon(tile: (typeof TILES)[number]) {
    return (
      <>
        <Image
          src={tile.icon}
          alt=""
          width={96}
          height={96}
          draggable={false}
          className="h-24 w-24 object-contain"
          unoptimized={tile.icon.endsWith(".svg")}
        />
        <span className="hf-type-body">{t(`addMenu.${tile.key}`)}</span>
      </>
    );
  }

  return (
    <div className="hf-page">
      {editMode && (
        <div className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => setShowTray((open) => !open)}
            aria-expanded={trayOpen}
            className="hf-type-small hf-type-strong flex min-h-8 items-center gap-1 text-hf-black"
          >
            <IconPlus size={14} stroke={2.5} />
            {t("addMenu.addTiles")}
          </button>
          <button
            type="button"
            onClick={exitEditMode}
            className="hf-type-small hf-type-strong min-h-8 text-hf-green"
          >
            {t("addMenu.done")}
          </button>
        </div>
      )}
      {editMode && trayOpen && (
        <AccordionCard>
          <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-5">
            {removed.map((tile) => (
              <button
                key={tile.key}
                type="button"
                onClick={() => setOrder((prev) => [...prev, tile.key])}
                aria-label={t("addMenu.addTile", { item: t(`addMenu.${tile.key}`) })}
                className="flex flex-col items-center gap-1 rounded-[8px] p-2 text-center"
              >
                {renderIcon(tile)}
              </button>
            ))}
            {removed.length === 0 && (
              <span className="hf-type-small col-span-full py-2 text-center text-hf-gray-dark">
                {t("addMenu.allInUse")}
              </span>
            )}
          </div>
        </AccordionCard>
      )}
      <MealShareBar />
      <AccordionCard>
        <div
          ref={containerRef}
          className="relative grid grid-cols-2 gap-2 p-3 md:grid-cols-5"
          onContextMenu={(event) => {
            if (editMode || pendingRef.current) event.preventDefault();
          }}
        >
          {tiles.map((tile) => {
            const isDragged = drag?.key === tile.key;
            return (
              <div
                key={tile.key}
                ref={(el) => {
                  if (el) itemRefs.current.set(tile.key, el);
                  else itemRefs.current.delete(tile.key);
                }}
                data-add-tile
                onPointerDown={(event) => onItemPointerDown(event, tile.key)}
                className={`relative select-none [-webkit-touch-callout:none] ${isDragged ? "z-30" : ""} ${
                  editMode ? "touch-none" : ""
                }`}
              >
                <div
                  className={`relative rounded-[8px] ${
                    editMode ? "outline-[1.5px] -outline-offset-[1.5px] outline-dashed outline-hf-black/40" : ""
                  } ${editMode && !isDragged ? "stat-card-editing" : ""} ${isDragged ? "bg-hf-tan shadow-xl" : ""}`}
                >
                  {editMode && (
                    <RemoveCircleButton
                      ariaLabel={t("addMenu.removeTile", { item: t(`addMenu.${tile.key}`) })}
                      onRemove={() => setOrder((prev) => prev.filter((k) => k !== tile.key))}
                    />
                  )}
                  <Link
                    href={withContext(tile.href)}
                    draggable={false}
                    onClick={(event) => {
                      if (editMode || suppressClickRef.current) event.preventDefault();
                    }}
                    className="flex flex-col items-center gap-1 rounded-[8px] p-2 text-center"
                  >
                    {renderIcon(tile)}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </AccordionCard>
    </div>
  );
}
