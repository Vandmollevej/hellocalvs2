"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { IconList, IconPlus, type Icon } from "@tabler/icons-react";
import {
  MAX_WHEEL_ACTIONS,
  addActionByKey,
  saveWheelActionKeys,
  useAddActionsProfile,
  useWheelActionKeys,
  visibleAddActions,
  type AddActionKey,
} from "@/lib/add-actions";
import {
  ARC_BULGE_MAX,
  ARC_ICON_CIRCLE,
  ARC_MAX_USER_ACTIONS,
  ARC_RADIUS,
  ARC_REST_HEIGHT,
  fanAngles,
  fanLayout,
  labelPlacement,
  labelWidth,
  listSlotIndex,
  segmentPath,
} from "@/lib/footer-arc";
import { useIsSerious } from "@/lib/use-subscription-tier";
import { useTranslation } from "@/i18n/LocaleProvider";
import { AddMenuSheet } from "@/components/add/AddMenuSheet";
import { FooterArcEditor } from "@/components/FooterArcEditor";

// Lille, fast halvcirkel over bundmenuen midt imellem de to midterste knapper
// (brugerens ønske 2026-10-07). Hvile: et fast cirkelstykke på ca. 40 px med et
// stort plus. Skub op med fingeren: cirklen vokser til samme størrelse som venstre-cirklen
// (AddButton) og viser viften — "alle" altid i midten, så et lodret træk op
// altid rammer "alle". Slip på en knap åbner den. Cirklen står fast og kan ikke
// trækkes til siden. Tryk åbner den (samme størrelse som ved træk op). Hold fingeren
// stille som i footeren (LONG_PRESS_MS) åbner redigeringen (FooterArcEditor).
// Den eksisterende venstre-cirkel (AddButton) er urørt.

const LONG_PRESS_MS = 550;
const MOVE_PX = 8;
const DEAD_ZONE = 34;
const HIGHLIGHT_SCALE = 1.35;
// Trækker man højere op end cirklen, må fingeren aldrig komme oven på den:
// den markerede cirkel holdes mindst så højt over fingerspidsen.
const FINGER_CLEARANCE = 62;
// Plads øverst på skærmen, så cirklen og dens tekst ikke skæres af.
const TOP_ROOM = 90;
const ANIMATION_MS = 200;
const ICON_SIZE = 26;

export type ArcSlot = {
  key: string;
  href: string;
  label: string;
  icon?: Icon;
  imageSrc?: string;
};

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  mode: "undecided" | "pull" | "select";
  moved: boolean;
  wasOpen: boolean;
  /** Cirklen er sprunget til fuld størrelse (første træk opad). */
  expanded: boolean;
  consumed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function FooterArc() {
  const { t } = useTranslation();
  const router = useRouter();
  const isSerious = useIsSerious();
  const keys = useWheelActionKeys();
  const profile = useAddActionsProfile();

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
  const highlightedRef = useRef<string | null>(null);
  const [gesturing, setGesturing] = useState(false);
  // Fingerens placering i forhold til cirklens midte (px opad/til siden) — får kanten til at pose ud og plusset til at følge med.
  const [finger, setFinger] = useState<{ dx: number; dy: number; top: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [menuSheetOpen, setMenuSheetOpen] = useState(false);
  const gestureRef = useRef<Gesture | null>(null);
  const animationRef = useRef<number | null>(null);

  const allowed = new Set(visibleAddActions(profile).map((action) => action.key));
  const userKeys = keys.filter((key) => allowed.has(key)).slice(0, ARC_MAX_USER_ACTIONS);
  const userSlots: ArcSlot[] = userKeys
    .map((key) => addActionByKey(key, profile.sex))
    .filter((action): action is NonNullable<typeof action> => Boolean(action))
    .map((action) => ({
      key: action.key,
      href: action.href,
      label: t(action.labelKey),
      icon: action.icon,
      imageSrc: action.imageSrc,
    }));
  const listSlot: ArcSlot = { key: "list", href: "/add/menu", label: t("addButton.list"), icon: IconList };
  const mid = listSlotIndex(userSlots.length);
  const slots = [...userSlots.slice(0, mid), listSlot, ...userSlots.slice(mid)];
  const angles = fanAngles(userSlots.length);

  useLayoutEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const measure = () => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      document.body.classList.remove("select-none");
    },
    [],
  );

  // Cirklen står altid fast midt over footeren og kan ikke trækkes til siden.
  const baseCx = width / 2;
  const cx = baseCx;
  const layout = fanLayout(angles, baseCx, width);
  // Den fremhævede knap træder længere ud (som venstre-cirklen); valg af knap sker ud fra hvilepladserne.
  const highlightedIndex = slots.findIndex((slot) => slot.key === highlightedKey);
  const drawLayout = highlightedIndex >= 0 ? fanLayout(angles, baseCx, width, highlightedIndex) : layout;
  const visibleHeight = ARC_REST_HEIGHT + (ARC_RADIUS - ARC_REST_HEIGHT) * progress;

  const setP = useCallback((value: number) => {
    progressRef.current = value;
    setProgress(value);
  }, []);

  const animateTo = useCallback(
    (target: number) => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      const from = progressRef.current;
      const started = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - started) / ANIMATION_MS);
        const eased = 1 - (1 - k) * (1 - k);
        setP(from + (target - from) * eased);
        animationRef.current = k < 1 ? requestAnimationFrame(step) : null;
      };
      animationRef.current = requestAnimationFrame(step);
    },
    [setP],
  );

  function setOpenState(next: boolean) {
    openRef.current = next;
    setOpen(next);
    animateTo(next ? 1 : 0);
  }

  function setHighlight(key: string | null) {
    highlightedRef.current = key;
    setHighlightedKey(key);
  }

  function slotCenter(index: number) {
    return layout[index];
  }

  function updateHighlight(event: React.PointerEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = event.clientX - rect.left;
    const py = rect.top - event.clientY; // px opad fra footerkanten
    const center = baseCx;
    setFinger({ dx: px - center, dy: py, top: rect.top });
    if (Math.hypot(px - center, py) < DEAD_ZONE) {
      setHighlight(null);
      return;
    }
    // Valget går på retning fra cirklen, ikke afstand: fingeren helt ude til siden rammer altid den yderste knap.
    const fingerDeg = (Math.atan2(px - center, Math.max(1, py)) * 180) / Math.PI;
    let nearest: string | null = null;
    let best = Infinity;
    slots.forEach((slot, index) => {
      const c = slotCenter(index);
      const diff = Math.abs(fingerDeg - (Math.atan2(c.x - center, Math.max(1, c.y)) * 180) / Math.PI);
      if (diff < best) {
        best = diff;
        nearest = slot.key;
      }
    });
    setHighlight(nearest);
  }

  function activate(slot: ArcSlot) {
    if (slot.key === "list") setMenuSheetOpen(true);
    else router.push(slot.href);
  }

  function clearTimer(gesture: Gesture | null) {
    if (gesture?.timer) {
      clearTimeout(gesture.timer);
      gesture.timer = null;
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || gestureRef.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignorér (pointer allerede sluppet).
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    const gesture: Gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: "undecided",
      moved: false,
      wasOpen: openRef.current,
      expanded: false,
      consumed: false,
      timer: null,
    };
    // Holdes fingeren stille lige så længe som i footeren, åbnes redigeringen
    // (kun Seriøs, som footerens omarrangering).
    if (isSerious) {
      gesture.timer = setTimeout(() => {
        gesture.timer = null;
        if (gestureRef.current !== gesture || gesture.moved) return;
        gesture.consumed = true;
        setHighlight(null);
        setFinger(null);
        setGesturing(false);
        setEditing(true);
      }, LONG_PRESS_MS);
    }
    gestureRef.current = gesture;
    setGesturing(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesture.consumed) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved) {
      if (Math.hypot(dx, dy) <= MOVE_PX) return;
      gesture.moved = true;
      clearTimer(gesture);
      if (gesture.wasOpen) gesture.mode = "select";
      else gesture.mode = "pull";
      document.body.classList.add("select-none");
    }
    if (gesture.mode === "pull") {
      // Så snart fingeren er trukket opad, springer cirklen og knapperne
      // straks til fuld størrelse — ingen animation, ingen gradvis vækst.
      if (!gesture.expanded && gesture.startY - event.clientY > 0) {
        gesture.expanded = true;
        openRef.current = true;
        setOpen(true);
        setP(1);
      }
      if (gesture.expanded) updateHighlight(event);
    } else if (gesture.mode === "select") {
      updateHighlight(event);
    }
  }

  function finishGesture(event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    clearTimer(gesture);
    gestureRef.current = null;
    document.body.classList.remove("select-none");
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignorér.
    }
    setGesturing(false);
    setFinger(null);
    if (gesture.consumed) return;

    const key = highlightedRef.current;
    setHighlight(null);

    if (cancelled) {
      setOpenState(false);
      return;
    }
    if (!gesture.moved) {
      setOpenState(!gesture.wasOpen);
      return;
    }
    const slot = key ? slots.find((candidate) => candidate.key === key) : null;
    if (slot) {
      setOpenState(false);
      activate(slot);
      return;
    }
    // Trukket op uden at ramme en knap: cirklen bliver åben i fuld størrelse.
    setOpenState(gesture.mode === "pull" && gesture.expanded);
  }

  const showFan = progress > 0.02;
  const hitHeight = Math.max(44, visibleHeight);
  const bulgeActive = Boolean(finger) && progress > 0.3;
  const fingerDistance = finger ? Math.hypot(finger.dx, finger.dy) : 0;
  const bulgeDeg = finger ? (Math.atan2(finger.dx, Math.max(1, finger.dy)) * 180) / Math.PI : null;
  const bulgeAmount = bulgeActive ? ARC_BULGE_MAX * Math.min(1, fingerDistance / (ARC_RADIUS * 1.5)) : 0;
  // Plusset følger fingeren lidt (højere op, jo længere op fingeren er).
  const plusFollows = Boolean(finger) && progress > 0.1;
  const plusLeft = plusFollows && finger ? cx + clamp(finger.dx * 0.4, -ARC_RADIUS * 0.5, ARC_RADIUS * 0.5) : cx;
  const plusBottom =
    plusFollows && finger ? Math.max(visibleHeight / 2, Math.min(finger.dy * 0.5, visibleHeight * 0.8)) : visibleHeight / 2;

  return (
    <div ref={wrapRef} className="pointer-events-none relative z-30 h-0 w-full select-none [-webkit-touch-callout:none]">
      {open && !gesturing && (
        <div
          className="pointer-events-auto fixed inset-0"
          style={{ zIndex: -1 }}
          aria-hidden="true"
          onClick={() => setOpenState(false)}
        />
      )}

      <svg
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: cx - ARC_RADIUS, bottom: 0, width: ARC_RADIUS * 2, height: ARC_RADIUS + ARC_BULGE_MAX }}
        viewBox={`0 0 ${ARC_RADIUS * 2} ${ARC_RADIUS + ARC_BULGE_MAX}`}
      >
        <path d={segmentPath(visibleHeight, bulgeDeg, bulgeAmount)} fill="var(--hf-green)" />
      </svg>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute flex items-center justify-center text-hf-white"
        style={{
          left: plusLeft,
          bottom: plusBottom,
          transform: `translate(-50%, 50%) rotate(${plusFollows ? 0 : progress * 45}deg)`,
        }}
      >
        <IconPlus size={33 + progress * 27} stroke={2.4} />
      </span>

      <button
        type="button"
        aria-label={open ? t("footerArc.close") : t("footerArc.open")}
        aria-expanded={open}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishGesture(event, false)}
        onPointerCancel={(event) => finishGesture(event, true)}
        onContextMenu={(event) => event.preventDefault()}
        className="pointer-events-auto absolute border-0 bg-transparent p-0"
        style={{ left: cx - 60, bottom: 0, width: 120, height: hitHeight, touchAction: "none" }}
      />

      {slots.map((slot, index) => {
        const base = drawLayout[index];
        const highlighted = highlightedKey === slot.key;
        // Den markerede knap må aldrig ende under fingeren: hold den over fingerspidsen.
        let centerY = base.y;
        if (highlighted && finger) {
          const roomAbove = finger.top - TOP_ROOM;
          centerY = Math.max(centerY, Math.min(finger.dy + FINGER_CLEARANCE, Math.max(centerY, roomAbove)));
        }
        const center = { x: base.x, y: centerY };
        const Icon = slot.icon;
        return (
          <div
            key={slot.key}
            className="absolute"
            style={{
              left: center.x - ARC_ICON_CIRCLE / 2,
              bottom: center.y - ARC_ICON_CIRCLE / 2,
              width: ARC_ICON_CIRCLE,
              height: ARC_ICON_CIRCLE,
              transition: "left 120ms ease, bottom 120ms ease",
            }}
          >
            <button
              type="button"
              aria-label={slot.label}
              tabIndex={open ? 0 : -1}
              onClick={() => {
                if (!open || gesturing) return;
                setOpenState(false);
                activate(slot);
              }}
              className="absolute inset-0 flex items-center justify-center rounded-full border-0 bg-hf-tan"
              style={{
                // Som venstre-cirklen: knapperne vises med det samme (kort fade/pop),
                // ikke gradvist efter hvor langt cirklen er trukket op.
                opacity: showFan ? 1 : 0,
                pointerEvents: open && !gesturing ? "auto" : "none",
                transform: `scale(${(showFan ? 1 : 0.4) * (highlighted ? HIGHLIGHT_SCALE : 1)})`,
                backgroundColor: highlighted ? "var(--hf-green)" : undefined,
                boxShadow: highlighted
                  ? "0 8px 18px rgba(0,0,0,0.15), 0 3px 8px rgba(0,0,0,0.08)"
                  : "0 2px 5px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.05)",
                transition: "transform 150ms ease, opacity 150ms ease, background-color 120ms ease",
              }}
            >
              {Icon ? (
                <Icon size={ICON_SIZE} color={highlighted ? "var(--hf-white)" : "var(--hf-black)"} />
              ) : (
                <Image
                  src={slot.imageSrc!}
                  alt=""
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  className="object-contain"
                  style={highlighted ? { filter: "brightness(0) invert(1)" } : undefined}
                />
              )}
            </button>
            {highlighted &&
              (() => {
                const w = labelWidth(slot.label);
                const spot = labelPlacement(
                  drawLayout.map((p, i) => (i === index ? center : p)),
                  index,
                  baseCx,
                  width,
                  w,
                );
                return (
                  <span
                    aria-hidden="true"
                    className="hf-type-strong pointer-events-none absolute whitespace-nowrap bg-hf-tan text-center"
                    style={{
                      left: spot.left - (center.x - ARC_ICON_CIRCLE / 2),
                      bottom: spot.bottom - (center.y - ARC_ICON_CIRCLE / 2),
                      width: w,
                      padding: "6px 0",
                      borderRadius: 3,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
                      color: "var(--hf-green)",
                      fontSize: 15,
                    }}
                  >
                    {slot.label}
                  </span>
                );
              })()}
          </div>
        );
      })}

      {menuSheetOpen && <AddMenuSheet onClose={() => setMenuSheetOpen(false)} />}
      {editing && (
        <FooterArcEditor
          userSlots={userSlots}
          listSlot={listSlot}
          poolKeys={visibleAddActions(profile)
            .map((action) => action.key)
            .filter((key) => !keys.includes(key))}
          sex={profile.sex}
          onChange={(nextUserKeys: AddActionKey[]) => {
            const tail = keys.slice(ARC_MAX_USER_ACTIONS).filter((key) => !nextUserKeys.includes(key));
            saveWheelActionKeys([...nextUserKeys, ...tail].slice(0, MAX_WHEEL_ACTIONS));
          }}
          onClose={() => {
            setEditing(false);
            setOpenState(false);
          }}
        />
      )}
    </div>
  );
}
