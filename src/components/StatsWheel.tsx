"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  IconBolt,
  IconDroplet,
  IconEgg,
  IconFlame,
  IconWalk,
  type Icon,
} from "@tabler/icons-react";
import { DAILY_KCAL_GOAL, DAILY_PROTEIN_GOAL } from "@/lib/goals";

type Registration = {
  kcalSnapshot: number;
  proteinSnapshot: number;
  createdAt: string;
};

type Stat = {
  key: string;
  label: string;
  icon: Icon;
  value: string;
  goal: string;
  unit: string;
};

/**
 * Plate with a knife and fork beside it. Tabler's icon set has no plate
 * glyph, so this is hand-authored to match the tabler outline style
 * (24x24 viewBox, round line caps/joins, `currentColor` stroke) while
 * reusing tabler's own knife+fork path (from ToolsKitchen2) scaled down
 * and placed beside the plate.
 */
function IconPlateCutlery({
  size = 24,
  color = "currentColor",
  stroke = 2,
  ...rest
}: ComponentProps<Icon>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <circle cx="7.5" cy="12" r="6" />
      <circle cx="7.5" cy="12" r="2.7" />
      <g transform="translate(12.5,6.2) scale(0.48)">
        <path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3" />
      </g>
    </svg>
  );
}

function isToday(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

/** Shortest signed distance from `index` to `from` around a circular list of `length`. */
function circularDistance(index: number, from: number, length: number) {
  let diff = (index - from) % length;
  if (diff > length / 2) diff -= length;
  if (diff < -length / 2) diff += length;
  return diff;
}

const ITEM_HEIGHT = 46;

export function StatsWheel({ side }: { side: "left" | "right" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragPixels, setDragPixels] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const pointerStartY = useRef<number | null>(null);
  const wheelLocked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/registrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente dagens nøgletal");
        return (await response.json()) as { registrations: Registration[] };
      })
      .then((data) => {
        if (!cancelled) setRegistrations(data.registrations.filter((item) => isToday(item.createdAt)));
      })
      .catch(() => {
        if (!cancelled) setRegistrations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo<Stat[]>(() => {
    const totals = registrations.reduce(
      (sum, item) => ({
        kcal: sum.kcal + item.kcalSnapshot,
        protein: sum.protein + item.proteinSnapshot,
      }),
      { kcal: 0, protein: 0 },
    );

    return [
      {
        key: "calories",
        label: "Kalorier",
        icon: IconFlame,
        value: loading ? "—" : formatNumber(totals.kcal),
        goal: formatNumber(DAILY_KCAL_GOAL),
        unit: "kcal",
      },
      {
        key: "protein",
        label: "Protein",
        icon: IconEgg,
        value: loading ? "—" : formatNumber(totals.protein),
        goal: formatNumber(DAILY_PROTEIN_GOAL),
        unit: "g",
      },
      {
        key: "water",
        label: "Vand",
        icon: IconDroplet,
        value: "1,6",
        goal: "2,5",
        unit: "l",
      },
      {
        key: "burned",
        label: "Forbrændt",
        icon: IconBolt,
        value: "642",
        goal: "800",
        unit: "kcal",
      },
      {
        key: "steps",
        label: "Skridt",
        icon: IconWalk,
        value: "6.210",
        goal: "10.000",
        unit: "skridt",
      },
      {
        key: "plating",
        label: "Anretning",
        icon: IconPlateCutlery,
        value: "8,2",
        goal: "10",
        unit: "score",
      },
    ];
  }, [loading, registrations]);

  function move(direction: -1 | 1) {
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
      className="absolute flex w-[178px] touch-pan-x flex-col items-center justify-center overflow-hidden rounded-3xl px-2 py-3 text-left transition-[left,right] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-hf-green focus-visible:outline-offset-2"
      style={
        {
          [side]: 22,
          top: "50%",
          height: 190,
          transform: "translateY(-50%)",
          perspective: 320,
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
  /** Whether transform/opacity/font-size changes should animate (disabled while actively dragging so the item follows the pointer 1:1). */
  animate: boolean;
  onClick?: () => void;
}) {
  const StatIcon = stat.icon;
  const absDistance = Math.min(Math.abs(distance), 2.4);
  const isActive = absDistance < 0.05;

  // Progressive depth/curve: farther items tilt and recede further, instead
  // of a binary previous/next tilt.
  const rotateX = Math.max(-70, Math.min(70, distance * -30));
  const translateZ = -absDistance * 34;
  const translateY = distance * ITEM_HEIGHT;
  const scale = Math.max(0.62, 1 - absDistance * 0.16);
  const opacity = Math.max(0.18, 1 - absDistance * 0.42);

  // Magnifier/fisheye: value text is largest when active and shrinks
  // continuously with distance.
  const valueFontSize = Math.max(13, 27 - absDistance * 7.5);
  const labelOpacity = Math.max(0, 1 - absDistance * 1.6);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isActive}
      aria-current={isActive || undefined}
      aria-label={isActive ? undefined : `Vis ${stat.label.toLowerCase()}: ${stat.value} ${stat.unit}`}
      aria-live={isActive ? "polite" : undefined}
      className={`absolute left-2 right-2 flex origin-center flex-col items-start justify-center ${
        animate ? "transition-[transform,opacity] duration-300 ease-out" : ""
      } ${isActive ? "cursor-default" : "cursor-pointer"}`}
      style={{
        top: "50%",
        transform: `translateY(calc(-50% + ${translateY}px)) translateZ(${translateZ}px) rotateX(${rotateX}deg) scale(${scale})`,
        opacity,
      }}
    >
      {isActive ? (
        <>
          <p
            className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-hf-green"
            style={{ opacity: labelOpacity }}
          >
            {stat.label}
          </p>
          <div className="flex items-baseline justify-start gap-2">
            <StatIcon size={21} color="var(--hf-green)" stroke={2.2} aria-hidden="true" />
            <span
              className="font-extrabold leading-none text-hf-black"
              style={{ fontSize: valueFontSize }}
            >
              {stat.value}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-hf-black opacity-65" style={{ opacity: labelOpacity * 0.65 }}>
            / {stat.goal} {stat.unit}
          </p>
        </>
      ) : (
        <div className="flex min-h-10 w-full items-center justify-start gap-1.5 text-hf-black">
          <StatIcon size={15} aria-hidden="true" />
          <span className="text-xs font-semibold" style={{ opacity: labelOpacity }}>
            {stat.label}
          </span>
          <span className="font-semibold" style={{ fontSize: valueFontSize }}>
            {stat.value}
          </span>
        </div>
      )}
    </button>
  );
}
