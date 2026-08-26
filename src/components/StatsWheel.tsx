"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  IconBolt,
  IconDroplet,
  IconEgg,
  IconFlame,
  IconWalk,
  type Icon,
} from "@tabler/icons-react";

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

export function StatsWheel() {
  const [activeIndex, setActiveIndex] = useState(0);
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
        goal: "3.299",
        unit: "kcal",
      },
      {
        key: "protein",
        label: "Protein",
        icon: IconEgg,
        value: loading ? "—" : formatNumber(totals.protein),
        goal: "120",
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

  const previousIndex = (activeIndex - 1 + stats.length) % stats.length;
  const nextIndex = (activeIndex + 1) % stats.length;

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
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        if (pointerStartY.current !== null && Math.abs(event.clientY - pointerStartY.current) > 28) {
          move(event.clientY < pointerStartY.current ? 1 : -1);
        }
        pointerStartY.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        pointerStartY.current = null;
      }}
      className="absolute right-[22px] flex w-[178px] touch-pan-x flex-col items-end justify-center overflow-hidden rounded-3xl px-2 py-3 text-right focus-visible:outline-2 focus-visible:outline-hf-green focus-visible:outline-offset-2"
      style={{ top: "50%", height: 190, transform: "translateY(-50%)" }}
    >
      <WheelItem stat={stats[previousIndex]} position="previous" onClick={() => move(-1)} />
      <WheelItem stat={stats[activeIndex]} position="active" />
      <WheelItem stat={stats[nextIndex]} position="next" onClick={() => move(1)} />

      <div className="mt-2 flex w-full justify-end gap-1.5 pr-1" aria-hidden="true">
        {stats.map((stat, index) => (
          <span
            key={stat.key}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              index === activeIndex ? "w-4 bg-hf-green" : "w-1.5 bg-hf-tan-dark"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function WheelItem({
  stat,
  position,
  onClick,
}: {
  stat: Stat;
  position: "previous" | "active" | "next";
  onClick?: () => void;
}) {
  const StatIcon = stat.icon;

  if (position === "active") {
    return (
      <div className="my-1 w-full py-1" aria-live="polite">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-hf-green">
          {stat.label}
        </p>
        <div className="flex items-baseline justify-end gap-2">
          <StatIcon size={21} color="var(--hf-green)" stroke={2.2} aria-hidden="true" />
          <span className="text-[27px] font-extrabold leading-none text-hf-black">{stat.value}</span>
        </div>
        <p className="mt-1 text-[12px] text-hf-black opacity-65">
          / {stat.goal} {stat.unit}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Vis ${stat.label.toLowerCase()}: ${stat.value} ${stat.unit}`}
      className={`flex min-h-10 w-full items-center justify-end gap-1.5 text-hf-black opacity-55 transition-all hover:opacity-80 focus-visible:rounded-lg focus-visible:outline-2 focus-visible:outline-hf-black ${
        position === "previous" ? "origin-right rotate-[3deg]" : "origin-right -rotate-[3deg]"
      }`}
    >
      <StatIcon size={15} aria-hidden="true" />
      <span className="text-xs font-semibold">{stat.label}</span>
      <span className="text-sm">{stat.value}</span>
    </button>
  );
}
