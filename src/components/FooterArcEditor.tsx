"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { IconX, type Icon } from "@tabler/icons-react";
import { addActionByKey, type AddActionKey } from "@/lib/add-actions";
import {
  ARC_ICON_CIRCLE,
  ARC_ICON_RADIUS,
  ARC_MAX_USER_ACTIONS,
  ARC_RADIUS,
  fanAngles,
  listSlotIndex,
} from "@/lib/footer-arc";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { ArcSlot } from "@/components/FooterArc";

// Redigering af halvcirklens knapper (hold fingeren stille på den): et sort,
// kun lidt gennemsigtigt vindue åbner ovenpå. Samme greb som i footeren:
// træk en knap ned i panelet for at fjerne den, tryk på (eller træk op) en
// knap i panelet for at lægge den i cirklen, og træk en knap hen over en anden
// for at bytte plads (de to bytter, med glidende animation). Trækkes en knap
// op fra panelet og slippes på en knap i cirklen, tager den pladsen, og den
// ramte knap falder ned i panelet (ubrugt). "Alle" står fast i midten. Vist er
// kun 1/2 cirkel, og den hviler på panelets overkant.

const ICON_SIZE = 26;
const MOVE_PX = 8;

type Drag = { key: string; source: "active" | "pool"; x: number; y: number; moved: boolean; overPanel: boolean };

function Glyph({ icon, imageSrc, color, filter }: { icon?: Icon; imageSrc?: string; color: string; filter?: string }) {
  const IconComponent = icon;
  if (IconComponent) return <IconComponent size={ICON_SIZE} color={color} />;
  return (
    <Image src={imageSrc!} alt="" width={ICON_SIZE} height={ICON_SIZE} className="object-contain" style={{ filter }} />
  );
}

export function FooterArcEditor({
  userSlots,
  listSlot,
  poolKeys,
  sex,
  onChange,
  onClose,
}: {
  userSlots: ArcSlot[];
  listSlot: ArcSlot;
  poolKeys: AddActionKey[];
  sex: "FEMALE" | "MALE" | null;
  onChange: (userKeys: AddActionKey[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef(new Map<string, HTMLElement>());
  const dragRef = useRef<Drag | null>(null);
  const userKeysRef = useRef<AddActionKey[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [panelHeight, setPanelHeight] = useState(180);
  const [mounted, setMounted] = useState(false);
  // Knap der lige er skiftet plads/ramt: får en lille "pop"-animation.
  const [popKey, setPopKey] = useState<string | null>(null);
  // Plads i viften (key), som en knap fra panelet svæver over: den vil falde ned.
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const userKeys = userSlots.map((slot) => slot.key as AddActionKey);
  useEffect(() => {
    userKeysRef.current = userKeys;
  });

  // Pop-animationen er kort; klassen fjernes igen, så knappens jiggle ikke overstyres.
  useEffect(() => {
    if (!popKey) return;
    const timer = setTimeout(() => setPopKey(null), 320);
    return () => clearTimeout(timer);
  }, [popKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- portal først efter mount (SSR)
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const measure = () => setPanelHeight(panel.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [mounted, poolKeys.length]);

  // Stop baggrundsscroll, mens vinduet er åbent (som footerens panel).
  useEffect(() => {
    function block(event: TouchEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
    }
    document.addEventListener("touchmove", block, { passive: false });
    return () => document.removeEventListener("touchmove", block);
  }, []);

  const mid = listSlotIndex(userSlots.length);
  const fanSlots = [...userSlots.slice(0, mid), listSlot, ...userSlots.slice(mid)];
  const angles = fanAngles(userSlots.length);
  const dragKey = drag?.moved ? drag.key : null;

  function overPanel(x: number, y: number) {
    const rect = panelRef.current?.getBoundingClientRect();
    return Boolean(rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom);
  }

  // Nærmeste plads i viften (ikke "alle") under fingeren, ellers null.
  function nearestUserSlot(x: number, y: number, maxDistance: number) {
    let best: { key: string; index: number; distance: number } | null = null;
    fanSlots.forEach((slot, index) => {
      const el = slotRefs.current.get(slot.key);
      if (!el || slot.key === "list") return;
      const rect = el.getBoundingClientRect();
      const distance = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      if (distance <= maxDistance && (!best || distance < best.distance)) best = { key: slot.key, index, distance };
    });
    return best as { key: string; index: number; distance: number } | null;
  }

  // Fra panelet: rammer knappen en plads i cirklen, bytter de (den ramte
  // falder ned i panelet); ellers lægges den ind, hvis der er plads.
  function addAt(key: AddActionKey, x: number | null, y: number | null) {
    const current = userKeysRef.current;
    if (current.includes(key)) return;
    if (x !== null && y !== null) {
      const hit = nearestUserSlot(x, y, ARC_ICON_CIRCLE * 0.8);
      if (hit) {
        const target = hit.key as AddActionKey;
        onChange(current.map((existing) => (existing === target ? key : existing)));
        setPopKey(target);
        return;
      }
    }
    if (current.length >= ARC_MAX_USER_ACTIONS) return;
    let position = current.length;
    if (x !== null && y !== null) {
      const near = nearestUserSlot(x, y, Infinity);
      if (near) position = near.index > mid ? near.index - 1 : near.index;
    }
    const next = [...current];
    next.splice(Math.min(position, next.length), 0, key);
    onChange(next);
    setPopKey(key);
  }

  function removeKey(key: string) {
    onChange(userKeysRef.current.filter((existing) => existing !== key));
    setPopKey(key);
  }

  function begin(key: string, source: Drag["source"], event: React.PointerEvent) {
    setPopKey(null);
    const state: Drag = { key, source, x: event.clientX, y: event.clientY, moved: false, overPanel: false };
    dragRef.current = state;
    setDrag(state);
  }

  useEffect(() => {
    if (!drag) return;
    const startX = drag.x;
    const startY = drag.y;

    function onMove(event: PointerEvent) {
      const current = dragRef.current;
      if (!current) return;
      const moved = current.moved || Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_PX;
      const next = { ...current, x: event.clientX, y: event.clientY, moved, overPanel: overPanel(event.clientX, event.clientY) };
      dragRef.current = next;
      setDrag(next);
      if (moved && current.source === "active") {
        const near = nearestUserSlot(event.clientX, event.clientY, ARC_ICON_CIRCLE * 0.6);
        if (near && near.key !== current.key) {
          // De to knapper bytter plads; pladserne glider til deres nye sted.
          const keys = [...userKeysRef.current];
          const from = keys.indexOf(current.key as AddActionKey);
          const to = keys.indexOf(near.key as AddActionKey);
          if (from !== -1 && to !== -1) {
            [keys[from], keys[to]] = [keys[to], keys[from]];
            onChange(keys);
          }
        }
      } else if (moved && current.source === "pool") {
        const near = nearestUserSlot(event.clientX, event.clientY, ARC_ICON_CIRCLE * 0.8);
        setDropTarget(near ? near.key : null);
      }
    }

    function onUp(event: PointerEvent) {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      setDropTarget(null);
      if (!current) return;
      if (current.source === "active") {
        if (current.moved && overPanel(event.clientX, event.clientY)) removeKey(current.key);
        return;
      }
      if (!current.moved) addAt(current.key as AddActionKey, null, null);
      else if (!overPanel(event.clientX, event.clientY)) addAt(current.key as AddActionKey, event.clientX, event.clientY);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trækket styres via dragRef; kun start/stop afhænger af `drag`
  }, [drag === null]);

  if (!mounted) return null;

  const dragged = drag?.moved ? fanSlots.find((slot) => slot.key === drag.key) : null;
  const draggedPool = drag?.moved && drag.source === "pool" ? addActionByKey(drag.key as AddActionKey, sex) : null;
  const overPanelNow = drag?.moved && drag.source === "active" && drag.overPanel;

  return createPortal(
    <div className="fixed inset-0 z-[90] select-none [-webkit-touch-callout:none]">
      <div className="absolute inset-0 bg-hf-black/80" aria-hidden="true" onClick={onClose} />

      {/* Halv cirkel med knapperne, over panelet. */}
      <div
        className="pointer-events-none absolute left-1/2"
        style={{ bottom: panelHeight - 1, width: 0, height: 0 }}
      >
        <svg
          aria-hidden="true"
          className="absolute"
          style={{ left: -ARC_RADIUS, bottom: 0, width: ARC_RADIUS * 2, height: ARC_RADIUS }}
          viewBox={`0 0 ${ARC_RADIUS * 2} ${ARC_RADIUS}`}
        >
          <path d={`M0,${ARC_RADIUS} A${ARC_RADIUS},${ARC_RADIUS} 0 0 1 ${ARC_RADIUS * 2},${ARC_RADIUS} Z`} fill="var(--hf-green)" />
        </svg>
        {fanSlots.map((slot, index) => {
          const rad = (angles[index] * Math.PI) / 180;
          const x = ARC_ICON_RADIUS * Math.sin(rad);
          const y = ARC_ICON_RADIUS * Math.cos(rad);
          const isList = slot.key === "list";
          const placeholder = dragKey === slot.key;
          return (
            <div
              key={slot.key}
              ref={(el) => {
                if (el) slotRefs.current.set(slot.key, el);
                else slotRefs.current.delete(slot.key);
              }}
              className="absolute"
              style={{
                left: x - ARC_ICON_CIRCLE / 2,
                bottom: y - ARC_ICON_CIRCLE / 2,
                width: ARC_ICON_CIRCLE,
                height: ARC_ICON_CIRCLE,
                // Når to knapper bytter plads, glider de hen til hinandens plads.
                transition: "left 240ms cubic-bezier(0.22, 1, 0.36, 1), bottom 240ms cubic-bezier(0.22, 1, 0.36, 1), transform 160ms ease, opacity 160ms ease",
                transform: dropTarget === slot.key ? "scale(0.78)" : undefined,
                opacity: dropTarget === slot.key ? 0.55 : 1,
              }}
            >
              <div
                className={`pointer-events-auto relative flex h-full w-full touch-none items-center justify-center rounded-full ${
                  placeholder ? "border border-dashed border-hf-gray-dark bg-transparent" : "bg-hf-tan"
                } ${!isList && !placeholder ? "hf-nav-jiggle" : ""} ${popKey === slot.key ? "hf-arc-pop" : ""}`}
                onPointerDown={isList ? undefined : (event) => begin(slot.key, "active", event)}
                aria-label={slot.label}
              >
                {!placeholder && <Glyph icon={slot.icon} imageSrc={slot.imageSrc} color="var(--hf-black)" />}
                {!isList && !placeholder && (
                  <span
                    role="button"
                    aria-label={t("footerArc.removeItem", { item: slot.label })}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeKey(slot.key);
                    }}
                    className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-hf-black"
                  >
                    <IconX size={13} stroke={2.2} color="var(--hf-tan)" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={panelRef}
        className={`bg-hf-card hf-nav-panel-in absolute bottom-0 left-0 right-0 rounded-t-2xl border border-b-0 px-4 pb-6 pt-4 ${
          overPanelNow ? "border-dashed border-hf-gray-dark" : "border-hf-tan-dark"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="hf-type-small hf-type-strong text-hf-action font-hf-body">
            {t("footerArc.editHint")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="hf-type-small hf-type-strong text-hf-brand font-hf-body"
          >
            {t("footerArc.done")}
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          {poolKeys.map((key) => {
            const action = addActionByKey(key, sex);
            if (!action) return null;
            const label = t(action.labelKey);
            const placeholder = dragKey === key;
            return (
              <button
                key={key}
                type="button"
                onPointerDown={(event) => begin(key, "pool", event)}
                aria-label={t("footerArc.addItem", { item: label })}
                className={`flex h-[64px] min-w-16 flex-none touch-none flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 ${
                  placeholder ? "border-dashed border-hf-gray-dark bg-transparent" : "border-hf-tan-dark bg-hf-tan-dark"
                } ${popKey === key ? "hf-arc-pop" : ""}`}
              >
                <span className={`flex flex-col items-center gap-1 ${placeholder ? "invisible" : ""}`}>
                  <Glyph icon={action.icon} imageSrc={action.imageSrc} color="var(--hf-black)" />
                  <span className="hf-type-micro whitespace-nowrap text-center text-hf-action font-hf-body">
                    {label}
                  </span>
                </span>
              </button>
            );
          })}
          {poolKeys.length === 0 && (
            <span className="hf-type-small text-hf-text-secondary font-hf-body">
              {t("footerArc.allInUse")}
            </span>
          )}
        </div>
      </div>

      {drag?.moved && (dragged || draggedPool) && (
        <div
          className="pointer-events-none fixed z-[95] flex w-16 flex-col items-center gap-1 opacity-90"
          style={{ left: drag.x - 32, top: drag.y - 32 }}
        >
          <Glyph
            icon={(dragged ?? draggedPool)?.icon}
            imageSrc={(dragged ?? draggedPool)?.imageSrc}
            color="var(--hf-white)"
            filter="brightness(0) invert(1)"
          />
        </div>
      )}
    </div>,
    document.body,
  );
}
