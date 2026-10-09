"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconPlus, IconX } from "@tabler/icons-react";
import { MealShareBar } from "@/components/family/MealShareBar";
import { AccordionCard } from "@/components/hf/AccordionCard";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useAddActionsProfile, visibleAddActions } from "@/lib/add-actions";
import {
  defaultAddMenuLayout,
  loadAddMenuLayout,
  saveAddMenuLayout,
  type AddMenuLayout,
} from "@/lib/add-menu-layout";
import { useIsSerious } from "@/lib/use-subscription-tier";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Tilføj"-menuen: 3D-ikon-felter (2 kolonner på mobil, 5 på bredere
// skærme) i det beige kort. Vises af AddMenuSheet (forsidehjulets "Se alle"
// og kalenderens "Tilføj" på en time) og af /add/menu; arket scroller, når
// felterne ikke kan være der. Aktivitet og menstruation er felter som resten
// (ejerens valg 2026-10-03); menstruation kun for kvinder med cyklus slået
// til, via visibleAddActions(). Målvægt vises ikke her.
//
// date/time (kalenderens tilfælde) sendes videre på hver href som ekstra
// query-parametre, så /foods lander registreringen på det valgte klokkeslæt.
//
// Redigering (ejerens ønske 2026-10-07, samme setup som bundmenuen og
// statistik-siden): hold fingeren inde på et felt (som i footeren) for at
// omrokere (træk) og slette (kryds) felter; "Tilføj" øverst til højre henter
// slettede felter tilbage. Kun Seriøs, som footerens omarrangering.
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

const TILE_KEYS = TILES.map((tile) => tile.key);
// Samme hold-tid og bevægelsestolerance som footeren (BottomNav.tsx).
const LONG_PRESS_MS = 550;
const MOVE_CANCEL_PX = 10;

type Tile = (typeof TILES)[number];
type Drag = { key: string; x: number; y: number };

export function AddMenuList({ date, time }: { date?: string | null; time?: string | null }) {
  const { t } = useTranslation();
  const profile = useAddActionsProfile();
  const isSerious = useIsSerious();
  const showPeriod = visibleAddActions(profile).some((action) => action.key === "menstrualCycle");
  const available = TILES.filter((tile) => !("requiresCycleTracking" in tile) || showPeriod);

  const [layout, setLayout] = useState<AddMenuLayout>(() => defaultAddMenuLayout(TILE_KEYS));
  const [editMode, setEditMode] = useState(false);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const layoutRef = useRef(layout);
  const tileRefs = useRef(new Map<string, HTMLElement>());
  const pressRef = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const loaded = loadAddMenuLayout(TILE_KEYS);
    layoutRef.current = loaded;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage
    setLayout(loaded);
  }, []);

  function commit(next: AddMenuLayout) {
    layoutRef.current = next;
    setLayout(next);
    saveAddMenuLayout(next);
  }

  const byKey = new Map<string, Tile>(available.map((tile) => [tile.key, tile]));
  const shown = layout.order.filter((key) => !layout.hidden.includes(key) && byKey.has(key));
  const hiddenTiles = layout.hidden.filter((key) => byKey.has(key));

  function clearPress() {
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  }

  useEffect(() => clearPress, []);

  // Trækket kører på window, så det følger fingeren uden for feltet; mens det
  // varer, må hverken siden eller bundarket scrolle/flytte sig (capture, så
  // BottomSheets egne touchmove-lyttere ikke når at flytte arket).
  useEffect(() => {
    if (!drag) return;

    function moveTo(x: number, y: number) {
      const current = dragRef.current;
      if (!current) return;
      const next = { ...current, x, y };
      dragRef.current = next;
      setDrag(next);
      let overKey: string | null = null;
      tileRefs.current.forEach((el, key) => {
        if (key === current.key) return;
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          overKey = key;
        }
      });
      if (!overKey) return;
      const order = [...layoutRef.current.order];
      const from = order.indexOf(current.key);
      const to = order.indexOf(overKey);
      if (from === -1 || to === -1 || from === to) return;
      order.splice(from, 1);
      order.splice(to, 0, current.key);
      commit({ ...layoutRef.current, order });
    }

    function onMove(event: PointerEvent) {
      moveTo(event.clientX, event.clientY);
    }

    function onUp() {
      dragRef.current = null;
      setDrag(null);
    }

    // iOS sender pointercancel, når browseren overtager en berøring, der
    // startede uden touch-action: none (langt tryk). Trækket følger derfor
    // touch-hændelserne og afsluttes kun af dem; pointercancel ignoreres.
    function blockScroll(event: TouchEvent) {
      // Ingen finger på skærmen: trækket er hængt fast (mistet touchend) —
      // slip det, ellers låses al scroll og alle tryk.
      if (event.touches.length === 0) {
        onUp();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const touch = event.touches[0];
      if (touch) moveTo(touch.clientX, touch.clientY);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Et nyt tryk betyder, at et tidligere træk er endt uden touchend (fx hurtigt
    // tryk, før lytterne nåede at sidde på) — ryd det, så siden ikke sidder fast.
    document.addEventListener("touchstart", onUp, { capture: true });
    document.addEventListener("touchmove", blockScroll, { passive: false, capture: true });
    document.addEventListener("touchend", onUp, { capture: true });
    document.addEventListener("touchcancel", onUp, { capture: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("touchstart", onUp, { capture: true });
      document.removeEventListener("touchmove", blockScroll, { capture: true });
      document.removeEventListener("touchend", onUp, { capture: true });
      document.removeEventListener("touchcancel", onUp, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trækket styres via dragRef; kun start/stop afhænger af `drag`
  }, [drag === null]);

  function beginDrag(key: string, x: number, y: number) {
    const state = { key, x, y };
    dragRef.current = state;
    setDrag(state);
  }

  function handlePointerDown(key: string, event: React.PointerEvent) {
    if (event.button !== 0) return;
    if (editMode) {
      beginDrag(key, event.clientX, event.clientY);
      return;
    }
    if (!isSerious) return;
    clearPress();
    const x = event.clientX;
    const y = event.clientY;
    pressRef.current = {
      x,
      y,
      timer: setTimeout(() => {
        pressRef.current = null;
        suppressClickRef.current = true;
        setEditMode(true);
        beginDrag(key, x, y);
      }, LONG_PRESS_MS),
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const press = pressRef.current;
    if (!press) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_CANCEL_PX) clearPress();
  }

  function handleClick(event: React.MouseEvent) {
    if (editMode || suppressClickRef.current) {
      event.preventDefault();
      suppressClickRef.current = false;
    }
  }

  function removeTile(key: string) {
    commit({ ...layoutRef.current, hidden: [...layoutRef.current.hidden, key] });
  }

  function restoreTile(key: string) {
    commit({ ...layoutRef.current, hidden: layoutRef.current.hidden.filter((hidden) => hidden !== key) });
    setAddSheetOpen(false);
  }

  const context = new URLSearchParams();
  if (date) context.set("date", date);
  if (time) context.set("time", time);
  const suffix = context.toString();
  const withContext = (href: string) =>
    suffix ? `${href}${href.includes("?") ? "&" : "?"}${suffix}` : href;

  const draggedKey = drag ? drag.key : null;
  const draggedTile = draggedKey ? byKey.get(draggedKey) : null;

  return (
    <div
      className="hf-page"
      onClick={(event) => {
        if (editMode && event.target === event.currentTarget) setEditMode(false);
      }}
    >
      <MealShareBar />
      {editMode && (
        // Sticky: "Færdig" skal altid kunne nås, også når listen er scrollet.
        <div className="sticky top-0 z-20 -mx-[var(--hf-gutter)] flex items-center justify-between bg-[var(--hf-color-page)] px-[var(--hf-gutter)] py-1">
          <button
            type="button"
            onClick={() => setEditMode(false)}
            className="hf-type-small hf-type-strong flex min-h-8 items-center text-hf-green"
          >
            {t("addMenu.editDone")}
          </button>
          <button
            type="button"
            onClick={() => setAddSheetOpen(true)}
            className="hf-type-small hf-type-strong flex min-h-8 items-center gap-1 text-hf-black"
          >
            <IconPlus size={14} stroke={2.5} />
            {t("addMenu.editAdd")}
          </button>
        </div>
      )}
      <AccordionCard>
        <div className="grid grid-cols-2 gap-2 p-3 select-none [-webkit-touch-callout:none] md:grid-cols-5">
          {shown.map((key) => {
            const tile = byKey.get(key)!;
            const label = t(`addMenu.${tile.key}`);
            const placeholder = draggedKey === key;
            return (
              <Link
                key={tile.key}
                href={withContext(tile.href)}
                ref={(el) => {
                  if (el) tileRefs.current.set(key, el);
                  else tileRefs.current.delete(key);
                }}
                draggable={false}
                onPointerDown={(event) => handlePointerDown(key, event)}
                onPointerMove={handlePointerMove}
                onPointerUp={clearPress}
                onPointerCancel={clearPress}
                onContextMenu={(event) => event.preventDefault()}
                onClick={handleClick}
                className={`rounded-card relative flex flex-col items-center gap-1 border p-2 text-center ${
                  editMode ? (placeholder ? "border-dashed border-hf-gray-dark" : "border-hf-tan-dark") : "border-transparent"
                } ${editMode && !placeholder ? "hf-nav-jiggle" : ""} ${editMode ? "touch-none" : ""}`}
              >
                {editMode && (
                  <span
                    role="button"
                    aria-label={t("addMenu.editRemoveTile", { item: label })}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      removeTile(key);
                    }}
                    className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-hf-black"
                  >
                    <IconX size={14} stroke={2.2} color="var(--hf-tan)" />
                  </span>
                )}
                <span className={`flex flex-col items-center gap-0 ${placeholder ? "invisible" : ""}`}>
                  <Image
                    src={tile.icon}
                    alt=""
                    width={96}
                    height={96}
                    className="h-24 w-24 object-contain"
                    unoptimized={tile.icon.endsWith(".svg")}
                    draggable={false}
                  />
                  <span className="hf-type-body">{label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </AccordionCard>

      {drag && draggedTile && (
        <div
          className="pointer-events-none fixed z-[100] flex w-24 flex-col items-center opacity-90"
          style={{ left: drag.x - 48, top: drag.y - 48 }}
        >
          <Image
            src={draggedTile.icon}
            alt=""
            width={96}
            height={96}
            className="h-24 w-24 object-contain"
            unoptimized={draggedTile.icon.endsWith(".svg")}
          />
        </div>
      )}

      {addSheetOpen && (
        <BottomSheet title={t("addMenu.editAddTitle")} onClose={() => setAddSheetOpen(false)}>
          <div className="hf-page">
            {hiddenTiles.length === 0 ? (
              <p className="text-text-secondary hf-type-body">{t("addMenu.editNoneHidden")}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {hiddenTiles.map((key) => {
                  const tile = byKey.get(key)!;
                  const label = t(`addMenu.${tile.key}`);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => restoreTile(key)}
                      aria-label={t("addMenu.editAddTile", { item: label })}
                      className="flex flex-col items-center gap-0 p-2 text-center rounded-card"
                    >
                      <Image
                        src={tile.icon}
                        alt=""
                        width={96}
                        height={96}
                        className="h-24 w-24 object-contain"
                        unoptimized={tile.icon.endsWith(".svg")}
                      />
                      <span className="hf-type-body">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
