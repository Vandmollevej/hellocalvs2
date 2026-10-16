"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import { activitySummaryUrl } from "@/lib/daily-budget";
import { FLOOR_KCAL_FEMALE } from "@/lib/energy-budget";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import {
  aheadOfPlan, awakeHours, cumulative, daysPerBar, groupDays, isoDay, recommendedRange,
  recommendedShares, scheduleForDate, splitSurplus, stickBuckets, sumBuckets, walkOptions,
  type DayKcal,
} from "@/lib/front-charts";
import { GoalTimeline, KcalSticks, PlanVsActual, PulseSticks } from "./FrontChartSvgs";

// Forsidens grafer øverst (bruger 2026-10-14): puls, kalorier, anbefalet mod
// faktisk indtag og målsætningens tidslinje, med en handlingsboks nederst.

const BUCKET_MIN = 15;
const GOAL_BAR_PX = 7;

type Metric = { type: string; value: number; recordedAt: string };
type Registration = { createdAt: string; kcalSnapshot: number };
type Schedule = { weekday: number; bedtime: string; wakeTime: string };
type GoalRow = { createdAt: string; targetDate: string | null; targets: { type: string; value: number }[] };
type WeightRow = { weightKg: number; weighedAt: string };

function getJson<T>(url: string): Promise<T | null> {
  return fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null);
}

export function FrontCharts() {
  const { t } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [budgetKcal, setBudgetKcal] = useState<number>(DAILY_KCAL_GOAL);
  const [hasHelloFresh, setHasHelloFresh] = useState(false);
  const [open, setOpen] = useState(false);
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
    getJson<{ entries: WeightRow[] }>("/api/weight-entries").then((d) => live && d && setWeights(d.entries));
    getJson<{ summary: { budget: { budgetKcal: number } | null } }>(activitySummaryUrl()).then(
      (d) => live && d?.summary.budget && setBudgetKcal(d.summary.budget.budgetKcal),
    );
    getJson<{ user?: { recipeProviders?: string[] } }>("/api/profile").then(
      (d) => live && setHasHelloFresh(Boolean(d?.user?.recipeProviders?.includes("hellofresh"))),
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
    const surplus = aheadOfPlan(sums, budgetKcal, shares, elapsed);
    const eatenNow = intake.reduce((sum, e) => sum + e.kcal, 0);
    const kg = weights.length ? [...weights].sort((a, b) => a.weighedAt.localeCompare(b.weighedAt)).at(-1)!.weightKg : null;
    return {
      start, end,
      pulse: stickBuckets(pulse, start, end, BUCKET_MIN),
      sums, shares, elapsed, surplus, eatenNow,
      planCum: cumulative(shares.map((s) => s * budgetKcal)),
      actualCum: cumulative(sums),
      kg,
    };
  }, [now, schedules, metrics, registrations, weights, budgetKcal]);

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

  const { reduceKcal, burnKcal } = splitSurplus(model.surplus);
  const shortDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  const walks = walkOptions(model.surplus, model.kg);
  const reduceTo = Math.max(0, budgetKcal - Math.max(0, model.eatenNow - budgetKcal));

  return (
    <section ref={boxRef} aria-label={t("frontCharts.aria")} className="relative z-10 flex flex-col gap-3 px-4">
      {width > 0 && (
        <>
          <PulseSticks
            width={width - 32} buckets={model.pulse} startHour={model.start} endHour={model.end}
            title={t("frontCharts.pulse")} emptyText={t("frontCharts.noPulse")}
          />
          <KcalSticks
            width={width - 32} sums={model.sums} shares={model.shares} budgetKcal={budgetKcal}
            startHour={model.start} endHour={model.end} title={t("frontCharts.intake")}
          />
          <PlanVsActual
            width={width - 32} planCumulative={model.planCum} actualCumulative={model.actualCum} elapsed={model.elapsed}
            startHour={model.start} endHour={model.end} title={t("frontCharts.planVsActual")}
          />
          {goal && (
            <GoalTimeline
              width={width - 32} bars={goal.bars} slots={goal.slots} goalKcal={budgetKcal} recMin={goal.min} recMax={goal.max}
              startLabel={shortDate(goal.from)} endLabel={shortDate(goal.to)}
              title={t(goal.weeks ? "frontCharts.goalWeeks" : "frontCharts.goalDays")}
            />
          )}
        </>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-label={t("frontCharts.actionOpen")}
      >
        <span className="hf-type-label block text-hf-text-secondary">{t("frontCharts.actionLead")}</span>
        <span className="hf-type-hero block text-hf-text">{t("frontCharts.burnBig", { kcal: model.surplus })}</span>
        <span className="hf-type-caption block text-hf-text-secondary">
          {t("frontCharts.orSplit", { reduce: reduceKcal, burn: burnKcal })}
        </span>
      </button>

      {open && (
        <BottomSheet size="full" title={t("frontCharts.sheetTitle")} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-6 px-4 pb-8">
            <section>
              <h3 className="hf-type-card-title">{t("frontCharts.walkTitle")}</h3>
              <p className="hf-type-body text-hf-text-secondary">{t("frontCharts.walkIntro", { kcal: model.surplus })}</p>
              <ul className="mt-2 flex flex-col gap-1">
                {walks.map((w) => (
                  <li key={w.key} className="hf-type-body">
                    {t(`frontCharts.walk.${w.key}`, { minutes: w.minutes })}
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="hf-type-card-title">{t("frontCharts.eatTitle")}</h3>
              <p className="hf-type-body text-hf-text-secondary">
                {t("frontCharts.eatIntro", { max: Math.max(0, budgetKcal - reduceKcal), reduce: reduceKcal, limit: reduceTo })}
              </p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {(["veg", "protein", "soup", "fruit"] as const).map((key) => (
                  <li key={key} className="hf-type-body">{t(`frontCharts.food.${key}`)}</li>
                ))}
              </ul>
              {hasHelloFresh && (
                <Link href="/profile/recipes" className="hf-type-body mt-3 block text-hf-green underline">
                  {t("frontCharts.helloFresh")}
                </Link>
              )}
            </section>
          </div>
        </BottomSheet>
      )}
    </section>
  );
}
