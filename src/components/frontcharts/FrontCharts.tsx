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
import { WHEEL_SPAN } from "@/components/StatsWheel";
import { GoalTimeline, KcalSticks, PlanVsActual, PulseSticks } from "./FrontChartSvgs";

// Forsidens grafer (bruger 2026-10-14) i infoboksens plads ved siden af
// tal-hjulet (bruger 2026-10-16): puls, kalorier, anbefalet mod faktisk indtag
// og målsætningens tidslinje uden baggrund i boksens plads, med brugerens tekst
// ("For at kunne holde dig inden for dagens mål …") under graferne. Tryk på
// teksten åbner forslag (gåture, mad, Hello Fresh). Resten af forsiden er uændret.

const BUCKET_MIN = 15;
/** Kaloriegrafen samler pr. time, så den anbefalede kurve kan ses ved siden af måltiderne. */
const KCAL_BUCKET_MIN = 60;
const GOAL_BAR_PX = 4;
const EDGE = 13;
/** Graferne slutter et godt stykke før midten, så de holder sig fri af tal-hjulets tekst (bruger 2026-10-16). */
const CENTER_GAP = 36;
/** Uden et vægtmål med dato viser målgrafen de seneste 30 dage (bruger 2026-10-16: kalorier mod målet skal altid vises). */
const FALLBACK_DAYS = 30;
/** Fra den hvide boks' top til hero-bunden (graferne og teksten under dem). */
const BOX_TOP = WHEEL_SPAN.shift - WHEEL_SPAN.half;

type Metric = { type: string; value: number; recordedAt: string };
type Registration = { createdAt: string; kcalSnapshot: number };
type Schedule = { weekday: number; bedtime: string; wakeTime: string };
type WeightRow = { weightKg: number; weighedAt: string };
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
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [budgetKcal, setBudgetKcal] = useState<number>(DAILY_KCAL_GOAL);
  const [hasHelloFresh, setHasHelloFresh] = useState(false);
  const [open, setOpen] = useState(false);
  const [chartsH, setChartsH] = useState(0);
  const chartsRef = useRef<HTMLDivElement>(null);
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
    const el = chartsRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartsH(el.clientHeight));
    ro.observe(el);
    setChartsH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    getJson<{ metrics: Metric[] }>("/api/health-metrics").then((d) => live && d && setMetrics(d.metrics));
    getJson<{ registrations: Registration[] }>("/api/registrations").then((d) => live && d && setRegistrations(d.registrations));
    getJson<{ schedules: Schedule[] }>("/api/sleep-schedule").then((d) => live && d && setSchedules(d.schedules));
    getJson<{ goals: GoalRow[] }>("/api/goals").then((d) => live && d && setGoals(d.goals));
    getJson<{ entries: WeightRow[] }>("/api/weight-entries").then((d) => live && d && setWeights(d.entries));
    getJson<{ user?: { recipeProviders?: string[] } }>("/api/profile").then(
      (d) => live && setHasHelloFresh(Boolean(d?.user?.recipeProviders?.includes("hellofresh"))),
    );
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
    const surplus = aheadOfPlan(sums, budgetKcal, shares, elapsed);
    const eatenNow = intake.reduce((sum, e) => sum + e.kcal, 0);
    const kg = weights.length ? [...weights].sort((a, b) => a.weighedAt.localeCompare(b.weighedAt)).at(-1)!.weightKg : null;
    return {
      start, end,
      pulse: stickBuckets(pulse, start, end, BUCKET_MIN),
      hourSums: sumBuckets(intake, start, end, KCAL_BUCKET_MIN),
      hourShares: recommendedShares(start, end, KCAL_BUCKET_MIN),
      elapsed, surplus, eatenNow, kg,
      planCum: cumulative(shares.map((s) => s * budgetKcal)),
      actualCum: cumulative(sums),
    };
  }, [now, schedules, metrics, registrations, weights, budgetKcal]);

  const goal = useMemo(() => {
    const weightGoal = goals.find((g) => g.targets.some((x) => x.type === "weight") && g.targetDate);
    const to = weightGoal?.targetDate ? new Date(`${weightGoal.targetDate}T12:00:00`) : new Date();
    to.setHours(12, 0, 0, 0);
    const from = weightGoal ? new Date(weightGoal.createdAt) : new Date(to.getTime() - (FALLBACK_DAYS - 1) * 86_400_000);
    from.setHours(12, 0, 0, 0);
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

  // Graferne er lavere end deres andel af pladsen, så der er luft imellem dem (bruger 2026-10-16).
  const chartH = Math.floor((chartsH / 4) * 0.85);
  const leftLabel = (hour: string) => t("frontCharts.clockLeft", { hour });
  const { reduceKcal, burnKcal } = splitSurplus(model.surplus);
  const walks = walkOptions(model.surplus, model.kg);
  const reduceTo = Math.max(0, budgetKcal - Math.max(0, model.eatenNow - budgetKcal));
  const shortDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;

  return (
    <section
      aria-label={t("frontCharts.aria")}
      className="absolute bottom-0 z-10 flex flex-col gap-2"
      style={{
        [side]: EDGE,
        [side === "left" ? "right" : "left"]: `calc(50% + ${CENTER_GAP}px)`,
        top: `calc(50% + ${BOX_TOP}px)`,
      } as React.CSSProperties}
    >
      <div ref={chartsRef} className="min-h-0 flex-1">
        <div ref={boxRef} className="flex h-full flex-col justify-between">
          {width > 0 && chartH > 24 && (
            <>
              <PulseSticks
                leftLabel={leftLabel}
                width={width} height={chartH} buckets={model.pulse} startHour={model.start} endHour={model.end}
                title={t("frontCharts.pulse")}
              />
              <KcalSticks
                leftLabel={leftLabel}
                width={width} height={chartH} sums={model.hourSums} shares={model.hourShares} budgetKcal={budgetKcal}
                startHour={model.start} endHour={model.end} title={t("frontCharts.intake")}
              />
              <PlanVsActual
                leftLabel={leftLabel}
                width={width} height={chartH} planCumulative={model.planCum} actualCumulative={model.actualCum} elapsed={model.elapsed}
                startHour={model.start} endHour={model.end} title={t("frontCharts.planVsActual")}
              />
              <GoalTimeline
                width={width} height={chartH} bars={goal.bars} slots={goal.slots} goalKcal={budgetKcal} recMin={goal.min} recMax={goal.max}
                startLabel={shortDate(goal.from)} endLabel={shortDate(goal.to)}
                title={t(goal.weeks ? "frontCharts.goalWeeks" : "frontCharts.goalDays")}
              />
            </>
          )}
        </div>
      </div>

      {/* Brugerens tekst under graferne (bruger 2026-10-14): tallet med store tal på sin egen linje, alt venstrestillet. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex-none cursor-pointer border-0 bg-transparent p-0 text-left"
        aria-label={t("frontCharts.actionOpen")}
      >
        <span className="hf-type-micro block text-hf-text-secondary">{t("frontCharts.actionLead")}</span>
        <span className="hf-type-page-title block text-hf-text">{t("frontCharts.burnBig", { kcal: model.surplus })}</span>
        <span className="hf-type-micro block text-hf-text-secondary">
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
