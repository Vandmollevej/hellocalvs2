"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { IconList, IconPlus, IconX, type Icon } from "@tabler/icons-react";
import {
  addActionByKey,
  useAddActionsProfile,
  visibleAddActions,
  type AddActionKey,
} from "@/lib/add-actions";
import {
  ARC_BULGE_MAX,
  ARC_ICON,
  ARC_MAX_CHOSEN,
  ARC_RADIUS,
  ARC_REST_HEIGHT,
  arcBackdropPath,
  arcOrder,
  clampArcCenter,
  layoutArc,
  loadBottomArcOffsetX,
  saveBottomArcKeys,
  saveBottomArcOffsetX,
  useBottomArcKeys,
} from "@/lib/bottom-arc";
import { useTranslation } from "@/i18n/LocaleProvider";
import { AddMenuSheet } from "@/components/add/AddMenuSheet";

// Prøve: fast halvcirkel midt over footeren med samme funktion som den grønne
// cirkel i siden (AddButton.tsx): træk/skub op åbner viften og vælger ved slip,
// tap åbner den (animeret), og hold fingeren stille i samme tid som i footeren
// åbner indstillingerne. Træk til siden flytter halvcirklen langs footeren.
const CONTAINER_HEIGHT = 260;
const WRAPPER_HEIGHT = ARC_RADIUS + ARC_BULGE_MAX;
const REST_SHIFT = ARC_RADIUS - ARC_REST_HEIGHT;
const CLOSED_HIT_HEIGHT = 28;
const HIT_WIDTH = 96;
const PLUS_SIZE = 20;

// Samme tidsrum og bevægelsestærskel som bundmenuens langtryk (BottomNav.tsx).
const LONG_PRESS_MS = 550;
const MOVE_PX = 8;

const SELECT_DEAD_ZONE = 14;
const LIGHT_TRAVEL = ARC_RADIUS - 14 - 6;
const HIGHLIGHT_SCALE = 1.35;
const HIGHLIGHT_EXTRA = 14;
const ICON_SIZE = 26;
const PANEL_SLOTS = 5;

const INACTIVE_SHADOW = "0 2px 5px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.05)";
const ACTIVE_SHADOW = "0 8px 18px rgba(0,0,0,0.15), 0 3px 8px rgba(0,0,0,0.08)";
const LABEL_SHADOW = "0 2px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)";

type Action = {
  key: string;
  href: string;
  label: string;
  icon?: Icon;
  imageSrc?: string;
};

type NavRect = { left: number; top: number; width: number };

type PanelDrag = {
  key: AddActionKey;
  source: "pool" | "row";
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

function ActionGlyph({ action, color, filter }: { action: Action; color: string; filter?: string }) {
  const Glyph = action.icon;
  if (Glyph) return <Glyph size={ICON_SIZE} color={color} />;
  return (
    <Image
      src={action.imageSrc!}
      alt=""
      width={ICON_SIZE}
      height={ICON_SIZE}
      className="object-contain"
      style={filter ? { filter } : undefined}
    />
  );
}

function overRect(el: HTMLElement | null, x: number, y: number) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

export function BottomArcButton() {
  const { t } = useTranslation();
  const router = useRouter();
  const chosenKeys = useBottomArcKeys();
  const profile = useAddActionsProfile();

  const [nav, setNav] = useState<NavRect | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const [lightOffset, setLightOffset] = useState<{ x: number; y: number } | null>(null);
  const [panelDrag, setPanelDrag] = useState<PanelDrag | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const offsetXRef = useRef(0);
  const navRef = useRef<NavRect | null>(null);
  const pressRef = useRef<{ x: number; y: number; offsetX: number } | null>(null);
  const modeRef = useRef<"slide" | "select" | "settings" | "ignore" | null>(null);
  const wasOpenRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightedRef = useRef<string | null>(null);
  const slotsRef = useRef<ReturnType<typeof layoutArc>>([]);
  const centerRef = useRef(0);
  const panelDragRef = useRef<PanelDrag | null>(null);
  const chosenRef = useRef(chosenKeys);

  useEffect(() => {
    chosenRef.current = chosenKeys;
  }, [chosenKeys]);

  // Halvcirklen følger bundmenuens placering og bredde, så den altid sidder
  // på dens overkant — også på bredere skærme og når browserens bjælker ændrer sig.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>("[data-bottom-navigation]");
    if (!el) return;
    function measure() {
      const rect = el!.getBoundingClientRect();
      const next = { left: rect.left, top: rect.top, width: rect.width };
      const prev = navRef.current;
      if (prev && prev.left === next.left && prev.top === next.top && prev.width === next.width) return;
      navRef.current = next;
      setNav(next);
    }
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    if (el.parentElement) observer?.observe(el.parentElement);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    const saved = loadBottomArcOffsetX();
    offsetXRef.current = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- engangs-hydrering fra localStorage, som AddButton.tsx
    setOffsetX(saved);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.body.classList.remove("select-none");
    };
  }, []);

  // Tap uden for halvcirklen lukker viften.
  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const allowed = useMemo(() => visibleAddActions(profile), [profile]);
  const actionFor = useMemo(() => {
    const allowedKeys = new Set(allowed.map((action) => action.key));
    return (key: AddActionKey): Action | null => {
      if (!allowedKeys.has(key)) return null;
      const base = addActionByKey(key, profile.sex);
      if (!base) return null;
      return { key: base.key, href: base.href, icon: base.icon, imageSrc: base.imageSrc, label: t(base.labelKey) };
    };
  }, [allowed, profile.sex, t]);

  const listAction: Action = useMemo(
    () => ({ key: "list", href: "/add/menu", icon: IconList, label: t("addButton.list") }),
    [t],
  );

  const chosen = chosenKeys.filter((key) => actionFor(key));
  const order = arcOrder<string>(chosen, "list");
  const actionsByKey = new Map<string, Action>([["list", listAction]]);
  allowed.forEach((entry) => {
    const action = actionFor(entry.key);
    if (action) actionsByKey.set(entry.key, action);
  });

  const width = nav?.width ?? 0;
  const centerX = width ? clampArcCenter(width, offsetX) : 0;
  const slots = width ? layoutArc(order, width, centerX) : [];
  useEffect(() => {
    slotsRef.current = slots;
    centerRef.current = centerX;
  });

  function applyOffsetX(next: number) {
    const w = navRef.current?.width ?? 0;
    if (!w) return;
    const center = clampArcCenter(w, next);
    const clamped = center - w / 2;
    offsetXRef.current = clamped;
    setOffsetX(clamped);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function updateHighlight(event: React.PointerEvent) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const cx = centerRef.current;
    const plusY = CONTAINER_HEIGHT - ARC_RADIUS / 2;

    let nearest: string | null = null;
    let nearestDistance = Infinity;
    for (const slot of slotsRef.current) {
      const distance = Math.hypot(px - slot.x, py - (CONTAINER_HEIGHT - slot.up));
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = slot.key;
      }
    }

    const dx = px - cx;
    const dy = py - plusY;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, LIGHT_TRAVEL);
    const angle = Math.atan2(dy, dx);
    setLightOffset({ x: Math.cos(angle) * clamped, y: Math.sin(angle) * clamped });

    // Trækkes fingeren tilbage ned til footeren, annulleres valget — som når
    // fingeraftrykket rører skærmkanten i den eksisterende cirkel.
    const pulledBack = py >= CONTAINER_HEIGHT - 2;
    const next = distance > SELECT_DEAD_ZONE && !pulledBack ? nearest : null;
    highlightedRef.current = next;
    setHighlightedKey(next);
  }

  function resetSelection() {
    highlightedRef.current = null;
    setHighlightedKey(null);
    setLightOffset(null);
    document.body.classList.remove("select-none");
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignorer — pointeren kan allerede være sluppet.
    }
    pressRef.current = { x: event.clientX, y: event.clientY, offsetX: offsetXRef.current };
    modeRef.current = null;
    wasOpenRef.current = open;
    resetSelection();
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      if (modeRef.current !== null || !pressRef.current) return;
      modeRef.current = "settings";
      setOpen(false);
      setSettingsOpen(true);
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const start = pressRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;

    if (modeRef.current === null && Math.hypot(dx, dy) > MOVE_PX) {
      clearTimer();
      if (wasOpenRef.current) modeRef.current = "select";
      else if (Math.abs(dx) > Math.abs(dy)) modeRef.current = "slide";
      else modeRef.current = dy < 0 ? "select" : "ignore";
      if (modeRef.current === "select") {
        setOpen(true);
        document.body.classList.add("select-none");
      }
    }

    if (modeRef.current === "slide") applyOffsetX(start.offsetX + dx);
    else if (modeRef.current === "select") updateHighlight(event);
  }

  function finishPress(event: React.PointerEvent<HTMLButtonElement>, commit: boolean) {
    clearTimer();
    const mode = modeRef.current;
    const wasOpen = wasOpenRef.current;
    pressRef.current = null;
    modeRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorer.
    }

    if (mode === "select") {
      const key = highlightedRef.current;
      resetSelection();
      setOpen(false);
      if (commit && key) {
        if (key === "list") setMenuSheetOpen(true);
        else {
          const action = actionsByKey.get(key);
          if (action) router.push(action.href);
        }
      }
    } else if (mode === "slide") {
      saveBottomArcOffsetX(offsetXRef.current);
    } else if (mode === null && commit) {
      setOpen(!wasOpen);
    }
  }

  // --- Indstillinger: træk knapper ned til rækken, som i footeren ---

  function savePanelKeys(next: AddActionKey[]) {
    chosenRef.current = next;
    saveBottomArcKeys(next);
  }

  // Cellen under fingeren i rækken omregnet til en plads blandt de valgte.
  function chosenIndexAt(clientX: number) {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const cell = Math.min(PANEL_SLOTS - 1, Math.max(0, Math.floor(((clientX - rect.left) / rect.width) * PANEL_SLOTS)));
    const listIndex = Math.floor((chosenRef.current.length + 1) / 2);
    return Math.min(cell - (cell > listIndex ? 1 : 0), chosenRef.current.length);
  }

  function beginPanelDrag(key: AddActionKey, source: "pool" | "row", event: React.PointerEvent) {
    const next: PanelDrag = {
      key,
      source,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
    panelDragRef.current = next;
    setPanelDrag(next);
  }

  useEffect(() => {
    if (!panelDrag) return;

    function onMove(event: PointerEvent) {
      const current = panelDragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > MOVE_PX;
      const next = { ...current, x: event.clientX, y: event.clientY, moved };
      panelDragRef.current = next;
      setPanelDrag(next);

      if (moved && current.source === "row" && overRect(rowRef.current, event.clientX, event.clientY)) {
        const target = chosenIndexAt(event.clientX);
        const keys = chosenRef.current;
        const from = keys.indexOf(current.key);
        if (target !== null && from !== -1 && from !== Math.min(target, keys.length - 1)) {
          const copy = [...keys];
          copy.splice(from, 1);
          copy.splice(Math.min(target, copy.length), 0, current.key);
          savePanelKeys(copy);
        }
      }
    }

    function onUp(event: PointerEvent) {
      const current = panelDragRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      panelDragRef.current = null;
      setPanelDrag(null);
      const keys = chosenRef.current;

      if (current.source === "pool") {
        if (!current.moved) {
          if (keys.length < ARC_MAX_CHOSEN) savePanelKeys([...keys, current.key]);
        } else if (overRect(rowRef.current, event.clientX, event.clientY)) {
          const target = chosenIndexAt(event.clientX) ?? keys.length;
          const copy = [...keys];
          if (copy.length >= ARC_MAX_CHOSEN) copy.splice(Math.min(target, copy.length - 1), 1);
          copy.splice(Math.min(target, copy.length), 0, current.key);
          savePanelKeys(copy);
        }
      } else if (current.moved && overRect(poolRef.current, event.clientX, event.clientY)) {
        savePanelKeys(keys.filter((key) => key !== current.key));
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
    // chosenIndexAt/savePanelKeys læser kun refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelDrag !== null]);

  if (!nav) return null;

  const highlightedSlot = highlightedKey ? slots.find((slot) => slot.key === highlightedKey) : undefined;
  const bulgeAngle = highlightedSlot
    ? Math.max(-75, Math.min(75, (Math.atan2(highlightedSlot.x - centerX, highlightedSlot.up) * 180) / Math.PI))
    : null;
  const lightDistance = lightOffset ? Math.hypot(lightOffset.x, lightOffset.y) : 0;
  const bulgeAmount = highlightedSlot ? Math.min(ARC_BULGE_MAX, (lightDistance / LIGHT_TRAVEL) * ARC_BULGE_MAX) : 0;

  const poolActions = allowed
    .map((action) => actionFor(action.key))
    .filter((action): action is Action => Boolean(action) && !chosen.includes(action!.key as AddActionKey));
  const rowCells = Array.from({ length: PANEL_SLOTS }, (_, i) => order[i] ?? null);
  const draggedKey = panelDrag?.moved ? panelDrag.key : null;
  const plusUp = open ? ARC_RADIUS / 2 : ARC_REST_HEIGHT / 2;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed z-40"
      style={{ left: nav.left, top: nav.top - CONTAINER_HEIGHT, width: nav.width, height: CONTAINER_HEIGHT }}
    >
      {/* Klippes ved footerens overkant: i hvile ses kun cirklens top (20 px). */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 overflow-hidden"
        style={{ left: centerX - ARC_RADIUS, width: ARC_RADIUS * 2, height: WRAPPER_HEIGHT }}
      >
        <svg
          className="absolute left-0 top-0 transition-transform duration-200 ease-out"
          width={ARC_RADIUS * 2}
          height={WRAPPER_HEIGHT}
          viewBox={`0 0 ${ARC_RADIUS * 2} ${WRAPPER_HEIGHT}`}
          style={{ transform: `translateY(${open ? 0 : REST_SHIFT}px)` }}
        >
          <g transform={`translate(0 ${WRAPPER_HEIGHT}) rotate(-90)`}>
            <path d={arcBackdropPath(bulgeAngle, bulgeAmount)} fill="var(--hf-green)" />
          </g>
        </svg>
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute flex items-center justify-center transition-[bottom] duration-200 ease-out"
        style={{
          left: centerX - PLUS_SIZE / 2,
          bottom: plusUp - PLUS_SIZE / 2,
          width: PLUS_SIZE,
          height: PLUS_SIZE,
        }}
      >
        <span
          className="flex transition-transform"
          style={{
            transform: `translate(${lightOffset?.x ?? 0}px, ${lightOffset?.y ?? 0}px)`,
            transitionDuration: lightOffset ? "0ms" : "150ms",
          }}
        >
          <IconPlus size={PLUS_SIZE} stroke={2.2} color="var(--hf-white)" />
        </span>
      </span>

      <button
        type="button"
        aria-label={open ? t("addButton.closeMenu") : t("addButton.openMenu")}
        aria-expanded={open}
        data-bottom-arc-control
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPress(event, true)}
        onPointerCancel={(event) => finishPress(event, false)}
        onContextMenu={(event) => event.preventDefault()}
        className="pointer-events-auto absolute border-0 bg-transparent p-0 shadow-none [-webkit-touch-callout:none]"
        style={{
          left: centerX - HIT_WIDTH / 2,
          bottom: 0,
          width: HIT_WIDTH,
          height: open ? ARC_RADIUS : CLOSED_HIT_HEIGHT,
          touchAction: "none",
        }}
      />

      {slots.map((slot) => {
        const action = actionsByKey.get(slot.key);
        if (!action) return null;
        const isHighlighted = highlightedKey === slot.key;
        // Det valgte ikon rykker lidt længere ud, så tommelfingeren ikke dækker det.
        const fromX = slot.x - centerX;
        const length = Math.hypot(fromX, slot.up) || 1;
        const x = slot.x + (isHighlighted ? (fromX / length) * HIGHLIGHT_EXTRA : 0);
        const up = slot.up + (isHighlighted ? (slot.up / length) * HIGHLIGHT_EXTRA : 0);
        const labelAlign =
          x < 72 ? { left: 0 } : x > nav.width - 72 ? { right: 0 } : { left: "50%", transform: "translateX(-50%)" };
        return (
          <div
            key={slot.key}
            className="absolute transition-[top,left] duration-150"
            style={{ left: x - ARC_ICON / 2, top: CONTAINER_HEIGHT - up - ARC_ICON / 2, width: ARC_ICON, height: ARC_ICON }}
          >
            <Link
              href={action.href}
              onClick={(event) => {
                if (slot.key !== "list") return;
                event.preventDefault();
                setOpen(false);
                setMenuSheetOpen(true);
              }}
              aria-label={action.label}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-hf-tan transition-all duration-150"
              style={{
                opacity: open ? 1 : 0,
                pointerEvents: open ? "auto" : "none",
                transform: open ? `scale(${isHighlighted ? HIGHLIGHT_SCALE : 1})` : "scale(0.4)",
                backgroundColor: isHighlighted ? "var(--hf-green)" : undefined,
                boxShadow: isHighlighted ? ACTIVE_SHADOW : INACTIVE_SHADOW,
              }}
            >
              <ActionGlyph
                action={action}
                color={isHighlighted ? "var(--hf-white)" : "var(--hf-black)"}
                filter={isHighlighted ? "brightness(0) invert(1)" : undefined}
              />
            </Link>
            <span
              aria-hidden="true"
              className="hf-type-strong pointer-events-none absolute whitespace-nowrap bg-hf-tan transition-opacity duration-150"
              style={{
                ...labelAlign,
                bottom: ARC_ICON + 16,
                padding: "7px 10px",
                borderRadius: 3,
                boxShadow: LABEL_SHADOW,
                color: "var(--hf-green)",
                fontSize: 15,
                opacity: open && isHighlighted ? 1 : 0,
              }}
            >
              {action.label}
            </span>
          </div>
        );
      })}

      {settingsOpen && (
        <>
          <div
            className="pointer-events-auto fixed inset-0 touch-none"
            style={{ zIndex: -1 }}
            aria-hidden="true"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            className="hf-nav-panel-in pointer-events-auto absolute select-none rounded-2xl px-4 pb-4 pt-3 text-white shadow-[0_-6px_24px_rgba(0,0,0,0.25)] backdrop-blur-sm [-webkit-touch-callout:none]"
            style={{
              left: 8,
              right: 8,
              bottom: ARC_REST_HEIGHT + 10,
              maxHeight: Math.max(200, nav.top - ARC_REST_HEIGHT - 90),
              overflowY: "auto",
              backgroundColor: "rgba(20,20,20,0.92)",
              fontFamily: "var(--font-hf-body)",
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="hf-type-small hf-type-strong">{t("addButton.settingsHint")}</span>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="hf-type-small hf-type-strong"
                style={{ color: "var(--hf-green-light)" }}
              >
                {t("addButton.settingsDone")}
              </button>
            </div>

            <div ref={poolRef} className="mb-4 flex min-h-16 flex-wrap gap-3">
              {poolActions.map((action) => {
                const key = action.key as AddActionKey;
                const isPlaceholder = draggedKey === key && panelDrag?.source === "pool";
                return (
                  <button
                    key={key}
                    type="button"
                    onPointerDown={(event) => beginPanelDrag(key, "pool", event)}
                    className={`flex h-16 min-w-16 flex-none touch-none select-none flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 ${
                      isPlaceholder ? "border-dashed border-white/40 bg-transparent" : "border-white/10 bg-white/10"
                    }`}
                  >
                    <span className={`flex flex-col items-center gap-1 ${isPlaceholder ? "invisible" : ""}`}>
                      {action.imageSrc ? (
                        // Billed-ikoner er mørke og fyldte — på en lys prik, så de ikke bliver en hvid klat.
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-hf-tan">
                          <ActionGlyph action={action} color="var(--hf-black)" />
                        </span>
                      ) : (
                        <ActionGlyph action={action} color="#fff" />
                      )}
                      <span className="hf-type-micro whitespace-nowrap text-center">{action.label}</span>
                    </span>
                  </button>
                );
              })}
              {poolActions.length === 0 && (
                <span className="hf-type-small self-center text-white/60">{t("addButton.settingsAllInUse")}</span>
              )}
            </div>

            <div ref={rowRef} className="flex items-center">
              {rowCells.map((key, index) => {
                const action = key ? actionsByKey.get(key) : null;
                const isList = key === "list";
                const isPlaceholder = draggedKey === key && panelDrag?.source === "row";
                return (
                  <div key={index} className="flex flex-1 justify-center">
                    {action && key ? (
                      <button
                        type="button"
                        aria-label={action.label}
                        onPointerDown={(event) => {
                          if (!isList) beginPanelDrag(key as AddActionKey, "row", event);
                        }}
                        className={`relative flex touch-none select-none items-center justify-center rounded-full ${
                          isPlaceholder ? "border border-dashed border-white/40" : "bg-hf-tan"
                        } ${!isList && !isPlaceholder ? "hf-nav-jiggle" : ""}`}
                        style={{ width: ARC_ICON, height: ARC_ICON }}
                      >
                        {!isList && !isPlaceholder && (
                          <span
                            role="button"
                            aria-label={t("addButton.settingsRemove", { item: action.label })}
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={(event) => {
                              event.stopPropagation();
                              savePanelKeys(chosenRef.current.filter((k) => k !== key));
                            }}
                            className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black"
                          >
                            <IconX size={13} stroke={2.2} color="var(--hf-tan)" />
                          </span>
                        )}
                        <span className={isPlaceholder ? "invisible" : "flex"}>
                          <ActionGlyph action={action} color="var(--hf-black)" />
                        </span>
                      </button>
                    ) : (
                      <span
                        className="rounded-full border border-dashed border-white/25"
                        style={{ width: ARC_ICON, height: ARC_ICON }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {panelDrag?.moved && actionsByKey.get(panelDrag.key) && (
            <div
              className="pointer-events-none fixed z-50 flex items-center justify-center rounded-full bg-hf-tan opacity-90"
              style={{ left: panelDrag.x - ARC_ICON / 2, top: panelDrag.y - ARC_ICON / 2, width: ARC_ICON, height: ARC_ICON }}
            >
              <ActionGlyph action={actionsByKey.get(panelDrag.key)!} color="var(--hf-black)" />
            </div>
          )}
        </>
      )}

      {menuSheetOpen && <AddMenuSheet onClose={() => setMenuSheetOpen(false)} />}
    </div>
  );
}
