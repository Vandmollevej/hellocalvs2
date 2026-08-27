"use client";

import { useEffect, useMemo, useState } from "react";
import { IconChartLine } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import { groupByDay, withinLastDays, type RegistrationTotals } from "@/lib/daily-totals";

const WEEK_COUNT = 6;
const WINDOW_DAYS = 30;

function formatNumber(value: number, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits }).format(value);
}

function weeklyKcalAverages(registrations: RegistrationTotals[]) {
  const days = groupByDay(withinLastDays(registrations, WEEK_COUNT * 7));
  const now = Date.now();

  return Array.from({ length: WEEK_COUNT }, (_, weekIndex) => {
    const weeksAgo = WEEK_COUNT - 1 - weekIndex;
    const windowStart = now - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000;
    const windowEnd = now - weeksAgo * 7 * 24 * 60 * 60 * 1000;

    const daysInWeek = days.filter((day) => {
      const [y, m, d] = day.dateKey.split("-").map(Number);
      const time = new Date(y, m, d).getTime();
      return time >= windowStart && time < windowEnd;
    });

    if (daysInWeek.length === 0) return 0;
    return daysInWeek.reduce((sum, day) => sum + day.kcal, 0) / daysInWeek.length;
  });
}

export default function StatistikPage() {
  const [registrations, setRegistrations] = useState<RegistrationTotals[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/registrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente statistik");
        return (await response.json()) as { registrations: RegistrationTotals[] };
      })
      .then((data) => {
        if (!cancelled) setRegistrations(data.registrations);
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

  const weeklyAverages = useMemo(() => weeklyKcalAverages(registrations), [registrations]);

  const points = useMemo(() => {
    const max = Math.max(...weeklyAverages, 1);
    const min = Math.min(...weeklyAverages.filter((v) => v > 0), 0);
    const range = Math.max(max - min, 1);

    return weeklyAverages.map((value, i) => {
      const x = 10 + i * 50;
      const normalized = value > 0 ? (value - min) / range : 0;
      const y = 75 - normalized * 60;
      return { x, y };
    });
  }, [weeklyAverages]);

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  const metrics = useMemo(() => {
    const recentRegistrations = withinLastDays(registrations, WINDOW_DAYS);
    const days = groupByDay(recentRegistrations);
    const daysLogged = days.length;
    const avgKcal = daysLogged > 0 ? days.reduce((sum, d) => sum + d.kcal, 0) / daysLogged : 0;
    const avgProtein = daysLogged > 0 ? days.reduce((sum, d) => sum + d.protein, 0) / daysLogged : 0;
    const goalsMet = days.filter((d) => d.kcal > 0 && d.kcal <= DAILY_KCAL_GOAL).length;

    return [
      { label: "Gns. kalorier / dag", value: loading ? "—" : `${formatNumber(avgKcal)} kcal` },
      { label: "Gns. protein / dag", value: loading ? "—" : `${formatNumber(avgProtein)} g` },
      { label: `Dage logget (${WINDOW_DAYS} dage)`, value: loading ? "—" : `${daysLogged}` },
      { label: "Mål nået", value: loading ? "—" : `${goalsMet} dage` },
    ];
  }, [registrations, loading]);

  return (
    <HfScreen title="Statistik" icon={<IconChartLine size={20} stroke={2} />}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-tan p-4">
          <p className="mb-3 text-sm font-bold text-hf-black">
            Kalorier — gennemsnit pr. uge (seneste {WEEK_COUNT} uger)
          </p>
          <svg viewBox="0 0 280 90" className="w-full" aria-hidden="true">
            <polyline
              points={polyline}
              fill="none"
              stroke="var(--hf-green)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="var(--hf-green)" />
            ))}
          </svg>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-2xl bg-hf-tan p-4">
              <p className="text-xs text-hf-black opacity-60">{m.label}</p>
              <p className="hf-heading mt-1 text-xl text-hf-black">{m.value}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-hf-black opacity-60">
          Statistikken viser fakta, ikke fremgangs-badges eller streaks.
        </p>
      </div>
    </HfScreen>
  );
}
