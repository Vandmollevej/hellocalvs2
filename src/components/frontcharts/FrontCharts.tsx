"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { activitySummaryUrl } from "@/lib/daily-budget";
import { FLOOR_KCAL_FEMALE } from "@/lib/energy-budget";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import {
  awakeHours, cumulative, daysPerBar, groupDays, isoDay, recommendedRange,
  recommendedShares, scheduleForDate, stickBuckets, sumBuckets,
  type DayKcal,
} from "@/lib/front-charts";
import { WHEEL_SPAN } from "@/components/StatsWheel";
import { GoalTimeline, KcalSticks, PlanVsActual, PulseSticks } from "./FrontChartSvgs";

// Forsidens grafer (bruger 2026-10-14) i infoboksens plads ved siden af
// tal-hjulet (bruger 2026-10-16): puls, kalorier, anbefalet mod faktisk indtag
// og målsætningens tidslinje uden baggrund i hele boksens plads. Ingen tekst
// under graferne. Resten af forsiden er uændret.

const BUCKET_MIN = 15;
const GOAL_BAR_PX = 4;
/** Samme vandrette udstrækning som den gamle hvide infoboks: fra kanten til midten. */
const EDGE = 13;
const CENTER_GAP = 12;
/** Graferne fylder den hvide boks' højde, fra dens top til dens bund (bruger 2026-10-16). */
const BOX_H = WHEEL_SPAN.half * 2;

type Metric = { type: string; value: number; recordedAt: string };
type Registration = { createdAt: string; kcalSnapshot: number };
type Schedule = { weekday: number; bedtime: string; wakeTime: string };
type GoalRow = { createdAt: string; targetDate: string | null; targets: { type: string; value: number }[] };

function getJson<T>(url: string): Promise<T | null> {
  return fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null);
}

export function FrontCharts({ side }: { side: "left" | "right" }) {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [budgetKcal, setBudgetKcal] = useState<number>(DAILY_KCAL_GOAL);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    getJson<{ metrics: Metric[] }>("/api/health-metrics").then((d) => live && d && setMetrics(d.metrics));
    getJson<{ registrations: Registration[] }>("/api/registrations").then((d) => live && d && setRegistrations(d.registrations));
    getJson<{ schedules: Schedule[] }>("/api/sleep-schedule").then((d) => live && d && setSchedules(d.schedules));
    getJson<{ goals: GoalRow[] }>("/api/goals").then((d) => live && d && setGoals(d.goals));
    getJson<{ summary: { budget: { budgetKcal: number } | null } }>(activitySummaryUrl()).then(
      (d) => live && d?.summary.budget && setBudgetKcal(d.summary.budget.budgetKcal),
    );
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      live = false;
      window.clearInterval(tick);
    };
  }, []);

  const model = useMemo(() => {
    const today = isoDay(now);
    const sched = scheduleForDate(schedules, now);
    const { start, end } = awakeHours(sched?.wakeTime, sched?.bedtime);
    const pulse = metrics
      .filter((m) => m.type === "HEART_RATE_BPM" && isoDay(new Date(m.recordedAt)) === today)
      .map((m) => ({ value: m.value, at: new Date(m.recordedAt) }));
    const intake = registrations
      .filter((r) => isoDay(new Date(r.createdAt)) === today)
      .map((r) => ({ at: new Date(r.createdAt), kcal: r.kcalSnapshot }));
    const shares = recommendedShares(start, end, BUCKET_MIN);
    const sums = sumBuckets(intake, start, end, BUCKET_MIN);
    const nowHour = now.getHours() + now.getMinutes() / 60;
    const elapsed = Math.max(0, Math.min(shares.length, Math.ceil(((nowHour - start) * 60) / BUCKET_MIN)));
    return {
      start, end,
      pulse: stickBuckets(pulse, start, end, BUCKET_MIN),
      sums, shares, elapsed,
      planCum: cumulative(shares.map((s) => s * budgetKcal)),
      actualCum: cumulative(sums),
    };
  }, [now, schedules, metrics, registrations, budgetKcal]);

  const goal = useMemo(() => {
    const weightGoal = goals.find((g) => g.targets.some((x) => x.type === "weight") && g.targetDate);
    if (!weightGoal || !weightGoal.targetDate) return null;
    const from = new Date(weightGoal.createdAt);
    from.setHours(12, 0, 0, 0);
    const to = new Date(`${weightGoal.targetDate}T12:00:00`);
    const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
    const perDay = new Map<string, number>();
    for (const r of registrations) {
      const key = isoDay(new Date(r.createdAt));
      perDay.set(key, (perDay.get(key) ?? 0) + r.kcalSnapshot);
    }
    const days: DayKcal[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(from.getTime() + i * 86_400_000);
      const key = isoDay(d);
      days.push({ day: key, kcal: perDay.get(key) ?? null });
    }
    const maxBars = Math.max(1, Math.floor(Math.max(0, width - 34) / GOAL_BAR_PX));
    const per = daysPerBar(totalDays, maxBars);
    const { min, max } = recommendedRange(budgetKcal, FLOOR_KCAL_FEMALE);
    return {
      bars: groupDays(days, per),
      slots: Math.ceil(totalDays / per),
      from, to, min, max,
      weeks: per >= 7,
    };
  }, [goals, registrations, width, budgetKcal]);

    // Graferne er lavere end deres andel af boksen, så der er luft imellem dem (bruger 2026-10-16).
  const chartCount = goal ? 4 : 3;
  const chartH = Math.floor((BOX_H / chartCount) * 0.72);
  const leftLabel = (hour: string) => t("frontCharts.clockLeft", { hour });
  const shortDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

  return (
    <section
      aria-label={t("frontCharts.aria")}
      className="absolute z-10"
      style={{
        [side]: EDGE,
        [side === "left" ? "right" : "left"]: `calc(50% + ${CENTER_GAP}px)`,
        top: `calc(50% + ${WHEEL_SPAN.shift - WHEEL_SPAN.half}px)`,
        height: BOX_H,
      } as React.CSSProperties}
    >
      <div ref={boxRef} className="flex h-full flex-col justify-between">
        {width > 0 && (
          <>
            <PulseSticks
              leftLabel={leftLabel}
              width={width} height={chartH} buckets={model.pulse} startHour={model.start} endHour={model.end}
              title={t("frontCharts.pulse")}
            />
            <KcalSticks
              leftLabel={leftLabel}
              width={width} height={chartH} sums={model.sums} shares={model.shares} budgetKcal={budgetKcal}
              startHour={model.start} endHour={model.end} title={t("frontCharts.intake")}
            />
            <PlanVsActual
              leftLabel={leftLabel}
              width={width} height={chartH} planCumulative={model.planCum} actualCumulative={model.actualCum} elapsed={model.elapsed}
              startHour={model.start} endHour={model.end} title={t("frontCharts.planVsActual")}
            />
            {goal && (
              <GoalTimeline
                width={width} height={chartH} bars={goal.bars} slots={goal.slots} goalKcal={budgetKcal} recMin={goal.min} recMax={goal.max}
                startLabel={shortDate(goal.from)} endLabel={shortDate(goal.to)}
                title={t(goal.weeks ? "frontCharts.goalWeeks" : "frontCharts.goalDays")}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
