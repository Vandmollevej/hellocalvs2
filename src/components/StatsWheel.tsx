"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Icon } from "@tabler/icons-react";
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
  /** Dagens mål, jf. docs/UI.md:63 — vises som en mindre "/ mål" linje under
   * det store centrale tal. Udeladt for nøgletal uden et defineret mål. */
  goal?: number;
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

/** Shortest signed distance from `index` to `from` around a circular list of `length`. */
function circularDistance(index: number, from: number, length: number) {
  let diff = (index - from) % length;
  if (diff > length / 2) diff -= length;
  if (diff < -length / 2) diff += length;
  return diff;
}

const ITEM_HEIGHT = 34;

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

    return activeKeys
      .map((key) => FRONTPAGE_STAT_DEFS.find((def) => def.key === key))
      .filter((def): def is NonNullable<typeof def> => Boolean(def))
      .map((def) => {
        const { value, unit, goal } = def.compute({ totals, metrics: metricTotals });
        return {
          key: def.key,
          label: t(def.labelKey),
          icon: def.icon,
          value: loading ? "—" : value,
          unit,
          goal,
        };
      });
  }, [activeKeys, loading, metrics, registrations, t]);

  function move(direction: -1 | 1) {
    if (stats.length === 0) return;
    setActiveIndex((current) => (current + direction + stats.length) % stats.length);
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
  const floatIndex = activeIndex + dragPixels / ITEM_HEIGHT;

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
          const steps = Math.round((pointerStartY.current - event.clientY) / ITEM_HEIGHT);
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
      className="absolute flex w-[178px] touch-pan-x flex-col items-end justify-center overflow-hidden rounded-3xl px-2 py-3 text-right transition-[left,right] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-hf-green focus-visible:outline-offset-2"
      style={
        {
          [side]: 22,
          top: "50%",
          height: 190,
          transform: "translateY(-50%)",
        } as React.CSSProperties
      }
    >
      {stats.map((stat, index) => {
        const distance = circularDistance(index, floatIndex, stats.length);
        // Only render items close enough to be visible; keeps the DOM small
        // and avoids animating items that are fully faded out anyway.
        if (Math.abs(distance) > 2.4) return null;
        return (
          <WheelItem
            key={stat.key}
            stat={stat}
            distance={distance}
            animate={!dragging}
            onClick={() => {
              if (distance === 0) return;
              move(distance > 0 ? 1 : -1);
            }}
          />
        );
      })}
    </div>
  );
}

function WheelItem({
  stat,
  distance,
  animate,
  onClick,
}: {
  stat: Stat;
  /** Signed distance from the active/center position, in whole-item units. Can be fractional while dragging. */
  distance: number;
  /** Whether the transform/opacity change should animate (disabled while actively dragging so the item follows the pointer 1:1). */
  animate: boolean;
  onClick?: () => void;
}) {
  const StatIcon = stat.icon;
  const absDistance = Math.min(Math.abs(distance), 2.4);
  const isActive = absDistance < 0.05;

  // Progressive size: items shrink the further they sit from the centered,
  // active stat — no 3D tilt/carousel effect, just a flat right-aligned list.
  // Everything here (position, scale, opacity) is driven by ONE CSS
  // transform + opacity, exactly like an iOS picker wheel: the value text and
  // icon keep a fixed font-size/icon-size and shrink together as one rigid
  // unit via `scale()`, instead of also separately resizing the font/icon on
  // every render. Mixing those two mechanisms is what previously made the
  // motion look like it "jumped" in discrete pixel steps — font-size and
  // icon-size changes aren't picked up by the transform/opacity transition
  // below, so they snapped instantly instead of easing.
  const translateY = distance * ITEM_HEIGHT;
  const scale = Math.max(0.62, 1 - absDistance * 0.16);
  // One continuous ramp all the way to 0 exactly at the render cutoff (2.4),
  // so an item never pops in or out at a leftover opacity at the edge.
  // 1 at the center, 0 one full step away. Drives the icon's green tint and the
  // goal line so they blend in/out with the motion instead of switching on/off
  // the moment an item becomes active.
  const focus = Math.max(0, 1 - absDistance);
  // Neighbours are dimmed an extra 30% so the centered stat stands out; the
  // factor eases in with `focus`, so the fade stays continuous while dragging.
  const opacity = (1 - absDistance / 2.4) * (0.7 + 0.3 * focus);
  const transition = animate ? "transition-[transform,opacity,color,max-height] duration-300 ease-out" : "";
  // The items sit on a circular arc like the rim of a wheel: the centered item
  // is inset 25px from the right edge and the others curve back out to the
  // edge (0px) at the fade-out distance. Radius solved so both ends hold.
  const MAX_INSET = 25;
  const EDGE_Y = 2.4 * ITEM_HEIGHT;
  const RADIUS = (EDGE_Y * EDGE_Y + MAX_INSET * MAX_INSET) / (2 * MAX_INSET);
  const y = absDistance * ITEM_HEIGHT;
  const inset = Math.sqrt(RADIUS * RADIUS - y * y) - (RADIUS - MAX_INSET);

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
      className={`absolute left-2 right-2 flex origin-right flex-col items-end whitespace-nowrap text-hf-black ${transition} ${
        isActive ? "cursor-default" : "cursor-pointer"
      }`}
      style={{
        top: "50%",
        transform: `translateY(calc(-50% + ${translateY}px)) translateX(-${inset}px) scale(${scale})`,
        opacity,
      }}
    >
      <span className="flex items-center gap-2">
        <span
          className={`flex ${transition}`}
          style={{ color: `color-mix(in srgb, var(--hf-green) ${Math.round(focus * 100)}%, var(--hf-black))` }}
        >
          <StatIcon size={21} color="currentColor" stroke={2.2} aria-hidden="true" />
        </span>
        <span className="font-extrabold leading-none" style={{ fontSize: 27 }}>
          {stat.value}
          {stat.unit && <span className="font-semibold"> {stat.unit}</span>}
        </span>
      </span>
      {stat.goal != null && (
        <span
          aria-hidden={!isActive || undefined}
          className={`overflow-hidden text-sm font-medium leading-none text-hf-gray-dark ${transition}`}
          style={{ maxHeight: focus * 16, opacity: focus }}
        >
          <span className="block">
            / {stat.goal} {stat.unit}
          </span>
        </span>
      )}
    </button>
  );
}
