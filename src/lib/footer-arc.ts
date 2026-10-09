// Geometri og lager for forsidens lille halvcirkel over bundmenuen
// (FooterArc.tsx). Brugerens ønske 2026-10-07: en fast, lille halvcirkel
// (ca. 40 px høj, vist statisk) midt over footeren med et stort plus; skubbes
// den op, vokser den til samme størrelse som venstre-cirklen (AddButton.tsx,
// HALF_CIRCLE_RADIUS = 83) og viser 5 knapper, hvor "alle" altid står i midten.

import { useSyncExternalStore } from "react";

export const SOURCE_HALF_CIRCLE_RADIUS = 83;
/** Radius når cirklen er trukket op: samme som venstre-cirklen. */
export const ARC_RADIUS = SOURCE_HALF_CIRCLE_RADIUS;
/** Synlig højde i hvile (cirklens øverste stykke). */
export const ARC_REST_HEIGHT = 40;
export const ARC_ICON_CIRCLE = 46;
// Samme geometri som venstre-cirklen (AddButton.tsx): knapperne ligger
// 78 px uden for cirklen (god plads til fingeren), ikke-valgte 8 px tættere på, den valgte 14 px længere
// ude end grundafstanden, og vinklerne fordeles jævnt over -75..75 grader.
const ARC_GAP = 78;
const ARC_BASE_RADIUS = ARC_RADIUS + ARC_GAP + ARC_ICON_CIRCLE / 2;
/** Afstand fra cirklens midte (ved footerkanten) til de ikke-valgte knappers midte. */
export const ARC_ICON_RADIUS = ARC_BASE_RADIUS - 8;
/** Afstand til den fremhævede knaps midte (træder længere ud). */
export const ARC_ICON_RADIUS_ACTIVE = ARC_BASE_RADIUS + 14;
const ARC_MAX_ANGLE_DEG = 75;
/** Højst så mange egne knapper i viften ("alle" kommer i midten ovenpå). */
export const ARC_MAX_USER_ACTIONS = 4;
/** Mindste afstand fra en knaps midte til skærmkanten. */
const ARC_EDGE_MARGIN = ARC_ICON_CIRCLE / 2 + 8;

/** Vinkler (fra lodret) for knapperne, når der er `userCount` egne + "alle": jævnt fordelt over -75..75 som venstre-cirklen. */
export function fanAngles(userCount: number): number[] {
  const total = userCount + 1;
  if (total <= 1) return [0];
  const step = (ARC_MAX_ANGLE_DEG * 2) / (total - 1);
  return Array.from({ length: total }, (_, i) => -ARC_MAX_ANGLE_DEG + i * step);
}

/** Vinklen (fra lodret) hvor en knap højst kan stå, så den ikke rammer bundmenuen. */
const FAN_MAX_DEG = ARC_MAX_ANGLE_DEG;
/** Mindste vinkel mellem to nabo-knapper, når viften presses sammen. */
const FAN_MIN_STEP_DEG = 18;

/**
 * Knappernes midter (x fra venstre, y opad fra footerkanten). Står cirklen langt
 * ude til siden, er der ikke plads til hele viften på den side. Knapperne lægges
 * i stedet ikke ovenpå hinanden i en søjle, men viften drejes mod den frie side
 * (og presses om nødvendigt lidt sammen), så hele viften stadig ligger inden for
 * skærmen. Den fremhævede knap (`highlightedIndex`) træder længere ud.
 */
export function fanLayout(angles: number[], centerX: number, width: number, highlightedIndex = -1): { x: number; y: number }[] {
  if (angles.length === 0) return [];
  const toDeg = 180 / Math.PI;
  const edge = (room: number) => Math.min(FAN_MAX_DEG, Math.asin(Math.min(1, Math.max(0, room / ARC_ICON_RADIUS_ACTIVE))) * toDeg);
  const lowest = -edge(centerX - ARC_EDGE_MARGIN);
  const highest = edge(width - ARC_EDGE_MARGIN - centerX);
  const first = angles[0];
  const last = angles[angles.length - 1];
  let placed = angles;
  if (width > ARC_EDGE_MARGIN * 2 && (first < lowest || last > highest)) {
    const gaps = angles.length - 1;
    const step = gaps === 0 ? 0 : Math.max(FAN_MIN_STEP_DEG, Math.min((last - first) / gaps, (highest - lowest) / gaps));
    const start = Math.min(Math.max(first, lowest), highest - step * gaps);
    placed = angles.map((_, i) => start + step * i);
  }
  return placed.map((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    const radius = i === highlightedIndex ? ARC_ICON_RADIUS_ACTIVE : ARC_ICON_RADIUS;
    return { x: centerX + radius * Math.sin(rad), y: radius * Math.cos(rad) };
  });
}

/** Forstørrelsen af den knap, fingeren står på (HIGHLIGHT_SCALE i FooterArc.tsx). */
const LABEL_BUTTON_SCALE = 1.35;
const LABEL_GAP = 12;
const LABEL_HEIGHT = 34;

/** Skønnet bredde på navneboksen ved den valgte knap (fed 15 px + polstring). */
export function labelWidth(text: string) {
  return Math.round(text.length * 9.2 + 24);
}

function boxHitsCircle(left: number, bottom: number, w: number, h: number, cx: number, cy: number, r: number) {
  const nx = Math.min(Math.max(cx, left), left + w);
  const ny = Math.min(Math.max(cy, bottom), bottom + h);
  return Math.hypot(cx - nx, cy - ny) < r;
}

/**
 * Hvor navneboksen står ved den valgte knap (venstre/nederste hjørne i samme
 * koordinater som `fanLayout`). Boksen sættes skråt ud væk fra cirklen — langs
 * strålen fra cirklens midte gennem knappen — så fingeren (der kommer fra
 * cirklen) ikke dækker teksten, og så den ligger uden for naboknapperne. Rammer
 * den en nabo eller skærmkanten, prøves større afstand og lodret placering;
 * den overlapper aldrig en knap.
 */
export function labelPlacement(
  centers: { x: number; y: number }[],
  index: number,
  circleX: number,
  width: number,
  w: number,
  h = LABEL_HEIGHT,
): { left: number; bottom: number } {
  const c = centers[index];
  const len = Math.hypot(c.x - circleX, c.y) || 1;
  const radial = { x: (c.x - circleX) / len, y: c.y / len };
  const own = (ARC_ICON_CIRCLE / 2) * LABEL_BUTTON_SCALE;
  const others = centers.filter((_, i) => i !== index);
  const fits = (left: number, bottom: number) =>
    left >= 6 &&
    left + w <= width - 6 &&
    !boxHitsCircle(left, bottom, w, h, c.x, c.y, own + 4) &&
    others.every((o) => !boxHitsCircle(left, bottom, w, h, o.x, o.y, ARC_ICON_CIRCLE / 2 + 4));
  const fallback = { left: Math.min(Math.max(6, c.x - w / 2), Math.max(6, width - 6 - w)), bottom: c.y + own + LABEL_GAP };
  for (const dir of [radial, { x: 0, y: 1 }]) {
    for (let extra = 0; extra <= 120; extra += 12) {
      const dist = own + LABEL_GAP + extra;
      const px = c.x + dir.x * dist;
      const py = c.y + dir.y * dist;
      const norm = Math.max(Math.abs(dir.x), Math.abs(dir.y)) || 1;
      const left = px + (dir.x / norm) * (w / 2) - w / 2;
      const bottom = py + (dir.y / norm) * (h / 2) - h / 2;
      const clamped = Math.min(Math.max(6, left), Math.max(6, width - 6 - w));
      if (fits(clamped, bottom)) return { left: clamped, bottom };
    }
  }
  return fallback;
}

/** Pladsen i viften, hvor "alle" altid står (midten). */
export function listSlotIndex(userCount: number) {
  return Math.floor((userCount + 1) / 2);
}

/** Hvor langt cirkelkanten højst "poser ud" mod fingeren (som venstre-cirklen). */
export const ARC_BULGE_MAX = 18;
const BULGE_SPREAD_DEG = 50;
const BULGE_SAMPLES = 40;

/**
 * SVG-sti for cirkelstykket med synlig højde `height` (0..ARC_RADIUS), fladt i
 * bunden. SVG'en er ARC_RADIUS + ARC_BULGE_MAX høj (plads til poset); den
 * flade kant ligger nederst. `targetDeg` (fra lodret) + `amount` får kanten til
 * at "pose ud" mod fingeren; enderne ved footerkanten holdes fast.
 */
export function segmentPath(height: number, targetDeg: number | null = null, amount = 0) {
  const r = ARC_RADIUS;
  const h = Math.min(r, Math.max(0.5, height));
  const phi = Math.acos((r - h) / r);
  const lineY = ARC_BULGE_MAX + r;
  const centerY = lineY + (r - h);
  const points: string[] = [];
  for (let i = 0; i <= BULGE_SAMPLES; i += 1) {
    const t = -phi + (2 * phi * i) / BULGE_SAMPLES;
    let radius = r;
    if (targetDeg !== null && amount > 0) {
      const diff = Math.abs((t * 180) / Math.PI - targetDeg);
      const falloff = Math.max(0, Math.cos((diff / BULGE_SPREAD_DEG) * (Math.PI / 2)));
      const pin = Math.max(0, 1 - Math.abs(t) / phi) ** 0.6;
      radius += amount * falloff ** 2 * pin;
    }
    points.push(`${i === 0 ? "M" : "L"}${(r + radius * Math.sin(t)).toFixed(2)},${(centerY - radius * Math.cos(t)).toFixed(2)}`);
  }
  return `${points.join(" ")} L${(r + r * Math.sin(phi)).toFixed(2)},${lineY} L${(r - r * Math.sin(phi)).toFixed(2)},${lineY} Z`;
}

// Vandret placering (px fra skærmens midte) gemmes pr. enhed ligesom
// frontpage-layout.ts; kun et ønske — komponenten klemmer den mod skærmbredden.
const ARC_OFFSET_X_STORAGE_KEY = "hellocal.frontpage.arcOffsetX";

let cachedRaw: string | null | undefined;
let cachedValue = 0;
const listeners = new Set<() => void>();

function getSnapshot() {
  if (typeof window === "undefined") return 0;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(ARC_OFFSET_X_STORAGE_KEY);
  } catch {
    return 0;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  const value = Number(raw);
  cachedValue = raw !== null && Number.isFinite(value) ? value : 0;
  return cachedValue;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function saveArcOffsetX(offsetX: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ARC_OFFSET_X_STORAGE_KEY, String(Math.round(offsetX)));
  } catch {
    // localStorage utilgængeligt — placeringen nulstilles næste gang.
  }
  cachedRaw = undefined;
  listeners.forEach((listener) => listener());
}

/** Gemt vandret forskydning fra midten (0 = midt imellem de to midterste footer-knapper). */
export function useArcOffsetX() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
