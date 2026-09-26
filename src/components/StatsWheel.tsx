"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconHeartbeat, IconMoon, type Icon } from "@tabler/icons-react";
import {
  FRONTPAGE_STAT_DEFS,
  useFrontpageStatKeys,
  type FrontpageMetricTotals,
  type FrontpageNutritionTotals,
} from "@/lib/frontpage-stats";
import { useTranslation } from "@/i18n/LocaleProvider";

type Registration = {
  kcalSnapshot: number;
  proteinSnapshot: number;
  carbsSnapshot?: number;
  fatSnapshot?: number;
  sugarSnapshot?: number | null;
  fiberSnapshot?: number | null;
  saltSnapshot?: number | null;
  potassiumSnapshot?: number | null;
  calciumSnapshot?: number | null;
  ironSnapshot?: number | null;
  saturatedFatSnapshot?: number | null;
  unsaturatedFatSnapshot?: number | null;
  transFatSnapshot?: number | null;
  cholesterolSnapshot?: number | null;
  vitaminASnapshot?: number | null;
  vitaminCSnapshot?: number | null;
  createdAt: string;
};

type HealthMetric = { type: string; value: number; recordedAt: string };

type Stat = {
  key: string;
  label: string;
  icon: Icon;
  value: string;
  unit: string;
};

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function emptyTotals(): FrontpageNutritionTotals {
  return {
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
    fiber: 0,
    salt: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    saturatedFat: 0,
    unsaturatedFat: 0,
    transFat: 0,
    cholesterol: 0,
    vitaminA: 0,
    vitaminC: 0,
  };
}

/** Sum of today's HealthMetric rows of one type — null when none exist at all yet. */
function sumMetricToday(metrics: HealthMetric[], type: string): number | null {
  const matching = metrics.filter((m) => m.type === type && isToday(m.recordedAt));
  if (matching.length === 0) return null;
  return matching.reduce((sum, m) => sum + m.value, 0);
}

// Wheel geometry (user's requests 2026-09-25): every stat on one line with the
// icon to the right of the number, up to 3 rows above and below the center,
// the same empty space between all neighbouring rows, a slight fan tilt, and
// nothing clipped.
const SIDE_ROWS = 3;
const FONT_SIZE = 27;
const ICON_SIZE = 21;
/** Empty space between two neighbouring rows, whatever their size. */
const ROW_GAP = 15;
const SCALE_STEP = 0.12;
const MIN_SCALE = 0.6;
/** Degrees per row away from the center: rows above tilt clockwise (left end up), rows below counter-clockwise. */
const TILT_PER_ROW = 2;
/** How far the centered row is pushed in from the edge; the others curve back out along an arc. */
const MAX_INSET = 25;
/** Pointer travel that moves the wheel one row. */
const DRAG_STEP = 38;
const WHEEL_HEIGHT = 2 * (offsetAt(SIDE_ROWS) + FONT_SIZE);

// Temporary made-up numbers (user 2026-09-25: "opfind et indtil jeg har dem
// alle opsat") so the wheel can show all its rows while the visuals are tuned.
// They only fill the slots the user's own fields (Indstillinger → Visning →
// Forside) leave empty, and drop out by themselves as more fields are enabled.
const PLACEHOLDER_STATS: Stat[] = [
  { key: "placeholder-sleep", label: "Søvn (eksempel)", icon: IconMoon, value: "7,5", unit: "t" },
  { key: "placeholder-pulse", label: "Puls (eksempel)", icon: IconHeartbeat, value: "62", unit: "bpm" },
];

function scaleAt(absDistance: number) {
  return Math.max(MIN_SCALE, 1 - absDistance * SCALE_STEP);
}

// Distance from the wheel's center to a row's center. A row is FONT_SIZE × its
// scale tall, so adding up that height along the way (plus ROW_GAP per row)
// leaves exactly ROW_GAP of empty space between any two neighbouring rows —
// the rows shrink towards the ends without bunching up near the center.
function offsetAt(absDistance: number) {
  const knee = (1 - MIN_SCALE) / SCALE_STEP;
  const shrinking = Math.min(absDistance, knee);
  const flat = Math.max(0, absDistance - knee);
  return (
    ROW_GAP * absDistance +
    FONT_SIZE * (shrinking - (SCALE_STEP / 2) * shrinking * shrinking) +
    FONT_SIZE * MIN_SCALE * flat
  );
}

export function StatsWheel({ side }: { side: "left" | "right" }) {
  const { t } = useTranslation();
  const activeKeys = useFrontpageStatKeys();
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragPixels, setDragPixels] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const pointerStartY = useRef<number | null>(null);
  const wheelLocked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/registrations").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente dagens nøgletal");
        return (await response.json()) as { registrations: Registration[] };
      }),
      fetch("/api/health-metrics").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente dagens måltal");
        return (await response.json()) as { metrics: HealthMetric[] };
      }),
    ])
      .then(([registrationData, metricData]) => {
        if (cancelled) return;
        setRegistrations(registrationData.registrations.filter((item) => isToday(item.createdAt)));
        setMetrics(metricData.metrics);
      })
      .catch(() => {
        if (!cancelled) {
          setRegistrations([]);
          setMetrics([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo<Stat[]>(() => {
    const totals = registrations.reduce((sum, item) => {
      sum.kcal += item.kcalSnapshot;
      sum.protein += item.proteinSnapshot;
      sum.carbs += item.carbsSnapshot ?? 0;
      sum.fat += item.fatSnapshot ?? 0;
      sum.sugar += item.sugarSnapshot ?? 0;
      sum.fiber += item.fiberSnapshot ?? 0;
      sum.salt += item.saltSnapshot ?? 0;
      sum.potassium += item.potassiumSnapshot ?? 0;
      sum.calcium += item.calciumSnapshot ?? 0;
      sum.iron += item.ironSnapshot ?? 0;
      sum.saturatedFat += item.saturatedFatSnapshot ?? 0;
      sum.unsaturatedFat += item.unsaturatedFatSnapshot ?? 0;
      sum.transFat += item.transFatSnapshot ?? 0;
      sum.cholesterol += item.cholesterolSnapshot ?? 0;
      sum.vitaminA += item.vitaminASnapshot ?? 0;
      sum.vitaminC += item.vitaminCSnapshot ?? 0;
      return sum;
    }, emptyTotals());

    const metricTotals: FrontpageMetricTotals = {
      steps: sumMetricToday(metrics, "STEPS"),
      waterMl: sumMetricToday(metrics, "WATER_ML"),
      burnedKcal: sumMetricToday(metrics, "ACTIVE_ENERGY_KCAL"),
      distanceKm: sumMetricToday(metrics, "DISTANCE_KM"),
    };

    const own = activeKeys
      .map((key) => FRONTPAGE_STAT_DEFS.find((def) => def.key === key))
      .filter((def): def is NonNullable<typeof def> => Boolean(def))
      .map((def) => {
        const { value, unit } = def.compute({ totals, metrics: metricTotals });
        return {
          key: def.key,
          label: t(def.labelKey),
          icon: def.icon,
          value: loading ? "—" : value,
          unit,
        };
      });
    const missing = Math.max(0, SIDE_ROWS * 2 + 1 - own.length);
    return [...own, ...PLACEHOLDER_STATS.slice(0, missing)];
  }, [activeKeys, loading, metrics, registrations, t]);

  // Rows fade out half a row past the outermost visible one. With too few
  // stats for all 7 rows, the range shrinks so the item that wraps from the
  // bottom to the top of the wheel is always fully faded out when it jumps.
  const visibleRange = Math.min(SIDE_ROWS, Math.floor((stats.length - 1) / 2)) + 0.5;

  function move(direction: -1 | 1) {
    if (stats.length === 0) return;
    // Deliberately not wrapped to the list length: every rendered row keys on
    // its lap around the wheel (see below), so turning past the end never
    // makes a row jump.
    setActiveIndex((current) => current + direction);
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (Math.abs(event.deltaY) < 8 || wheelLocked.current) return;
    event.preventDefault();
    wheelLocked.current = true;
    move(event.deltaY > 0 ? 1 : -1);
    window.setTimeout(() => {
      wheelLocked.current = false;
    }, 260);
  }

  // Continuous "virtual" index: the exact fractional position of the wheel,
  // combining the committed active index with the in-progress drag offset
  // (in pixels, positive when the pointer has moved up towards the next item).
  const floatIndex = activeIndex + dragPixels / DRAG_STEP;

  return (
    <div
      role="group"
      aria-label="Dagens nøgletal. Swipe eller scroll lodret for at skifte."
      tabIndex={0}
      onWheel={handleWheel}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          move(-1);
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          move(1);
        }
      }}
      onPointerDown={(event) => {
        pointerStartY.current = event.clientY;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (pointerStartY.current === null) return;
        setDragPixels(pointerStartY.current - event.clientY);
      }}
      onPointerUp={(event) => {
        if (pointerStartY.current !== null) {
          const steps = Math.round((pointerStartY.current - event.clientY) / DRAG_STEP);
          if (steps !== 0) move(steps > 0 ? 1 : -1);
        }
        pointerStartY.current = null;
        setDragging(false);
        setDragPixels(0);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        pointerStartY.current = null;
        setDragging(false);
        setDragPixels(0);
      }}
      // No overflow clipping: a long number simply extends further left
      // instead of being cut off in the middle of the screen. The box itself
      // stays narrow on the right so it never covers the add-button's fan.
      className="absolute touch-pan-x rounded-3xl text-right transition-[left,right] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-hf-green focus-visible:outline-offset-2"
      style={
        {
          [side]: 22,
          top: "50%",
          width: side === "right" ? 178 : 200,
          height: WHEEL_HEIGHT,
          transform: "translateY(-50%)",
        } as React.CSSProperties
      }
    >
      {stats.flatMap((stat, index) => {
        // One row per lap of the wheel on which this stat is within a row of
        // the visible range. A row turning out at one end fades to nothing
        // while the stat's next lap fades in at the other end — instead of a
        // single row sweeping across the whole wheel when it wraps around.
        const reach = visibleRange + 1;
        const offset = index - floatIndex;
        const firstLap = Math.ceil((-reach - offset) / stats.length);
        const lastLap = Math.floor((reach - offset) / stats.length);
        const rows = [];
        for (let lap = firstLap; lap <= lastLap; lap++) {
          const distance = offset + lap * stats.length;
          rows.push(
            <WheelItem
              key={`${stat.key}@${lap}`}
              stat={stat}
              distance={distance}
              visibleRange={visibleRange}
              animate={!dragging}
              onClick={() => {
                if (distance === 0) return;
                move(distance > 0 ? 1 : -1);
              }}
            />
          );
        }
        return rows;
      })}
    </div>
  );
}

function WheelItem({
  stat,
  distance,
  visibleRange,
  animate,
  onClick,
}: {
  stat: Stat;
  /** Signed distance from the active/center position, in whole-item units. Can be fractional while dragging. */
  distance: number;
  /** Distance at which an item has faded out completely. */
  visibleRange: number;
  /** Whether the transform/opacity change should animate (disabled while actively dragging so the item follows the pointer 1:1). */
  animate: boolean;
  onClick?: () => void;
}) {
  const StatIcon = stat.icon;
  const absDistance = Math.min(Math.abs(distance), visibleRange);
  const isActive = absDistance < 0.05;
  // Fully faded out (a lap that is just turning in or out): not tappable or focusable.
  const hidden = absDistance >= visibleRange;

  // Progressive size: items shrink the further they sit from the centered,
  // active stat. Everything here (position, tilt, scale, opacity) is driven by
  // ONE CSS transform + opacity, exactly like an iOS picker wheel: the value
  // text and icon keep a fixed font-size/icon-size and shrink together as one
  // rigid unit via `scale()`, instead of also separately resizing the
  // font/icon on every render. Mixing those two mechanisms is what previously
  // made the motion look like it "jumped" in discrete pixel steps — font-size
  // and icon-size changes aren't picked up by the transform/opacity
  // transition below, so they snapped instantly instead of easing.
  const y = offsetAt(absDistance);
  const translateY = distance < 0 ? -y : y;
  const scale = scaleAt(absDistance);
  // A slight fan, like spokes of a wheel whose hub sits beyond the right
  // edge: the center row is level, rows above tilt their left end up and rows
  // below tilt it down, a little more per row. Pivots on the icon (the right
  // end), so the icons stay on the arc.
  const tilt = (distance < 0 ? 1 : -1) * absDistance * TILT_PER_ROW;
  // 1 at the center, 0 one full step away. Drives the icon's green tint so it
  // blends in/out with the motion instead of switching on/off the moment an
  // item becomes active.
  const focus = Math.max(0, 1 - absDistance);
  // One continuous ramp all the way to 0 exactly at the render cutoff, so an
  // item never pops in or out at a leftover opacity at the edge. Neighbours
  // are dimmed an extra 30% so the centered stat stands out; the factor eases
  // in with `focus`, so the fade stays continuous while dragging.
  const opacity = (1 - absDistance / visibleRange) * (0.7 + 0.3 * focus);
  const transition = animate ? "transition-[transform,opacity,color] duration-300 ease-out" : "";
  // The items sit on a circular arc like the rim of a wheel: the centered item
  // is inset MAX_INSET from the right edge and the others curve back out to
  // the edge (0px) at the fade-out distance. Radius solved so both ends hold.
  const edgeY = offsetAt(visibleRange);
  const radius = (edgeY * edgeY + MAX_INSET * MAX_INSET) / (2 * MAX_INSET);
  const inset = Math.sqrt(Math.max(0, radius * radius - y * y)) - (radius - MAX_INSET);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isActive}
      aria-current={isActive || undefined}
      aria-label={
        isActive
          ? undefined
          : `Vis ${stat.label.toLowerCase()}: ${stat.value}${stat.unit ? ` ${stat.unit}` : ""}`
      }
      aria-live={isActive ? "polite" : undefined}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={`absolute right-2 flex origin-right items-center gap-2 whitespace-nowrap text-hf-black ${transition} ${
        hidden ? "pointer-events-none" : isActive ? "cursor-default" : "cursor-pointer"
      }`}
      style={{
        top: "50%",
        transform: `translateY(calc(-50% + ${translateY}px)) translateX(-${inset}px) rotate(${tilt}deg) scale(${scale})`,
        opacity,
      }}
    >
      <span className="font-extrabold leading-none" style={{ fontSize: FONT_SIZE }}>
        {stat.value}
        {stat.unit && <span className="font-semibold"> {stat.unit}</span>}
      </span>
      <span
        className={`flex ${transition}`}
        style={{ color: `color-mix(in srgb, var(--hf-green) ${Math.round(focus * 100)}%, var(--hf-black))` }}
      >
        <StatIcon size={ICON_SIZE} color="currentColor" stroke={2.2} aria-hidden="true" />
      </span>
    </button>
  );
}
