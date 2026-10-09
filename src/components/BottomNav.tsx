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
  IconRefresh,
  IconBulb,
  IconBook2,
  IconChartLine,
  IconUsers,
} from "@tabler/icons-react";
import { IconFavorite } from "@/components/icons/Favorite";
import { IconPhotoFrame } from "@/components/icons/PhotoFrame";
import { IconWaistMeasure } from "@/components/icons/WaistMeasure";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileSwitchList } from "@/components/family/ProfileSwitcher";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useIsCompactLandscape } from "@/hooks/useIsCompactLandscape";
import { useIsSerious } from "@/lib/use-subscription-tier";
import {
  BOTTOM_NAV_CHANGED_EVENT,
  BOTTOM_NAV_HREFS,
  BOTTOM_NAV_STORAGE_KEY,
  DEFAULT_BOTTOM_NAV_ACTIVE,
} from "@/lib/navigation";
import { FooterArc } from "@/components/FooterArc";

const ICON_SIZE = 24;
// Aktiv/inaktiv fane: tekstfarven og den sekundære grå (tokens i globals.css).
const NAV_ACTIVE_COLOR = "var(--hf-color-action)";
const NAV_INACTIVE_COLOR = "var(--hf-color-text-secondary)";
const PANEL_ICON_SIZE = 24;
const STORAGE_KEY = BOTTOM_NAV_STORAGE_KEY;
const LONG_PRESS_MS = 550;
const READY_MS = 1000;
const MOVE_CANCEL_PX = 10;
const SHEET_CLOSE_PX = 60;
const FLIP_MS = 220;
const FLIP_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const SLIDE_ANIMATION_ID = "nav-slide";
const PAGE_SIZE = 4;
// Som i statistik-gitteret: i redigering løfter et kort, stille tryk ikonet;
// bevæger fingeren sig først, er det et swipe, der ruller rækken.
const EDIT_LIFT_DELAY_MS = 250;
const EDGE_ZONE_PX = 56;
// Rækken ruller kontinuerligt (sider pr. sekund) når et løftet ikon holdes
// ved kanten; hastigheden vokser jo tættere på kanten.
const AUTO_SCROLL_MAX_PAGES_PER_S = 2.4;
const PAGE_ANIM_MS = 220;

export function TrendIcon({ color, size }: { color: string; size: number }) {
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
  // Uden href åbner ikonet et ark i stedet for en side (se `action`).
  href?: string;
  action?: "switchProfile";
  // Translation key under the "nav" namespace (src/i18n/locales/*.json).
  // The `key` field above stays the stable internal identity used for
  // localStorage layout persistence and must not be translated.
  labelKey: string;
  render: (color: string, size: number) => React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "tilfoej",
    href: BOTTOM_NAV_HREFS.tilfoej,
    labelKey: "add",
    render: (color, size) => <IconPlus size={size} stroke={1.6} color={color} />,
  },
  {
    key: "madvarer",
    href: BOTTOM_NAV_HREFS.madvarer,
    labelKey: "foods",
    render: (color, size) => <IconApple size={size} stroke={1.6} color={color} />,
  },
  {
    key: "kalender",
    href: BOTTOM_NAV_HREFS.kalender,
    labelKey: "calendar",
    render: (color, size) => <IconCalendar size={size} stroke={1.6} color={color} />,
  },
  {
    key: "statistik",
    href: BOTTOM_NAV_HREFS.statistik,
    labelKey: "statistics",
    render: (color, size) => <TrendIcon color={color} size={size} />,
  },
  {
    key: "kamera",
    href: BOTTOM_NAV_HREFS.kamera,
    labelKey: "camera",
    render: (color, size) => <IconCamera size={size} stroke={1.6} color={color} />,
  },
  {
    key: "soeg",
    href: BOTTOM_NAV_HREFS.soeg,
    labelKey: "search",
    render: (color, size) => <IconSearch size={size} stroke={1.6} color={color} />,
  },
  {
    key: "stemme",
    href: BOTTOM_NAV_HREFS.stemme,
    labelKey: "voice",
    render: (color, size) => <IconMicrophone size={size} stroke={1.6} color={color} />,
  },
  {
    key: "profil",
    href: BOTTOM_NAV_HREFS.profil,
    labelKey: "profile",
    render: (color, size) => <IconUser size={size} stroke={1.6} color={color} />,
  },
  {
    key: "favoritter",
    href: BOTTOM_NAV_HREFS.favoritter,
    labelKey: "favorites",
    render: (color, size) => <IconFavorite size={size} color={color} />,
  },
  {
    key: "viden",
    href: BOTTOM_NAV_HREFS.viden,
    labelKey: "knowledge",
    render: (color, size) => <IconBulb size={size} stroke={1.6} color={color} />,
  },
  {
    key: "opskrifter",
    href: BOTTOM_NAV_HREFS.opskrifter,
    labelKey: "recipes",
    render: (color, size) => <IconBook2 size={size} stroke={1.6} color={color} />,
  },
  {
    key: "status",
    href: BOTTOM_NAV_HREFS.status,
    labelKey: "status",
    render: (color, size) => <IconChartLine size={size} stroke={1.6} color={color} />,
  },
  {
    key: "billeddagbog",
    href: BOTTOM_NAV_HREFS.billeddagbog,
    labelKey: "photoDiary",
    render: (color, size) => <IconPhotoFrame size={size} stroke={1.6} color={color} />,
  },
  {
    key: "kropsmaal",
    href: BOTTOM_NAV_HREFS.kropsmaal,
    labelKey: "bodyMeasurements",
    render: (color, size) => <IconWaistMeasure size={size} color={color} />,
  },
  {
    // Kun med familieabonnement (se SWITCH_PROFILE_KEY nedenfor).
    key: "skiftkonto",
    action: "switchProfile",
    labelKey: "switchProfile",
    render: (color, size) => <IconUsers size={size} stroke={1.6} color={color} />,
  },
];

const SWITCH_PROFILE_KEY = "skiftkonto";

const ITEMS_BY_KEY = new Map(NAV_ITEMS.map((item) => [item.key, item]));
const DEFAULT_ACTIVE = DEFAULT_BOTTOM_NAV_ACTIVE;
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

// Fejlretninger/FEJLLISTE.md #7: brugeren bekræftede eksplicit at dette IKKE
// må hoppe mellem hele "sider" af 4 ikoner — det skal glide kontinuerligt,
// som en almindelig scroll-bar, og kunne flyttes selv ved at trække i blot
// ét ikon. `scrollPages` er derfor en flydende værdi (kan stå midt mellem to
// "sider"), ikke et heltal, og der snappes IKKE til nærmeste side ved slip.
type PageSwipeState = {
  pointerId: number;
  startX: number;
  startScrollPages: number;
};

function overRect(el: HTMLElement | null, clientX: number, clientY: number) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

// Pladsen i bundbaren under fingeren (0..PAGE_SIZE-1 på den viste side),
// omregnet til et indeks i hele listen. Bruges i stedet for "nærmeste andet
// ikon", som fik det trukne ikon til at hoppe frem og tilbage mellem to
// naboer ved hver bevægelse (6a503586).
function slotIndexAt(bar: HTMLElement | null, clientX: number, scrollPages: number) {
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  const slotWidth = r.width / PAGE_SIZE;
  // Rækken kan stå midt mellem to sider, så pladsen regnes i rullet indhold.
  return Math.max(0, Math.floor((clientX - r.left) / slotWidth + scrollPages * PAGE_SIZE));
}

// sx: skærmposition, nx: position i rullet indhold (= sx uden for rækken).
type IconPlace = { sx: number; nx: number; y: number; inBar: boolean };

function reduceMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Script-animation: vinder over vibrationen (CSS-animation) mens den kører,
// og vibrationen fortsætter af sig selv bagefter.
function slideIcon(el: HTMLElement, dx: number, dy: number, lift: boolean) {
  if (reduceMotion()) return;
  el.getAnimations().forEach((a) => {
    if (a.id === SLIDE_ANIMATION_ID) a.cancel();
  });
  el.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${lift ? 1.18 : 1})`,
        zIndex: 30,
        boxShadow: lift ? "0 10px 18px rgb(0 0 0 / 0.18)" : "none",
      },
      { transform: "translate(0px, 0px) scale(1)", zIndex: 30, boxShadow: "none" },
    ],
    { duration: FLIP_MS, easing: FLIP_EASING, id: SLIDE_ANIMATION_ID },
  );
}

// Mellemrummet (0..PAGE_SIZE) nærmest fingeren, omregnet til et indeks i hele
// listen. Et ikon fra panelet sættes ind mellem to ikoner, ikke oven på ét.
function gapIndexAt(bar: HTMLElement | null, clientX: number, scrollPages: number) {
  if (!bar) return null;
  const r = bar.getBoundingClientRect();
  const slotWidth = r.width / PAGE_SIZE;
  return Math.max(0, Math.round((clientX - r.left) / slotWidth + scrollPages * PAGE_SIZE));
}

export function BottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();

  const [activeKeys, setActiveKeys] = useState<string[]>(DEFAULT_ACTIVE);
  const [inactiveKeys, setInactiveKeys] = useState<string[]>(DEFAULT_INACTIVE);
  const [editMode, setEditMode] = useState(false);
  // Omarrangering af ikonerne er kun for Seriøs (docs/DECISIONS.md 2026-09-26).
  const isSerious = useIsSerious();
  // "Skift konto" findes kun med familieabonnement eller i en familie (samme
  // regel som Familie-rækken i Indstillinger). null = endnu ikke hentet.
  const { status: familyStatus } = useFamilyStatus();
  const canSwitchProfile = familyStatus
    ? Boolean(familyStatus.hasFamilyPlan || familyStatus.family)
    : null;
  const [switchSheetOpen, setSwitchSheetOpen] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sheetOffset, setSheetOffset] = useState(0);
  const [sheetSnapping, setSheetSnapping] = useState(false);
  const [sheetDragActive, setSheetDragActive] = useState(false);
  const [scrollPages, setScrollPages] = useState(0);
  // Fejlretninger/FEJLLISTE.md #32B: i liggende format starter bundnav
  // foldet sammen til en smal håndtag-bjælke, for ikke at spise for meget af
  // den korte skærmhøjde — udfoldes ved tryk.
  const isCompactLandscape = useIsCompactLandscape();
  const [landscapeExpanded, setLandscapeExpanded] = useState(false);
  const showCollapsedBar = isCompactLandscape && !landscapeExpanded;
  const [pageSwipe, setPageSwipe] = useState<PageSwipeState | null>(null);

  const barRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLElement>());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pageSwipeRef = useRef<PageSwipeState | null>(null);
  const activeKeysRef = useRef(activeKeys);
  const scrollPagesRef = useRef(scrollPages);
  const sheetDrag = useRef<{ pointerId: number; startY: number } | null>(null);
  const prevPlaces = useRef(new Map<string, IconPlace>());
  const settleFrom = useRef<{ key: string; x: number; y: number } | null>(null);
  const pendingLift = useRef<{
    key: string;
    startX: number;
    startY: number;
    pointerId: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const autoScrollRaf = useRef<number | null>(null);

  const pages = chunk(activeKeys, PAGE_SIZE);
  const maxScrollPages = Math.max(0, pages.length - 1);
  const clampedScrollPages = Math.min(Math.max(scrollPages, 0), maxScrollPages);
  const roundedPage = Math.round(clampedScrollPages);

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
    // ScreenHeader's back arrow follows which routes are footer roots.
    window.dispatchEvent(new Event(BOTTOM_NAV_CHANGED_EVENT));
  }, [activeKeys, inactiveKeys, hydrated]);

  useEffect(() => {
    activeKeysRef.current = activeKeys;
  }, [activeKeys]);

  // Mister man familieabonnementet, flyttes "Skift konto" ud af menuen igen
  // (tilbage i puljen, hvor det er skjult). Venter på familiestatus, så
  // ikonet ikke ryger ud, mens siden indlæses.
  useEffect(() => {
    if (!hydrated || canSwitchProfile !== false || !activeKeys.includes(SWITCH_PROFILE_KEY)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- følger serverens familiestatus
    setActiveKeys((prev) => prev.filter((k) => k !== SWITCH_PROFILE_KEY));
    setInactiveKeys((prev) => (prev.includes(SWITCH_PROFILE_KEY) ? prev : [...prev, SWITCH_PROFILE_KEY]));
  }, [hydrated, canSwitchProfile, activeKeys]);

  const visibleInactiveKeys = canSwitchProfile
    ? inactiveKeys
    : inactiveKeys.filter((k) => k !== SWITCH_PROFILE_KEY);

  useEffect(() => {
    scrollPagesRef.current = clampedScrollPages;
  }, [clampedScrollPages]);

  // Fejlretninger/FEJLLISTE.md #9: baggrundssiden kunne stadig scrolles bag
  // redigeringssheetet. `document.body` er ikke selve scroll-beholderen i
  // denne app (HfScreen's indre content-div er), så en almindelig
  // `body.style.overflow = "hidden"` rammer intet reelt — i stedet stoppes
  // ethvert touchmove uden for selve panelet, mens sheetet er åbent.
  useEffect(() => {
    if (!editMode) return;
    function blockBackgroundScroll(event: TouchEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
    }
    document.addEventListener("touchmove", blockBackgroundScroll, { passive: false });
    return () => {
      document.removeEventListener("touchmove", blockBackgroundScroll);
    };
  }, [editMode]);

  // FLIP: hvert ikon, der skifter plads (omrokering, ud/ind af panelet, et
  // andet ikon fjernes), glider derhen i stedet for at hoppe. Rullede ikoner
  // i rækken måles i rullet indhold, så swipe/auto-rulning ikke tæller som
  // flytning. Et sluppet ikon glider fra fingeren til sin plads.
  const shownScroll = pageSwipe ? scrollPages : clampedScrollPages;
  useLayoutEffect(() => {
    const barWidth = barRef.current?.getBoundingClientRect().width ?? 0;
    const next = new Map<string, IconPlace>();
    itemRefs.current.forEach((el, key) => {
      const r = el.getBoundingClientRect();
      const inBar = barRef.current?.contains(el) ?? false;
      const sx = r.left + r.width / 2;
      next.set(key, { sx, nx: sx + (inBar ? shownScroll * barWidth : 0), y: r.top + r.height / 2, inBar });
    });
    const settle = settleFrom.current;
    if (!drag) settleFrom.current = null;
    itemRefs.current.forEach((el, key) => {
      const now = next.get(key);
      if (!now) return;
      if (settle && !drag && settle.key === key) {
        const rect = el.getBoundingClientRect();
        slideIcon(
          el,
          settle.x - (rect.left + rect.width / 2),
          settle.y - (rect.top + rect.height / 2),
          true,
        );
        return;
      }
      if (dragRef.current?.moved && dragRef.current.key === key) return;
      const prev = prevPlaces.current.get(key);
      if (!prev) return;
      // I samme område er forskellen uden rulning; på tværs er det skærmpositioner.
      const dx = prev.inBar === now.inBar ? prev.nx - now.nx : prev.sx - now.sx;
      const dy = prev.y - now.y;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      slideIcon(el, dx, dy, false);
    });
    prevPlaces.current = next;
  }, [activeKeys, inactiveKeys, drag, shownScroll]);

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

  const finishDrag = useCallback((clientX: number, clientY: number) => {
    clearReadyTimer();
    const current = dragRef.current;
    dragRef.current = null;
    if (current?.moved) settleFrom.current = { key: current.key, x: clientX, y: clientY };
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
        const target = slotIndexAt(barRef.current, clientX, scrollPagesRef.current);
        setInactiveKeys((prev) => prev.filter((k) => k !== current.key));
        setActiveKeys((prev) => {
          if (prev.includes(current.key)) return prev;
          const copy = [...prev];
          copy.splice(Math.min(target ?? copy.length, copy.length), 0, current.key);
          return copy;
        });
      }
    }
  }, [clearReadyTimer]);

  // Aktivt ikon over baren: de andre glider til side, så pladsen under
  // fingeren er fri (kun mens fingeren er over selve baren).
  const reorderUnderFinger = useCallback(
    (key: string, source: "active" | "inactive", x: number, y: number) => {
      if (source !== "active" || !overRect(barRef.current, x, y)) return;
      const target = slotIndexAt(barRef.current, x, scrollPagesRef.current);
      if (target === null) return;
      setActiveKeys((prev) => {
        const from = prev.indexOf(key);
        const to = Math.min(target, prev.length - 1);
        if (from === -1 || from === to) return prev;
        const copy = [...prev];
        copy.splice(from, 1);
        copy.splice(to, 0, key);
        return copy;
      });
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
      const justStartedMoving = !current.moved && Math.hypot(dx, dy) > MOVE_CANCEL_PX;
      const moved = current.moved || justStartedMoving;
      if (justStartedMoving) clearReadyTimer();
      const overTarget = moved
        ? current.source === "active"
          ? overRect(panelRef.current, e.clientX, e.clientY)
          : overRect(barRef.current, e.clientX, e.clientY)
        : false;
      const next = { ...current, x: e.clientX, y: e.clientY, moved, overTarget };

      // Ikon trukket ind over bunden: sæt det ind mellem to ikoner med det
      // samme, så de andre rykker og gør plads. Derefter opfører det sig som
      // et ikon, der allerede er i menuen (kan flyttes, eller trækkes tilbage).
      if (moved && current.source === "inactive" && overTarget) {
        const at = gapIndexAt(barRef.current, e.clientX, scrollPagesRef.current);
        next.source = "active";
        setInactiveKeys((prev) => prev.filter((k) => k !== current.key));
        setActiveKeys((prev) => {
          if (prev.includes(current.key)) return prev;
          const copy = [...prev];
          copy.splice(Math.min(at ?? copy.length, copy.length), 0, current.key);
          return copy;
        });
      }
      dragRef.current = next;
      setDrag(next);

      if (moved) reorderUnderFinger(current.key, current.source, e.clientX, e.clientY);
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
  }, [drag, finishDrag, clearReadyTimer, reorderUnderFinger]);

  // Mens et ikon holdes ved rækkens kant, ruller rækken kontinuerligt (som at
  // trække noget mod kanten af en scroller) — hurtigere jo tættere på kanten.
  const isDraggingMoved = Boolean(drag?.moved);
  useEffect(() => {
    if (!isDraggingMoved) return;
    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const current = dragRef.current;
      const bar = barRef.current;
      if (current?.moved && bar) {
        const r = bar.getBoundingClientRect();
        const inBarBand = current.y >= r.top - 24 && current.y <= r.bottom + 24;
        const maxPages = Math.max(0, Math.ceil(activeKeysRef.current.length / PAGE_SIZE) - 1);
        let speed = 0;
        if (inBarBand) {
          const intoLeft = (r.left + EDGE_ZONE_PX - current.x) / EDGE_ZONE_PX;
          const intoRight = (current.x - (r.right - EDGE_ZONE_PX)) / EDGE_ZONE_PX;
          if (intoLeft > 0) speed = -Math.min(1, intoLeft);
          else if (intoRight > 0) speed = Math.min(1, intoRight);
        }
        if (speed !== 0) {
          const nextScroll = Math.min(
            maxPages,
            Math.max(0, scrollPagesRef.current + speed * AUTO_SCROLL_MAX_PAGES_PER_S * dt),
          );
          if (nextScroll !== scrollPagesRef.current) {
            scrollPagesRef.current = nextScroll;
            setScrollPages(nextScroll);
            reorderUnderFinger(current.key, current.source, current.x, current.y);
          }
        }
      }
      autoScrollRaf.current = requestAnimationFrame(frame);
    }
    autoScrollRaf.current = requestAnimationFrame(frame);
    return () => {
      if (autoScrollRaf.current !== null) cancelAnimationFrame(autoScrollRaf.current);
      autoScrollRaf.current = null;
    };
  }, [isDraggingMoved, reorderUnderFinger]);

  function beginPageSwipe(pointerId: number, startX: number) {
    const state: PageSwipeState = { pointerId, startX, startScrollPages: scrollPagesRef.current };
    pageSwipeRef.current = state;
    setPageSwipe(state);
  }

  // Kontinuerlig, uden snap: følger fingeren 1:1 (i "sider" pr. bar-bredde)
  // og bliver stående nøjagtigt der, hvor den blev sluppet — aldrig et hop
  // til nærmeste hele side. Se PageSwipeState-kommentaren for baggrunden.
  useEffect(() => {
    if (!pageSwipe) return;

    function onMove(e: PointerEvent) {
      const current = pageSwipeRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      const totalPages = Math.max(1, Math.ceil(activeKeysRef.current.length / PAGE_SIZE));
      const maxPages = totalPages - 1;
      const rect = barRef.current?.getBoundingClientRect();
      const width = rect?.width || 1;
      const deltaPages = (current.startX - e.clientX) / width;
      let next = current.startScrollPages + deltaPages;
      if (next < 0) next *= 0.3;
      else if (next > maxPages) next = maxPages + (next - maxPages) * 0.3;
      setScrollPages(next);
    }

    function onUp(e: PointerEvent) {
      const current = pageSwipeRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      pageSwipeRef.current = null;
      setPageSwipe(null);
      // Ingen snap til nærmeste side — bare clamp evt. rubber-band-overtræk
      // tilbage inden for de gyldige grænser og bliv stående.
      setScrollPages((p) => {
        const totalPages = Math.max(1, Math.ceil(activeKeysRef.current.length / PAGE_SIZE));
        return Math.min(Math.max(p, 0), totalPages - 1);
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
  }, [pageSwipe]);

  function beginDrag(
    key: string,
    source: "active" | "inactive",
    e: React.PointerEvent,
    lifted = false,
  ) {
    clearReadyTimer();
    const state: DragState = {
      key,
      source,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      ready: lifted,
      overTarget: false,
    };
    dragRef.current = state;
    setDrag(state);
    if (lifted) return;
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
      // Stille tryk løfter ikonet; bevæger fingeren sig først, ruller rækken.
      clearPendingLift();
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const press = { key, startX, startY, pointerId, timer: null as ReturnType<typeof setTimeout> | null };
      press.timer = setTimeout(() => {
        if (pendingLift.current !== press) return;
        pendingLift.current = null;
        navigator.vibrate?.(8);
        beginDrag(key, "active", { pointerId, clientX: startX, clientY: startY } as React.PointerEvent, true);
      }, EDIT_LIFT_DELAY_MS);
      pendingLift.current = press;
      return;
    }
    pressStart.current = { x: e.clientX, y: e.clientY };
    clearLongPress();
    longPressTimer.current = setTimeout(() => {
      // Gratis: langt tryk åbner ikke redigering; slip navigerer som et tryk.
      if (!isSerious) return;
      setEditMode(true);
      beginDrag(key, "active", e.nativeEvent as unknown as React.PointerEvent);
    }, LONG_PRESS_MS);
  }

  function clearPendingLift() {
    if (pendingLift.current?.timer) clearTimeout(pendingLift.current.timer);
    pendingLift.current = null;
  }

  function handleActivePointerMove(e: React.PointerEvent) {
    const lift = pendingLift.current;
    if (editMode && lift) {
      const dx = e.clientX - lift.startX;
      const dy = e.clientY - lift.startY;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearPendingLift();
        if (Math.abs(dx) > Math.abs(dy) && pages.length > 1) beginPageSwipe(e.pointerId, lift.startX);
      }
      return;
    }
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

  function handleActivePointerUp(item: NavItem) {
    clearPendingLift();
    const hadTimer = longPressTimer.current !== null;
    clearLongPress();
    if (editMode) return;
    if (hadTimer && pressStart.current) {
      pressStart.current = null;
      if (item.action === "switchProfile") setSwitchSheetOpen(true);
      else if (item.href) router.push(item.href);
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
    setScrollPages(0);
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

  return (
    <div className="hf-bottom-nav relative select-none [-webkit-touch-callout:none]">
      {/* Bundcirklen vises på alle sider (bruger 2026-10-09); popups (z-200) ligger over. */}
      <FooterArc />
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
          className={`hf-nav-panel-in absolute bottom-full left-0 right-0 z-50 rounded-t-2xl border border-b-0 px-4 pb-4 pt-2 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] ${
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
              className="hf-type-small hf-type-strong text-hf-action font-hf-body"
            >
              Træk et ikon ned i menuen
            </span>
            <button
              type="button"
              onClick={closePanel}
              className="hf-type-small hf-type-strong text-hf-brand font-hf-body"
            >
              Færdig
            </button>
          </div>
          <div className="flex flex-wrap gap-3">
            {visibleInactiveKeys.map((key) => {
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
                  className={`flex h-[64px] min-w-16 flex-none flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 touch-none select-none ${
                    isPlaceholder
                      ? "border-dashed border-hf-gray-dark bg-transparent"
                      : isReady
                        ? "border-dashed border-hf-gray-dark bg-hf-tan-dark"
                        : "border-hf-tan-dark bg-hf-tan-dark"
                  }`}
                  aria-label={t("nav.addItemAriaLabel", { item: t(`nav.${item.labelKey}`) })}
                >
                  <span className={`flex flex-col items-center gap-1 ${isPlaceholder ? "invisible" : ""}`}>
                    {item.render("var(--hf-black)", PANEL_ICON_SIZE)}
                    <span
                      className="hf-type-micro whitespace-nowrap text-center text-hf-action font-hf-body"
                    >
                      {t(`nav.${item.labelKey}`)}
                    </span>
                  </span>
                </button>
              );
            })}
            {visibleInactiveKeys.length === 0 && (
              <span
                className="hf-type-small text-hf-text-secondary font-hf-body"
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
              className="hf-btn-icon text-hf-black"
            >
              <IconRefresh size={20} />
            </button>
          </div>
        </div>
      )}

      <nav
        ref={barRef}
        data-bottom-navigation
        className={`relative bg-hf-tan-dark ${
          // Over lukke-laget (z-40) i redigering, ellers rammer et tryk på
          // slet-krydset laget og afslutter hele redigeringen.
          editMode ? "z-50" : ""
        } ${
          showCollapsedBar ? "py-1" : "pb-[env(safe-area-inset-bottom,0px)] pt-2"
        } ${draggedOverPanel ? "border border-dashed border-hf-gray-dark" : ""}`}
        aria-label={t("nav.mainNavigationAriaLabel")}
      >
        {showCollapsedBar ? (
          <button
            type="button"
            onClick={() => setLandscapeExpanded(true)}
            aria-label={t("nav.expandAriaLabel")}
            className="mx-auto flex w-1/4 items-center justify-center py-0.5"
          >
            <span className="h-1.5 w-10 rounded-full bg-hf-black/30" />
          </button>
        ) : (
          <>
            {isCompactLandscape && (
              <button
                type="button"
                onClick={() => setLandscapeExpanded(false)}
                aria-label={t("nav.collapseAriaLabel")}
                className="absolute inset-x-0 top-0 flex justify-center py-1"
              >
                <span className="h-1.5 w-10 rounded-full bg-hf-black/30" />
              </button>
            )}
        {/* overflow-x-clip (ikke -hidden): -hidden tvinger også lodret
            klipning, så slette-krydserne over ikonerne blev skåret af. */}
        <div className="overflow-x-clip overflow-y-visible pt-1">
          <div
            className="flex"
            style={{
              transform: `translateX(${-shownScroll * 100}%)`,
              transition: pageSwipe || drag?.moved ? "none" : `transform ${PAGE_ANIM_MS}ms ease`,
            }}
          >
            {pages.map((pageKeys, pageIndex) => (
              <div
                key={pageIndex}
                className="grid w-full flex-none grid-cols-4 items-start justify-items-center"
                aria-hidden={pageIndex !== roundedPage}
              >
                {Array.from({ length: PAGE_SIZE }, (_, slotIndex) => {
                  const key = pageKeys[slotIndex];
                  if (!key) {
                    return (
                      <div
                        key={`empty-${pageIndex}-${slotIndex}`}
                        className="h-14 w-16 touch-none select-none"
                        onPointerDown={handleEmptySlotPointerDown}
                      />
                    );
                  }
                  const item = ITEMS_BY_KEY.get(key);
                  if (!item) return <div key={key} className="h-12 w-16" />;
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
                      data-guide={`nav-${key}`}
                      aria-current={active ? "page" : undefined}
                      onPointerDown={(e) => handleActivePointerDown(key, e)}
                      onPointerMove={handleActivePointerMove}
                      onPointerUp={() => handleActivePointerUp(item)}
                      onPointerCancel={clearPendingLift}
                      className={`relative flex h-14 w-16 flex-none flex-col items-center justify-center gap-1 rounded-xl py-1.5 touch-none select-none ${
                        editMode ? "border" : "border-transparent"
                      } ${
                        isReady || isPlaceholder
                          ? "border-dashed border-hf-gray-dark"
                          : editMode
                            ? "border-hf-tan-dark"
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
                          className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-hf-black"
                        >
                          <IconX size={13} stroke={2.2} color="var(--hf-tan)" />
                        </span>
                      )}
                      <span className={`flex flex-col items-center gap-2 ${isPlaceholder ? "invisible" : ""}`}>
                        {item.render(color, ICON_SIZE)}
                        <span className="hf-type-tab whitespace-nowrap" style={{ color }}>
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
          </>
        )}
      </nav>

      {drag?.moved && (
        <div
          className="hf-nav-ghost pointer-events-none fixed z-50 flex h-14 w-16 flex-col items-center justify-center gap-1 rounded-xl bg-hf-tan-dark opacity-95 shadow-[0_10px_18px_rgba(0,0,0,0.18)]"
          style={{ left: drag.x - 32, top: drag.y - 28 }}
        >
          {ITEMS_BY_KEY.get(drag.key)?.render("var(--hf-black)", ICON_SIZE)}
        </div>
      )}

      {switchSheetOpen && (
        <BottomSheet title={t("nav.switchProfile")} onClose={() => setSwitchSheetOpen(false)}>
          <ProfileSwitchList onDone={() => setSwitchSheetOpen(false)} />
        </BottomSheet>
      )}
    </div>
  );
}
