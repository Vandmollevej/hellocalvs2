"use client";

import { SINNERS_ENABLED } from "@/lib/food-classification";
import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import Link from "next/link";
import { WeightEntryDetailsSheet } from "@/components/weight/WeightEntryDetailsSheet";
import { useRouter } from "next/navigation";
import {
  IconCalendar,
  IconCalendarMonth,
  IconCalendarWeek,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconLayoutList,
  IconMoon,
  IconScale,
  IconStarFilled,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AddMenuSheet } from "@/components/add/AddMenuSheet";
import { HfChevron } from "@/components/hf/HfChevron";
import { ProfileAvatarLink } from "@/components/ProfileAvatarLink";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { ActionLink } from "@/components/hf/ActionButton";
import { FoodRow } from "@/components/FoodRow";
import { EnergyChip } from "@/components/calendar/EnergyChip";
import { IconWaterGlass } from "@/components/icons/WaterGlass";
import { formatCl, isWaterRegistration, waterRegistrationMl } from "@/lib/water-display";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import { makeBudgetLookup, type BudgetSnapshot, activitySummaryUrl } from "@/lib/daily-budget";
import { isIntakeTooLow, minimumHealthyKcal } from "@/lib/healthy-intake";
import { groupByDay } from "@/lib/daily-totals";
import {
  ENABLE_WEEKLY_ENERGY_SUMMARY,
  activityKcalByDay,
  computeWeeklyEnergySummary,
  estimateAdaptiveMaintenance,
  estimateBmr,
  estimateWeeklyWeightChange,
  formatEstimatedWeight,
  formatSignedKcal,
  formulaMaintenanceEstimate,
  weightAt,
  deviceDataByDay,
  type EnergyProfile,
  type HealthMetricSample,
  type WeighIn,
  type WeightChangeEstimate,
} from "@/lib/weekly-energy-summary";
import { computeAge } from "@/lib/age";
import { getSportMeta } from "@/lib/sport-icons";
import { useDefaultCalendarView } from "@/lib/calendar-view-pref";
import { readOpenDay, syncOpenDay } from "@/lib/calendar-open-day";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useInWebShell } from "@/components/web/WebShell";
import { fetchSleepQuality, localDateKey } from "@/lib/sleep-quality";
import { IconPartyPopper, PartyPopperImage } from "@/components/icons/PartyPopper";
import { BODY_MEASUREMENT_FIELDS } from "@/lib/body-measurements";
import { COMPOSITION_GOAL_FIELDS } from "@/lib/goal-composition";
import type { GoalDTO, GoalTargetDTO } from "@/lib/user-goals";
import { Skeleton, SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { GoalStatusSummary } from "@/components/calendar/GoalStatusSummary";
import {
  formatMeasurementValue,
  formatWeightKg,
  measurementsForDay,
  type CalendarMeasurement,
  type CalendarWeighIn,
} from "@/lib/calendar-measurements";

const WEEKDAY_KEYS = [
  "calendar.weekdayMon",
  "calendar.weekdayTue",
  "calendar.weekdayWed",
  "calendar.weekdayThu",
  "calendar.weekdayFri",
  "calendar.weekdaySat",
  "calendar.weekdaySun",
] as const;
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("da-DK", { month: "long" }).format(new Date(2026, month, 1)),
);

type CalendarView = "month" | "week" | "list";

type Registration = {
  id: string;
  titleSnapshot: string;
  kcalSnapshot: number;
  proteinSnapshot: number;
  amountGrams: number;
  createdAt: string;
  productId?: string | null;
  product?: { imageUrl: string | null } | null;
  classification?: { isDrink: boolean } | null;
};

type Activity = {
  id: string;
  sportType: string;
  startedAt: string;
  durationMinutes: number;
  caloriesBurned: number;
};

// Vand fra /water/create (egen tabel, ingen kalorier). Vises i dagvisningen som
// glas + cl ved siden af timens kalorier (docs/DECISIONS.md 2026-10-02).
type WaterEntry = {
  id: string;
  amountMl: number;
  loggedAt: string;
};

// Vejninger i kalenderen (brugerkrav 2026-09-30): en vejning vises på den
// dag, den er taget — kun som badevægt-ikon i oversigterne (der er ikke plads
// til mere), og med vægt og klokkeslæt i dagvisningen.
type WeightEntry = WeighIn & { id: string };
type WeighInsByDate = Map<string, WeightEntry[]>;

function weighInsForDate(weighInsByDate: WeighInsByDate, date: Date) {
  return weighInsByDate.get(isoDate(date)) ?? [];
}

function formatKg(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

type SleepDefaults = {
  defaultBedtime: string | null;
  defaultWakeTime: string | null;
};

type SleepScheduleEntry = {
  weekday: number;
  bedtime: string;
  wakeTime: string;
};

type WorkShiftEntry = {
  date: string;
  bedtime: string | null;
  wakeTime: string | null;
};

type SleepWindow = { bedtime: number; wakeTime: number };

// Målsætninger i kalenderen: en målsætning har kun en dato (ingen tid), så i
// dagvisningen ligger den på kl. 12 — samme middagstid som goalDisplayDate.
const GOAL_HOUR = 12;
type GoalsByDate = Map<string, GoalDTO[]>;

function goalsForDate(goalsByDate: GoalsByDate, date: Date) {
  return goalsByDate.get(isoDate(date)) ?? [];
}

function formatGoalValue(value: number) {
  return new Intl.NumberFormat("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
}

function goalTargetNameKey(type: GoalTargetDTO["type"]) {
  if (type === "weight") return "goals.weight";
  return (
    BODY_MEASUREMENT_FIELDS.find(({ field }) => field === type)?.nameKey ??
    COMPOSITION_GOAL_FIELDS.find(({ field }) => field === type)?.nameKey ??
    type
  );
}

// Den target, der vises i cirklen/overlayet: vægten hvis målsætningen har en,
// ellers det første kropsmål.
function primaryGoalTarget(goal: GoalDTO): GoalTargetDTO | null {
  return goal.targets.find((target) => target.type === "weight") ?? goal.targets[0] ?? null;
}

type SleepAdjustType = "bedtime" | "wake";

const VIEW_OPTIONS_BASE = [
  { value: "month" as const, labelKey: "calendar.viewMonth", icon: IconCalendarMonth },
  { value: "week" as const, labelKey: "calendar.viewWeek", icon: IconCalendarWeek },
  { value: "list" as const, labelKey: "calendar.viewList", icon: IconLayoutList },
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mondayOf(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

// ISO-8601 week number (weeks start Monday, week 1 contains the year's first
// Thursday) — used for the "uge N" label in week view and the small week
// numbers beside each row in month view. No date library in this repo carries
// this, so it's hand-rolled like the rest of the date math here.
function getIsoWeek(date: Date): number {
  const cursor = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = (cursor.getUTCDay() + 6) % 7;
  cursor.setUTCDate(cursor.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(cursor.getUTCFullYear(), 0, 4));
  const firstThursdayWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayWeekday + 3);
  return 1 + Math.round((cursor.getTime() - firstThursday.getTime()) / (7 * 86400000));
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function totalKcalForDate(dailyTotals: Map<string, number>, date: Date) {
  return dailyTotals.get(dayKey(date)) ?? 0;
}

// Kaloriemål pr. dato (src/lib/daily-budget.ts, docs/ACTIVITY-PAL.md): nyt
// budget gælder kun fra den dag, det blev sat; ældre dage beholder det gamle
// faste mål. Deles med alle visninger via context, så props ikke skal
// trækkes gennem hver visning.
// `effective` = budget + dagens registrerede motion (Activity.caloriesBurned):
// det er den grænse, alle "inden for målet"-afgørelser i kalenderen bruger
// (DECISIONS 2026-10-02). `base` er budgettet alene og vises som "Mål: X kcal".
type DailyGoalLookup = { base: (date: Date) => number; effective: (date: Date) => number };
const DailyGoalContext = createContext<DailyGoalLookup>({
  base: () => DAILY_KCAL_GOAL,
  effective: () => DAILY_KCAL_GOAL,
});

/** Mål inkl. motion — bruges til nået/ikke nået, "over" og balancer. */
function useDailyGoal() {
  return useContext(DailyGoalContext).effective;
}

/** Mål uden motion — kun til visning af "Mål: X kcal". */
function useBaseDailyGoal() {
  return useContext(DailyGoalContext).base;
}

function dailyGoalMet(dailyTotals: Map<string, number>, date: Date, goalKcal: number) {
  const total = totalKcalForDate(dailyTotals, date);
  return total > 0 && total <= goalKcal;
}

function buildMonthGrid(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let day = offset; day > 0; day -= 1) cells.push(new Date(year, month, 1 - day));
  for (let day = 1; day <= count; day += 1) cells.push(new Date(year, month, day));
  while (cells.length < 42) cells.push(null);
  return cells;
}

function stripTime(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

const HOUR_HEIGHT = 40;
const TIMELINE_HEIGHT = HOUR_HEIGHT * 24;
const HOUR_MARKS = Array.from({ length: 25 }, (_, hour) => hour);
// Dagvisningens tidskolonne: smal, med tallene centreret (lige meget luft på
// begge sider) — "Kl."-overskriften bruger samme bredde, så de flugter.
const DAY_TIME_GUTTER_WIDTH = 32;
const ADD_BAR_HOLD_MS = 500;
const ADD_BAR_MOVE_TOLERANCE = 10;
const MOVE_ENTRY_HOLD_MS = 500;
const MOVE_ENTRY_MOVE_TOLERANCE = 10;
const MIN_HOUR_HEIGHT = HOUR_HEIGHT;
const MAX_HOUR_HEIGHT = HOUR_HEIGHT * 4;
const VISIT_COOKIE = "hc_cal_visit";
const ZOOM_SENSITIVITY = 220; // px to fingers must move for a full 1x scale step
const HOUR_HEIGHT_STORAGE_KEY = "hellocal.kalender.hourHeight";

// Desktop-skallen (WebShell) viser dagen højere: ca. 8 timer ad gangen med en
// linje hver halve time, så indtastninger kan sættes i 30-minutters trin. Natten
// står uden for billedet — kun den første/sidste time vises, og resten scrolles
// til, som på mobilen. Egen nøgle, så zoom på webben ikke ændrer mobilen.
const WEB_HOUR_HEIGHT = 96;
const WEB_HOUR_HEIGHT_STORAGE_KEY = "hellocal.kalender.hourHeight.web";

function loadStoredHourHeight(web = false): number {
  const fallback = web ? WEB_HOUR_HEIGHT : HOUR_HEIGHT;
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(web ? WEB_HOUR_HEIGHT_STORAGE_KEY : HOUR_HEIGHT_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, parsed));
}

function timeToMinutes(time: string | null | undefined) {
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number) {
  const snapped = Math.round(minutes / 15) * 15;
  const wrapped = ((snapped % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// Fejlretninger/FEJLLISTE.md #25: hvis kun ét af de to tidspunkter er sat
// nogen steder i kæden (dags-override → ugedag → generel standard), udregnes
// det andet som 7,5 times søvn derfra i stedet for at falde tilbage til to
// UAFHÆNGIGE faste tidspunkter (som ellers kunne give en søvnperiode på fx
// 3 eller 12 timer, hvis kun ét felt var sat). Kun når INGEN af dem er sat
// noget sted, bruges et fast standardvindue (23:00-06:30, 7,5 timer).
const FALLBACK_SLEEP_MINUTES = 7.5 * 60;

function getSleepWindow(
  date: Date,
  defaults: SleepDefaults | null,
  weekdaySchedules: Record<number, SleepScheduleEntry>,
  workShifts: Record<string, WorkShiftEntry>,
): SleepWindow {
  const weekday = (date.getDay() + 6) % 7;
  const override = workShifts[isoDate(date)];
  const perDay = weekdaySchedules[weekday];
  const bedtime = timeToMinutes(override?.bedtime || perDay?.bedtime || defaults?.defaultBedtime);
  const wakeTime = timeToMinutes(override?.wakeTime || perDay?.wakeTime || defaults?.defaultWakeTime);

  if (bedtime !== null && wakeTime !== null) return { bedtime, wakeTime };
  if (bedtime !== null) return { bedtime, wakeTime: (bedtime + FALLBACK_SLEEP_MINUTES) % 1440 };
  if (wakeTime !== null) return { bedtime: (wakeTime - FALLBACK_SLEEP_MINUTES + 1440) % 1440, wakeTime };
  return { bedtime: 23 * 60, wakeTime: (23 * 60 + FALLBACK_SLEEP_MINUTES) % 1440 };
}

// En sengetid lige efter midnat (00:00-03:59) før stå-op-tiden er stadig en
// NAT-søvn — ikke dagsøvn efter en nattevagt. Den hører til aftenen, så
// sengetids-håndtaget står altid nederst (ved 24:00) på dagens tidslinje, og
// der tegnes ikke ét samlet dagsøvn-felt fra 00:00.
const LATE_BEDTIME_CUTOFF_MINUTES = 4 * 60;

function isDaytimeSleep(window: SleepWindow) {
  return window.bedtime < window.wakeTime && window.bedtime >= LATE_BEDTIME_CUTOFF_MINUTES;
}

/** Where the bedtime handle sits on the 00-24 timeline: after-midnight bedtimes pin to the bottom. */
function bedtimeDisplayMinutes(window: SleepWindow) {
  return window.bedtime < LATE_BEDTIME_CUTOFF_MINUTES && !isDaytimeSleep(window) ? 24 * 60 : window.bedtime;
}

function useIsLandscape() {
  const [isLandscape, setIsLandscape] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(orientation: landscape)");
    const update = () => setIsLandscape(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isLandscape;
}

export default function CalendarPage() {
  const { t } = useTranslation();
  const WEEKDAYS = useMemo(() => WEEKDAY_KEYS.map((key) => t(key)), [t]);
  const VIEW_OPTIONS = useMemo(
    () => VIEW_OPTIONS_BASE.map((option) => ({ ...option, label: t(option.labelKey) })),
    [t],
  );
  const [today] = useState(() => new Date());
  const [visibleDate, setVisibleDate] = useState(() => new Date(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const defaultView = useDefaultCalendarView();
  const [view, setView] = useState<CalendarView>(defaultView === "day" ? "month" : defaultView);
  const appliedDefaultView = useRef(false);
  // Settings → Visning → Kalendervisning determines only the INITIAL view on
  // load (useState above already SSR-safely defaults to "month" before the
  // localStorage-backed preference hydrates) — apply it once when it becomes
  // available, without overriding a view the user has since picked by hand.
  useEffect(() => {
    if (appliedDefaultView.current) return;
    appliedDefaultView.current = true;
    // En dag, brugeren havde åben, da siden sidst blev forladt (?date= i
    // URL'en ved Tilbage, ellers sessionStorage ved tryk på "Kalender"),
    // genåbnes — ellers viste kalenderen måneden igen (src/lib/calendar-open-day.ts).
    const reopenedDay = readOpenDay();
    // "Dag" opens today's full-screen day view (DayDetails) over the month view.
    // ?view=day does the same: desktop-skallen starter dér (src/lib/web-nav.ts).
    const forcedDay = new URLSearchParams(window.location.search).get("view") === "day";
    if (reopenedDay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL/sessionStorage findes først efter hydrering
      setVisibleDate(new Date(reopenedDay));
      setSelectedDate(reopenedDay);
    } else if (defaultView === "day" || forcedDay) {
      setSelectedDate(new Date(today));
    } else {
      setView(defaultView);
    }
  }, [defaultView, today]);
  // Spejl den åbne dag i URL + sessionStorage, så den overlever navigation
  // væk fra siden. Første kørsel (ingen dag åben endnu) springes over, så
  // den ikke sletter det, effekten ovenfor er ved at gendanne.
  const hadOpenDay = useRef(false);
  useEffect(() => {
    if (!selectedDate && !hadOpenDay.current) return;
    hadOpenDay.current = selectedDate !== null;
    syncOpenDay(selectedDate);
  }, [selectedDate]);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "previous">("next");
  const [animationKey, setAnimationKey] = useState(0);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [waterEntries, setWaterEntries] = useState<WaterEntry[]>([]);
  const [sleepDefaults, setSleepDefaults] = useState<SleepDefaults | null>(null);
  const [energyProfile, setEnergyProfile] = useState<EnergyProfile | null>(null);
  // Hele rækken fra /api/weight-entries (id, kilde) — vises også i dagsvisningen.
  const [weighIns, setWeighIns] = useState<(WeighIn & CalendarWeighIn)[]>([]);
  // Enhedsdata (aktiv energi, skridt) pr. dag — docs/ACTIVITY-PAL.md F4.
  const [healthMetrics, setHealthMetrics] = useState<HealthMetricSample[]>([]);
  const [budgetSnapshots, setBudgetSnapshots] = useState<BudgetSnapshot[]>([]);
  const baseGoalForDate = useMemo(() => makeBudgetLookup(budgetSnapshots, DAILY_KCAL_GOAL), [budgetSnapshots]);
  // Registreret motion pr. dag lægges oven i dagens mål (DECISIONS 2026-10-02).
  const activityBonusByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const activity of activities) {
      const key = dayKey(new Date(activity.startedAt));
      map.set(key, (map.get(key) ?? 0) + activity.caloriesBurned);
    }
    return map;
  }, [activities]);
  const goalForDate = useMemo(
    () => (date: Date) => baseGoalForDate(date) + (activityBonusByDay.get(dayKey(date)) ?? 0),
    [baseGoalForDate, activityBonusByDay],
  );
  const dailyGoalLookup = useMemo<DailyGoalLookup>(
    () => ({ base: baseGoalForDate, effective: goalForDate }),
    [baseGoalForDate, goalForDate],
  );
  const [weekdaySchedules, setWeekdaySchedules] = useState<Record<number, SleepScheduleEntry>>({});
  const [workShifts, setWorkShifts] = useState<Record<string, WorkShiftEntry>>({});
  const [goals, setGoals] = useState<GoalDTO[]>([]);
  const pointerStart = useRef<number | null>(null);
  const isLandscape = useIsLandscape();
  const wasLandscapeRef = useRef(false);
  // Fejlretninger/FEJLLISTE.md #32C: brugeren bekræftede eksplicit 2026-09-07
  // at rotation TIL landscape skal skifte til ugevisning automatisk — dette
  // tilsidesætter den tidligere beslutning om aldrig at gøre det. Skiftet
  // sker kun på selve overgangen ind i landscape (ikke ved hver render), og
  // rører ikke visningen igen hvis brugeren derefter selv vælger noget andet.
  useEffect(() => {
    if (isLandscape && !wasLandscapeRef.current) {
      setView((current) => (current === "month" ? "week" : current));
    }
    wasLandscapeRef.current = isLandscape;
  }, [isLandscape]);
  const effectiveView: CalendarView = view;
  const showWeekTimeline = isLandscape && view === "week";

  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const monthCells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const weekDays = useMemo(() => {
    const monday = mondayOf(visibleDate);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [visibleDate]);
  const weekNumber = useMemo(() => getIsoWeek(weekDays[0]), [weekDays]);

  const monthLabel = visibleDate.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  const weekLabel = `${weekDays[0].toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  })} – ${weekDays[6].toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
  const activeView = VIEW_OPTIONS.find((option) => option.value === view) ?? VIEW_OPTIONS[0];

  const dailyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of groupByDay(registrations)) map.set(day.dateKey, day.kcal);
    return map;
  }, [registrations]);

  const minimumKcal = useMemo(
    () =>
      minimumHealthyKcal(
        energyProfile && { ...energyProfile, weightKg: weightAt(weighIns, today, energyProfile.weightKg) },
      ),
    [energyProfile, weighIns, today],
  );
  const hasLowIntakeDay = weekDays.some((date) =>
    isIntakeTooLow(
      totalKcalForDate(dailyTotals, date),
      minimumKcal,
      stripTime(date).getTime() < stripTime(today).getTime(),
    ),
  );

  const deviceData = useMemo(() => deviceDataByDay(healthMetrics), [healthMetrics]);

  const weeklyWeightEstimate = useMemo(() => {
    if (!energyProfile) return null;
    const weekEnd = addDays(weekDays[6], 1);
    // Maintenance is judged as of the earlier of "end of the shown week" and
    // "start of today", so past weeks aren't estimated with later data.
    const asOf = weekEnd.getTime() < stripTime(today).getTime() ? weekEnd : stripTime(today);
    const bmr = estimateBmr({
      ...energyProfile,
      weightKg: weightAt(weighIns, asOf, energyProfile.weightKg),
    });
    const adaptiveMaintenance = estimateAdaptiveMaintenance({
      dailyTotals,
      weighIns,
      endExclusive: asOf,
      formulaMaintenance: formulaMaintenanceEstimate(bmr, activities, energyProfile, deviceData),
    });
    return estimateWeeklyWeightChange({
      days: weekDays,
      today,
      dailyTotals,
      activityByDay: activityKcalByDay(activities),
      bmr,
      adaptiveMaintenance,
      profile: energyProfile,
      device: deviceData,
    });
  }, [energyProfile, weighIns, activities, dailyTotals, weekDays, today, deviceData]);

  const monthlyStatus = useMemo(() => {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const consideredDays = isCurrentMonth ? today.getDate() : daysInMonth;

    let consumed = 0;
    let metCount = 0;
    let goalSum = 0;
    let bonusKcal = 0;
    for (let day = 1; day <= consideredDays; day += 1) {
      const date = new Date(year, month, day);
      const total = totalKcalForDate(dailyTotals, date);
      consumed += total;
      // "Mål" vises uden motion; motionen står som egen linje og tæller med i nået/tilbage.
      goalSum += baseGoalForDate(date);
      bonusKcal += activityBonusByDay.get(dayKey(date)) ?? 0;
      if (total > 0 && total <= goalForDate(date)) metCount += 1;
    }
    const remaining = goalSum + bonusKcal - consumed;

    let sevenDayConsumed = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      sevenDayConsumed += totalKcalForDate(dailyTotals, addDays(today, -offset));
    }
    let sevenDayGoal = 0;
    for (let offset = 0; offset < 7; offset += 1) sevenDayGoal += goalForDate(addDays(today, -offset));
    const sevenDayRemaining = sevenDayGoal - sevenDayConsumed;

    let streak = 0;
    while (dailyGoalMet(dailyTotals, addDays(today, -streak), goalForDate(addDays(today, -streak)))) streak += 1;

    return { isCurrentMonth, consideredDays, metCount, remaining, sevenDayRemaining, streak, goalSum, consumed, bonusKcal };
  }, [dailyTotals, activityBonusByDay, year, month, today, goalForDate, baseGoalForDate]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMonthMenuOpen(false);
        setViewMenuOpen(false);
        setSelectedDate(null);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/registrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Registreringer kunne ikke hentes");
        return (await response.json()) as { registrations: Registration[] };
      })
      .then((data) => {
        if (!cancelled) setRegistrations(data.registrations);
      })
      .catch(() => {
        if (!cancelled) setRegistrationsError(true);
      })
      .finally(() => {
        if (!cancelled) setRegistrationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Regnestykket gemmer dagens budget som snapshot; derefter hentes alle.
    fetch(activitySummaryUrl())
      .catch(() => null)
      .then(() => fetch("/api/daily-budgets"))
      .then(async (response) => (response.ok ? ((await response.json()) as { snapshots: BudgetSnapshot[] }) : null))
      .then((data) => {
        if (!cancelled && data) setBudgetSnapshots(data.snapshots ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health-metrics")
      .then(async (response) => (response.ok ? ((await response.json()) as { metrics: HealthMetricSample[] }) : null))
      .then((data) => {
        if (!cancelled && data) setHealthMetrics(data.metrics ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/activities")
      .then(async (response) => {
        if (!response.ok) throw new Error("Aktiviteter kunne ikke hentes");
        return (await response.json()) as { activities: Activity[] };
      })
      .then((data) => {
        if (!cancelled) setActivities(data.activities);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/water-entries")
      .then(async (response) => (response.ok ? ((await response.json()) as { entries: WaterEntry[] }) : null))
      .then((data) => {
        if (!cancelled && data) setWaterEntries(data.entries ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/goals")
      .then((response) => (response.ok ? response.json() : { goals: [] }))
      .then((data: { goals?: GoalDTO[] }) => {
        if (!cancelled) setGoals(data.goals ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const goalsByDate = useMemo(() => {
    const map: GoalsByDate = new Map();
    for (const goal of goals) {
      if (!goal.targetDate) continue;
      map.set(goal.targetDate, [...(map.get(goal.targetDate) ?? []), goal]);
    }
    return map;
  }, [goals]);

  const weighInsByDate = useMemo<WeighInsByDate>(() => {
    const map: WeighInsByDate = new Map();
    const sorted = [...weighIns].sort(
      (a, b) => new Date(a.weighedAt).getTime() - new Date(b.weighedAt).getTime(),
    );
    for (const entry of sorted) {
      const key = isoDate(new Date(entry.weighedAt));
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return map;
  }, [weighIns]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weight-entries")
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((data: { entries?: (WeighIn & CalendarWeighIn)[] }) => {
        if (!cancelled) setWeighIns(data.entries ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/profile").then((response) => response.json()),
      fetch("/api/sleep-schedule").then((response) => response.json()),
      fetch("/api/work-shifts").then((response) => response.json()),
    ])
      .then(([profileData, scheduleData, shiftData]) => {
        if (cancelled) return;
        setSleepDefaults(profileData.user ?? null);
        const user = profileData.user;
        if (user) {
          setEnergyProfile({
            weightKg: user.weightKg ?? null,
            heightCm: user.heightCm ?? null,
            age: computeAge(user.birthDate),
            sex: user.sex ?? null,
            activityLevel: user.activityLevel ?? null,
            palBase: user.palBase ?? null,
            trainingAllowanceKcal: user.trainingAllowanceKcal ?? null,
          });
        }
        const byWeekday: Record<number, SleepScheduleEntry> = {};
        for (const entry of (scheduleData.schedules ?? []) as SleepScheduleEntry[]) {
          byWeekday[entry.weekday] = entry;
        }
        setWeekdaySchedules(byWeekday);
        const byDate: Record<string, WorkShiftEntry> = {};
        for (const shift of (shiftData.shifts ?? []) as WorkShiftEntry[]) {
          byDate[isoDate(new Date(shift.date))] = shift;
        }
        setWorkShifts(byDate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function resolveSleepWindow(date: Date) {
    return getSleepWindow(date, sleepDefaults, weekdaySchedules, workShifts);
  }

  // A drag on the sleep handle applies straight to that date — no "this date
  // or standard pattern?" dialog (user request, 116d3656). The standard
  // pattern is edited under Profil → Søvn.
  function requestSleepAdjust(date: Date, type: SleepAdjustType, minutes: number) {
    const iso = isoDate(date);
    const body = type === "bedtime" ? { bedtime: minutesToTime(minutes) } : { wakeTime: minutesToTime(minutes) };
    setWorkShifts((current) => ({
      ...current,
      [iso]: { ...(current[iso] ?? { date: iso, bedtime: null, wakeTime: null }), ...body },
    }));
    fetch(`/api/work-shifts/${iso}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function handleEntryMoved(registrationId: string, newCreatedAt: Date) {
    const iso = newCreatedAt.toISOString();
    setRegistrations((current) =>
      current.map((registration) =>
        registration.id === registrationId ? { ...registration, createdAt: iso } : registration,
      ),
    );
    fetch(`/api/registrations/${registrationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createdAt: iso }),
    }).catch(() => {});
  }

  function movePeriod(direction: -1 | 1) {
    setSlideDirection(direction === 1 ? "next" : "previous");
    setAnimationKey((key) => key + 1);
    setVisibleDate((current) =>
      effectiveView === "week" || effectiveView === "list"
        ? addDays(current, direction * 7)
        : new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );
  }

  function selectMonth(selectedMonth: number) {
    setSlideDirection(selectedMonth >= month ? "next" : "previous");
    setAnimationKey((key) => key + 1);
    setVisibleDate(new Date(year, selectedMonth, 1));
    setMonthMenuOpen(false);
  }

  function openDate(date: Date) {
    setSelectedDate(date);
    setMonthMenuOpen(false);
    setViewMenuOpen(false);
  }

  const periodLabel = effectiveView === "week" || effectiveView === "list" ? weekLabel : monthLabel;

  return (
    <DailyGoalContext.Provider value={dailyGoalLookup}>
    <HfScreen
      title={isLandscape ? periodLabel : t("nav.calendar")}
      titleClassName={isLandscape ? "hf-appbar__title--tight capitalize" : undefined}
      icon={
        // z-[100] lader dropdownen ligge over sidens indhold — men ikke over
        // dagsvisningens dialog (z-50), hvor ikonet ellers stikker igennem.
        <div className={`relative ${selectedDate ? "" : "z-[100]"}`}>
          <button
            type="button"
            aria-label={t("calendar.switchViewAriaLabel", { view: activeView.label })}
            aria-haspopup="listbox"
            aria-expanded={viewMenuOpen}
            onClick={() => {
              setViewMenuOpen((open) => !open);
              setMonthMenuOpen(false);
            }}
            className="relative flex h-6 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-white"
          >
            <IconCalendar size={24} stroke={1.6} />
            <IconChevronDown
              size={12}
              stroke={2.5}
              className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 ${viewMenuOpen ? "rotate-180" : ""}`}
            />
          </button>
          {/* Med dagsvisningen åben har den sin egen menu; denne (z-[100]) ville
              ellers ligge ovenpå dialogen (z-50) og fange trykket uden at
              lukke dagen. */}
          {viewMenuOpen && !selectedDate && (
            <div className="absolute left-0 top-full z-[100] mt-2 w-44 overflow-hidden rounded-2xl border border-hf-tan-dark bg-hf-white p-1.5 text-hf-black shadow-xl">
              {VIEW_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setView(option.value);
                      setViewMenuOpen(false);
                    }}
                    className="hf-type-body hf-type-strong hf-control-row flex w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black"
                  >
                    <OptionIcon size={20} stroke={1.8} />
                    <span className="flex-1">{option.label}</span>
                    {view === option.value && <IconCheck size={18} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      }
    >
      <div className="relative p-4">
        {(monthMenuOpen || viewMenuOpen) && (
          <button
            type="button"
            aria-label={t("calendar.closeMenuAriaLabel")}
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => {
              setMonthMenuOpen(false);
              setViewMenuOpen(false);
            }}
          />
        )}

        {!isLandscape && (
          <div className="relative z-30 mb-4">
            <div className="flex items-center justify-center gap-3">
              <PeriodButton direction="previous" view={effectiveView} onClick={() => movePeriod(-1)} />
              <div className="relative min-w-0">
                <button
                  type="button"
                  aria-expanded={monthMenuOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    setMonthMenuOpen((open) => !open);
                    setViewMenuOpen(false);
                  }}
                  className="flex min-h-11 max-w-full items-center justify-center rounded-full px-3 text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
                >
                  <span className="hf-type-body hf-type-strong whitespace-nowrap capitalize">
                    {periodLabel}
                  </span>
                </button>
                {monthMenuOpen && (
                  <MonthPicker year={year} month={month} onYearChange={setVisibleDate} onSelect={selectMonth} />
                )}
              </div>
              <PeriodButton direction="next" view={effectiveView} onClick={() => movePeriod(1)} />
            </div>
            {/* Ugenummeret står under datointervallet, midt i luften mellem
                datoen og statuslinjen nedenunder — absolut placeret, så det
                hverken forlænger datolinjen eller gør området højere. */}
            {view === "week" && (
              <p className="hf-type-small text-text-secondary pointer-events-none absolute inset-x-0 top-[calc(100%+2px)] -translate-y-1/2 text-center leading-none lowercase">
                {t("calendar.weekNumberLabel", { number: weekNumber })}
              </p>
            )}
          </div>
        )}

        <MonthlyStatus status={monthlyStatus} />

        <div
          className="touch-pan-y overflow-hidden"
          onPointerDown={
            view === "list"
              ? undefined
              : (event) => {
                  pointerStart.current = event.clientX;
                }
          }
          onPointerUp={
            view === "list"
              ? undefined
              : (event) => {
                  if (pointerStart.current !== null && Math.abs(event.clientX - pointerStart.current) > 48) {
                    movePeriod(event.clientX < pointerStart.current ? 1 : -1);
                  }
                  pointerStart.current = null;
                }
          }
          onPointerCancel={view === "list" ? undefined : () => {
            pointerStart.current = null;
          }}
        >
          <div
            key={`${effectiveView}-${year}-${month}-${animationKey}`}
            className={view === "list" ? "" : slideDirection === "next" ? "calendar-slide-next" : "calendar-slide-previous"}
          >
            {view === "month" && (
              <MonthView
                cells={monthCells}
                month={month}
                today={today}
                dailyTotals={dailyTotals}
                goalsByDate={goalsByDate}
                onOpenDate={openDate}
                weekdays={WEEKDAYS}
              />
            )}
            {view === "week" &&
              (showWeekTimeline ? (
                <WeekTimelineView
                  days={weekDays}
                  today={today}
                  dailyTotals={dailyTotals}
                  registrations={registrations}
                  goalsByDate={goalsByDate}
                  weighInsByDate={weighInsByDate}
                  onOpenDate={openDate}
                  getSleepWindow={resolveSleepWindow}
                  onSleepAdjust={requestSleepAdjust}
                />
              ) : (
                <WeekView
                  days={weekDays}
                  today={today}
                  dailyTotals={dailyTotals}
                  minimumKcal={minimumKcal}
                  goalsByDate={goalsByDate}
                  weighInsByDate={weighInsByDate}
                  onOpenDate={openDate}
                />
              ))}
            {ENABLE_WEEKLY_ENERGY_SUMMARY && view === "week" && !showWeekTimeline && (
              <WeeklyEnergySummaryRow
                days={weekDays}
                today={today}
                dailyTotals={dailyTotals}
                weightEstimate={weeklyWeightEstimate}
              />
            )}
            {view === "list" && (
              <ListView
                days={weekDays}
                today={today}
                dailyTotals={dailyTotals}
                minimumKcal={minimumKcal}
                goalsByDate={goalsByDate}
                weighInsByDate={weighInsByDate}
                onOpenDate={openDate}
                onPrevWeek={() => movePeriod(-1)}
                onNextWeek={() => movePeriod(1)}
              />
            )}
            {ENABLE_WEEKLY_ENERGY_SUMMARY && view === "list" && (
              <WeeklyEnergySummaryRow
                days={weekDays}
                today={today}
                dailyTotals={dailyTotals}
                weightEstimate={weeklyWeightEstimate}
              />
            )}
            {hasLowIntakeDay && (view === "list" || (view === "week" && !showWeekTimeline)) && (
              <LowIntakeNotice minimumKcal={minimumKcal} />
            )}
          </div>
        </div>

        {/* G3: "Månedens synder" for den viste måned (docs/DECISIONS.md 2026-09-24). */}
        {SINNERS_ENABLED && view === "month" && (
          <div className="pt-4">
            <ActionLink
              variant="secondary"
              href={`/statistics/month-sinners?month=${year}-${String(month + 1).padStart(2, "0")}`}
            >
              Månedens synder
            </ActionLink>
          </div>
        )}
      </div>

      {selectedDate && (
        <DayDetails
          key={isoDate(selectedDate)}
          date={selectedDate}
          registrations={registrations.filter((registration) =>
            isSameDay(new Date(registration.createdAt), selectedDate),
          )}
          activities={activities.filter((activity) => isSameDay(new Date(activity.startedAt), selectedDate))}
          waterEntries={waterEntries.filter((entry) => isSameDay(new Date(entry.loggedAt), selectedDate))}
          measurements={measurementsForDay(weighIns, healthMetrics, (time) => isSameDay(time, selectedDate))}
          goals={goalsForDate(goalsByDate, selectedDate)}
          weighIns={weighInsForDate(weighInsByDate, selectedDate)}
          loading={registrationsLoading}
          error={registrationsError}
          sleepWindow={resolveSleepWindow(selectedDate)}
          previousSleepWindow={resolveSleepWindow(addDays(selectedDate, -1))}
          hasHistory={registrations.length > 0}
          onEntryMoved={handleEntryMoved}
          onSleepAdjust={(type, minutes) => requestSleepAdjust(selectedDate, type, minutes)}
          onClose={() => setSelectedDate(null)}
          onNavigate={(direction) => setSelectedDate((current) => (current ? addDays(current, direction) : current))}
          viewOptions={VIEW_OPTIONS}
          activeView={activeView}
          viewMenuOpen={viewMenuOpen}
          onToggleViewMenu={() => setViewMenuOpen((open) => !open)}
          onSelectView={(nextView) => {
            setView(nextView);
            setViewMenuOpen(false);
            setSelectedDate(null);
          }}
        />
      )}

    </HfScreen>
    </DailyGoalContext.Provider>
  );
}

function PeriodButton({
  direction,
  view,
  onClick,
}: {
  direction: "previous" | "next";
  view: CalendarView;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const Icon = direction === "previous" ? IconChevronLeft : IconChevronRight;
  const period = view === "week" || view === "list" ? t("calendar.periodWeek") : t("calendar.periodMonth");
  return (
    <button
      type="button"
      aria-label={t("calendar.periodNavAriaLabel", {
        direction: direction === "previous" ? t("calendar.previous") : t("calendar.next"),
        period,
      })}
      onClick={onClick}
      className="hf-btn-icon text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
    >
      <Icon size={22} />
    </button>
  );
}

function MonthPicker({
  year,
  month,
  onYearChange,
  onSelect,
}: {
  year: number;
  month: number;
  onYearChange: (date: Date) => void;
  onSelect: (month: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="absolute left-1/2 top-12 z-40 w-[310px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-hf-tan-dark bg-hf-white p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label={t("calendar.previousYearAriaLabel")} onClick={() => onYearChange(new Date(year - 1, month, 1))} className="hf-btn-icon hover:bg-hf-cream">
          <IconChevronLeft size={20} />
        </button>
        <span className="hf-heading">{year}</span>
        <button type="button" aria-label={t("calendar.nextYearAriaLabel")} onClick={() => onYearChange(new Date(year + 1, month, 1))} className="hf-btn-icon hover:bg-hf-cream">
          <IconChevronRight size={20} />
        </button>
      </div>
      <div role="listbox" aria-label={t("calendar.selectMonthAriaLabel", { year })} className="grid grid-cols-3 gap-2">
        {MONTHS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="option"
            aria-selected={index === month}
            onClick={() => onSelect(index)}
            className={`hf-choice min-h-11 capitalize focus-visible:outline-2 focus-visible:outline-hf-black ${
              index === month ? "is-selected" : ""
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MonthView({
  cells,
  month,
  today,
  dailyTotals,
  goalsByDate,
  onOpenDate,
  weekdays,
}: {
  cells: Array<Date | null>;
  month: number;
  today: Date;
  dailyTotals: Map<string, number>;
  goalsByDate: GoalsByDate;
  onOpenDate: (date: Date) => void;
  weekdays: string[];
}) {
  const { t } = useTranslation();
  const goalForDate = useDailyGoal();
  // Fejlretninger: brugeren bekræftede eksplicit at ISO-ugenumre til venstre
  // for hver uge i månedsvisningen MÅ bryde det ellers faste layout (kolonnen
  // sidder delvist i den normale p-4-margen) — der er ikke plads til den uden.
  const weeks = useMemo(() => {
    const rows: Array<Array<Date | null>> = [];
    for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
    return rows;
  }, [cells]);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return (
    <>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="w-3.5 shrink-0" aria-hidden="true" />
        <div className="grid flex-1 grid-cols-7 text-center">
          {weekdays.map((day) => <span key={day} className="hf-type-small hf-type-strong text-text-secondary">{day}</span>)}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {weeks.map((week, weekIndex) => {
          const anchor = week.find((date): date is Date => date !== null);
          const weekNumber = anchor ? getIsoWeek(anchor) : null;
          return (
            <div key={weekIndex} className="flex items-center gap-1.5">
              <span
                className="hf-type-micro hf-type-strong text-text-muted -ml-2.5 w-3.5 shrink-0 text-right leading-none"
                aria-hidden="true"
              >
                {weekNumber ?? ""}
              </span>
              <div className="grid flex-1 grid-cols-7 gap-1.5">
                {week.map((date, index) => {
                  if (!date) return <div key={`empty-${weekIndex}-${index}`} className="aspect-square" aria-hidden="true" />;
                  const met = dailyGoalMet(dailyTotals, date, goalForDate(date));
                  const logged = totalKcalForDate(dailyTotals, date) > 0;
                  const current = isSameDay(date, today);
                  // Afsluttede dage (før i dag) uden registreringer tæller som
                  // "mål ikke nået" og får ÷ (brugerens valg 2026-10-02, se
                  // docs/DECISIONS.md). Dagen i dag og fremtidige dage er blanke.
                  const pastEmpty = !current && !logged && date.getTime() < todayStart;
                  const marked = logged || pastEmpty;
                  const isOtherMonth = date.getMonth() !== month;
                  // Dage vi er forbi vises grå og regulære (ikke fede), så
                  // i dag og fremtiden står tydeligst frem.
                  const isPast = stripTime(date).getTime() < stripTime(today).getTime();
                  const hasGoal = goalsForDate(goalsByDate, date).length > 0;
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => onOpenDate(date)}
                      aria-label={`${date.toLocaleDateString("da-DK", { dateStyle: "long" })}${current ? t("calendar.todaySuffix") : ""}${
                        !marked ? "" : met ? t("calendar.goalMetSuffix") : t("calendar.goalMissedSuffix")
                      }${hasGoal ? t("calendar.targetDateSuffix") : ""}`}
                      className={`hf-type-body relative flex aspect-square items-center justify-center rounded-lg border focus-visible:outline-2 focus-visible:outline-hf-black ${
                        isPast ? "" : "hf-type-strong"
                      } ${
                        current
                          ? "border-transparent hf-selected"
                          : isOtherMonth
                            ? "border-hf-gray-border bg-transparent text-text-muted"
                            : isPast
                              ? "border-transparent bg-hf-tan text-text-muted"
                              : "border-transparent bg-hf-tan text-hf-black"
                      }`}
                    >
                      {date.getDate()}
                      {/* Målsætningsdato: konfettikanonen i øverste venstre
                          hjørne, modsat ✓/÷ i højre. */}
                      {hasGoal && (
                        <IconPartyPopper
                          size={12}
                          className={`absolute left-0.5 top-0.5 ${current ? "text-hf-white" : "text-hf-black"}`}
                        />
                      )}
                      {!current &&
                        marked &&
                        (met ? (
                          <IconCheck
                            size={15}
                            stroke={3}
                            className="absolute right-0.5 top-0.5 text-hf-green"
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className="hf-type-strong absolute right-1 top-0.5 text-[15px] leading-none text-hf-red-muted"
                            aria-hidden="true"
                          >
                            ÷
                          </span>
                        ))}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekView({
  days,
  today,
  dailyTotals,
  minimumKcal,
  goalsByDate,
  weighInsByDate,
  onOpenDate,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  minimumKcal: number;
  goalsByDate: GoalsByDate;
  weighInsByDate: WeighInsByDate;
  onOpenDate: (date: Date) => void;
}) {
  const { t } = useTranslation();
  const goalForDate = useDailyGoal();
  return (
    <div className="space-y-2">
      {days.map((date) => {
        const kcal = totalKcalForDate(dailyTotals, date);
        const goalKcal = goalForDate(date);
        const met = dailyGoalMet(dailyTotals, date, goalKcal);
        // An unlogged day is not a missed goal: it shows "Ingen indtastninger"
        // and the full remaining budget, both in gray.
        const logged = kcal > 0;
        const over = kcal > goalKcal;
        const diff = Math.round(Math.abs(goalKcal - kcal));
        const current = isSameDay(date, today);
        // Days that haven't happened yet have no status to show.
        const future = stripTime(date).getTime() > stripTime(today).getTime();
        const tooLow = isIntakeTooLow(kcal, minimumKcal, stripTime(date).getTime() < stripTime(today).getTime());
        const hasGoal = goalsForDate(goalsByDate, date).length > 0;
        const dayWeighIns = weighInsForDate(weighInsByDate, date);
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onOpenDate(date)}
            className="flex min-h-[66px] w-full items-center gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 text-left text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
          >
            <span className="hf-type-small hf-type-strong text-text-secondary w-10 uppercase">{date.toLocaleDateString("da-DK", { weekday: "short" })}</span>
            <span
              className={`hf-type-body flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                current
                  ? "hf-type-strong border-transparent hf-selected"
                  : future
                    ? "hf-type-strong border-hf-gray bg-hf-white text-hf-black"
                    : "border-hf-gray bg-hf-white text-text-muted"
              }`}
            >
              {date.getDate()}
            </span>
            {future ? (
              <span className="flex flex-1 items-center gap-1.5">
                {hasGoal && <IconPartyPopper size={18} className="shrink-0 text-hf-black" />}
                <WeighInMark entries={dayWeighIns} />
              </span>
            ) : (
              <>
                {met && !tooLow && (
                  <IconCheck size={16} stroke={3} className="shrink-0 text-hf-green" aria-hidden="true" />
                )}
                <span
                  className={`hf-type-body flex items-center gap-1.5 ${tooLow ? "hf-type-strong text-hf-warning" : logged ? "font-normal" : "font-normal text-text-muted"}`}
                >
                  {!logged
                    ? t("calendar.noEntries")
                    : tooLow
                      ? t("calendar.intakeTooLow")
                      : met
                        ? t("calendar.goalMet")
                        : t("calendar.goalMissed")}
                  {/* Målsætningsdato: konfettikanonen efter teksten. */}
                  {hasGoal && <IconPartyPopper size={18} className="shrink-0 text-hf-black" />}
                  <WeighInMark entries={dayWeighIns} />
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <span
                    className={`hf-type-body hf-type-strong tabular-nums ${
                      !logged ? "text-text-muted" : tooLow ? "text-hf-warning" : over ? "text-hf-red-dark" : "text-hf-green"
                    }`}
                  >
                    {over ? "÷" : "+"}
                    {diff} kcal
                  </span>
                  <IconChevronRight size={19} className="shrink-0" />
                </span>
              </>
            )}
            {future && <IconChevronRight size={19} className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

// Vejningsmærke i uge- og listerækkerne: kun badevægt-ikonet (rækken har
// ikke plads til tallet ved siden af status og kcal); vægten læses op for
// skærmlæsere og vises i dagvisningen.
function WeighInMark({ entries }: { entries: WeightEntry[] }) {
  const { t } = useTranslation();
  const latest = entries[entries.length - 1];
  if (!latest) return null;
  return (
    <>
      <IconBathScale size={18} className="shrink-0 text-hf-black" />
      <span className="sr-only">{t("calendar.weighInSrLabel", { value: formatKg(latest.weightKg) })}</span>
    </>
  );
}

function LowIntakeNotice({ minimumKcal }: { minimumKcal: number }) {
  const { t } = useTranslation();
  return (
    <p className="hf-type-body mt-4 flex items-start gap-2.5 text-hf-black">
      <span className="mt-1 size-4 shrink-0 rounded-sm bg-hf-warning-fill" aria-hidden="true" />
      <span>{t("calendar.lowIntakeNotice", { minimum: minimumKcal.toLocaleString("da-DK") })}</span>
    </p>
  );
}

function WeeklyEnergySummaryRow({
  days,
  today,
  dailyTotals,
  weightEstimate,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  weightEstimate: WeightChangeEstimate | null;
}) {
  const { t } = useTranslation();
  const goalForDate = useDailyGoal();
  const summary = computeWeeklyEnergySummary(days, today, dailyTotals, goalForDate);
  if (!summary) return null;
  // Same sign convention as the day rows above ("+" = under the goal), so the
  // total reads as the sum of the column it sits under.
  const goalBalance = -summary.balanceKcal;
  const withinGoal = goalBalance >= 0;
  // Same px-4/gap-3 as the rows above; the trailing 19px spacer matches their
  // chevron so the total sits directly under the kcal column.
  return (
    <div className="mt-2 flex items-center gap-3 px-4">
      <span className="hf-type-body flex min-w-0 flex-1 items-center gap-1.5">
        {weightEstimate !== null && (
          <>
            <span className="hf-type-body leading-none text-hf-green" aria-hidden="true">∼</span>
            <span className="text-hf-black opacity-60">
              {t("calendar.weeklyEstimatedWeight", { value: formatEstimatedWeight(weightEstimate.grams) })}
            </span>
          </>
        )}
      </span>
      <span className={`hf-type-body hf-type-strong shrink-0 tabular-nums ${withinGoal ? "text-hf-green" : "text-hf-red-dark"}`}>
        {formatSignedKcal(goalBalance)}
      </span>
      <span className="w-[19px] shrink-0" aria-hidden="true" />
    </div>
  );
}

function ListView({
  days,
  today,
  dailyTotals,
  minimumKcal,
  goalsByDate,
  weighInsByDate,
  onOpenDate,
  onPrevWeek,
  onNextWeek,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  minimumKcal: number;
  goalsByDate: GoalsByDate;
  weighInsByDate: WeighInsByDate;
  onOpenDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const { t } = useTranslation();
  const goalForDate = useDailyGoal();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const overscroll = useRef(0);
  const wheelLockedUntil = useRef(0);
  // Where the finger went down, and whether the list was already resting at
  // its top/bottom edge then. Only a fresh drag that starts at an edge may
  // change week — and only once the finger lifts — so an ordinary scroll that
  // runs into the edge never swaps the week (and resets scrollTop) mid-swipe.
  const touchStart = useRef<{ y: number; atTop: boolean; atBottom: boolean } | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = 0;
  }, [days]);

  function edges(node: HTMLDivElement) {
    return {
      atTop: node.scrollTop <= 0,
      atBottom: node.scrollTop + node.clientHeight >= node.scrollHeight - 1,
    };
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    const node = scrollRef.current;
    if (!node) return;
    // Trackpad momentum keeps firing wheel events after a week change; ignore
    // them briefly so one flick can't skip several weeks.
    if (event.timeStamp < wheelLockedUntil.current) return;
    const { atTop, atBottom } = edges(node);
    if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
      overscroll.current += event.deltaY;
      if (Math.abs(overscroll.current) > 80) {
        const next = overscroll.current > 0;
        overscroll.current = 0;
        wheelLockedUntil.current = event.timeStamp + 600;
        if (next) onNextWeek();
        else onPrevWeek();
      }
    } else {
      overscroll.current = 0;
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const node = scrollRef.current;
    if (!node) return;
    touchStart.current = { y: event.touches[0].clientY, ...edges(node) };
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const node = scrollRef.current;
    const start = touchStart.current;
    touchStart.current = null;
    if (!node || !start) return;
    const deltaY = start.y - event.changedTouches[0].clientY;
    const now = edges(node);
    if (start.atBottom && now.atBottom && deltaY > 60) onNextWeek();
    else if (start.atTop && now.atTop && deltaY < -60) onPrevWeek();
  }

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
      className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto overscroll-contain"
    >
      {days.map((date) => {
        const kcal = totalKcalForDate(dailyTotals, date);
        const goalKcal = goalForDate(date);
        const met = dailyGoalMet(dailyTotals, date, goalKcal);
        // An unlogged day is not a missed goal: it shows "Ingen indtastninger"
        // and the full remaining budget, both in gray.
        const logged = kcal > 0;
        const over = kcal > goalKcal;
        const diff = Math.round(Math.abs(goalKcal - kcal));
        const current = isSameDay(date, today);
        // Days that haven't happened yet have no status to show.
        const future = stripTime(date).getTime() > stripTime(today).getTime();
        const tooLow = isIntakeTooLow(kcal, minimumKcal, stripTime(date).getTime() < stripTime(today).getTime());
        const hasGoal = goalsForDate(goalsByDate, date).length > 0;
        const dayWeighIns = weighInsForDate(weighInsByDate, date);
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onOpenDate(date)}
            className="flex min-h-[66px] w-full shrink-0 items-center gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 text-left text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
          >
            <span className="hf-type-small hf-type-strong text-text-secondary w-10 uppercase">{date.toLocaleDateString("da-DK", { weekday: "short" })}</span>
            <span
              className={`hf-type-body flex size-9 shrink-0 items-center justify-center rounded-lg border ${
                current
                  ? "hf-type-strong border-transparent hf-selected"
                  : future
                    ? "hf-type-strong border-hf-gray bg-hf-white text-hf-black"
                    : "border-hf-gray bg-hf-white text-text-muted"
              }`}
            >
              {date.getDate()}
            </span>
            {future ? (
              <span className="flex flex-1 items-center gap-1.5">
                {hasGoal && <IconPartyPopper size={18} className="shrink-0 text-hf-black" />}
                <WeighInMark entries={dayWeighIns} />
              </span>
            ) : (
              <>
                {met && !tooLow && (
                  <IconCheck size={16} stroke={3} className="shrink-0 text-hf-green" aria-hidden="true" />
                )}
                <span
                  className={`hf-type-body flex items-center gap-1.5 ${tooLow ? "hf-type-strong text-hf-warning" : logged ? "font-normal" : "font-normal text-text-muted"}`}
                >
                  {!logged
                    ? t("calendar.noEntries")
                    : tooLow
                      ? t("calendar.intakeTooLow")
                      : met
                        ? t("calendar.goalMet")
                        : t("calendar.goalMissed")}
                  {/* Målsætningsdato: konfettikanonen efter teksten. */}
                  {hasGoal && <IconPartyPopper size={18} className="shrink-0 text-hf-black" />}
                  <WeighInMark entries={dayWeighIns} />
                </span>
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  <span
                    className={`hf-type-body hf-type-strong tabular-nums ${
                      !logged ? "text-text-muted" : tooLow ? "text-hf-warning" : over ? "text-hf-red-dark" : "text-hf-green"
                    }`}
                  >
                    {over ? "÷" : "+"}
                    {diff} kcal
                  </span>
                  <IconChevronRight size={19} className="shrink-0" />
                </span>
              </>
            )}
            {future && <IconChevronRight size={19} className="shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function WeekTimelineView({
  days,
  today,
  dailyTotals,
  registrations,
  goalsByDate,
  weighInsByDate,
  onOpenDate,
  getSleepWindow,
  onSleepAdjust,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  registrations: Registration[];
  goalsByDate: GoalsByDate;
  weighInsByDate: WeighInsByDate;
  onOpenDate: (date: Date) => void;
  getSleepWindow: (date: Date) => SleepWindow | null;
  onSleepAdjust: (date: Date, type: SleepAdjustType, minutes: number) => void;
}) {
  const { t } = useTranslation();
  const goalForDate = useDailyGoal();
  const headerDrag = useRef<{ x: number; scrollLeft: number } | null>(null);
  const gridDrag = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const [addTarget, setAddTarget] = useState<{ date: string; time: string } | null>(null);
  const getSleepWindowRef = useRef(getSleepWindow);
  useEffect(() => {
    getSleepWindowRef.current = getSleepWindow;
  });

  useEffect(() => {
    const node = gridScrollRef.current;
    if (!node || days.length === 0) return;
    const sleepWindow = getSleepWindowRef.current(days[0]);
    const anchorHour = sleepWindow ? Math.floor(sleepWindow.wakeTime / 60) : 0;
    node.scrollTop = Math.max(0, anchorHour * HOUR_HEIGHT - HOUR_HEIGHT);
  }, [days]);

  function handleHeaderPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    headerDrag.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
  }
  function handleHeaderPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!headerDrag.current) return;
    event.currentTarget.scrollLeft = headerDrag.current.scrollLeft - (event.clientX - headerDrag.current.x);
  }
  function handleHeaderPointerUp() {
    headerDrag.current = null;
  }

  function handleGridPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    gridDrag.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
  }
  function handleGridPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!gridDrag.current) return;
    event.currentTarget.scrollLeft = gridDrag.current.scrollLeft - (event.clientX - gridDrag.current.x);
    event.currentTarget.scrollTop = gridDrag.current.scrollTop - (event.clientY - gridDrag.current.y);
  }
  function handleGridPointerUp() {
    gridDrag.current = null;
  }

  return (
    <>
    <div className="overflow-hidden rounded-2xl border border-hf-tan bg-hf-white">
      <div
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
        className="no-scrollbar flex overflow-x-auto"
      >
        <div className="h-12 w-12 shrink-0 border-b border-r border-hf-tan" />
        {days.map((date) => {
          const met = dailyGoalMet(dailyTotals, date, goalForDate(date));
          const current = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onOpenDate(date)}
              className={`flex h-12 min-w-[92px] flex-1 flex-col items-center justify-center border-b border-r border-hf-tan last:border-r-0 focus-visible:outline-2 focus-visible:outline-hf-black ${
                current ? "hf-selected" : "text-hf-black"
              }`}
            >
              <span className="hf-type-micro hf-type-strong text-text-secondary uppercase">
                {date.toLocaleDateString("da-DK", { weekday: "short" })}
              </span>
              <span className="hf-type-body hf-heading flex items-center gap-2">
                {date.getDate()}
                {met && <IconCheck size={15} stroke={3.5} className="text-hf-green" aria-hidden="true" />}
                {goalsForDate(goalsByDate, date).length > 0 && <IconPartyPopper size={15} />}
                {weighInsForDate(weighInsByDate, date).length > 0 && <IconBathScale size={15} />}
              </span>
            </button>
          );
        })}
      </div>
      <div
        ref={gridScrollRef}
        onPointerDown={handleGridPointerDown}
        onPointerMove={handleGridPointerMove}
        onPointerUp={handleGridPointerUp}
        onPointerCancel={handleGridPointerUp}
        className="no-scrollbar overflow-auto"
        style={{ maxHeight: "calc(100vh - 260px)" }}>
        <div className="flex" style={{ height: TIMELINE_HEIGHT }}>
          <div className="relative w-12 shrink-0 border-r border-hf-tan">
            {HOUR_MARKS.map((hour) => (
              <span
                key={hour}
                className="hf-type-micro hf-type-strong text-text-secondary absolute right-1.5 -translate-y-1/2"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, "0")}
              </span>
            ))}
          </div>
          {days.map((date) => {
            const dayRegistrations = registrations.filter((registration) =>
              isSameDay(new Date(registration.createdAt), date),
            );
            const sleepWindow = getSleepWindow(date);
            return (
              <div key={date.toISOString()} className="relative min-w-[92px] flex-1 border-r border-hf-tan last:border-r-0">
                <SleepBands window={sleepWindow} />
                <div
                  className="absolute inset-0"
                  onDoubleClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const minutes = Math.floor(((event.clientY - rect.top) / HOUR_HEIGHT) * 2) * 30;
                    setAddTarget({ date: isoDate(date), time: minutesToTime(Math.min(minutes, 23 * 60 + 30)) });
                  }}
                />
                {HOUR_MARKS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute left-0 right-0 border-t border-hf-tan/60"
                    style={{ top: hour * HOUR_HEIGHT }}
                  />
                ))}
                {sleepWindow && (
                  <>
                    <SleepBoundaryHandle
                      minutes={sleepWindow.wakeTime}
                      type="wake"
                      onCommit={(type, minutes) => onSleepAdjust(date, type, minutes)}
                    />
                    <SleepBoundaryHandle
                      minutes={bedtimeDisplayMinutes(sleepWindow)}
                      type="bedtime"
                      onCommit={(type, minutes) => onSleepAdjust(date, type, minutes)}
                    />
                  </>
                )}
                {dayRegistrations.map((registration) => {
                  const time = new Date(registration.createdAt);
                  return (
                    <div
                      key={registration.id}
                      className="hf-type-micro hf-type-strong absolute left-0.5 right-0.5 truncate rounded-md bg-hf-green px-1 text-hf-white"
                      style={{ top: (minutesFromMidnight(time) / 60) * HOUR_HEIGHT, minHeight: 18 }}
                      title={`${registration.titleSnapshot} · ${
                        isWaterRegistration(registration)
                          ? formatCl(waterRegistrationMl(registration))
                          : `${Math.round(registration.kcalSnapshot)} kcal`
                      }`}
                    >
                      {isWaterRegistration(registration)
                        ? formatCl(waterRegistrationMl(registration))
                        : `${Math.round(registration.kcalSnapshot)} kcal`}
                    </div>
                  );
                })}
                {weighInsForDate(weighInsByDate, date).map((entry) => {
                  const time = new Date(entry.weighedAt);
                  return (
                    <div
                      key={entry.id}
                      className="hf-type-micro hf-type-strong absolute left-0.5 right-0.5 flex items-center gap-1 truncate rounded-md border border-hf-tan-dark bg-hf-tan px-1 text-hf-black"
                      style={{ top: (minutesFromMidnight(time) / 60) * HOUR_HEIGHT, minHeight: 18 }}
                      title={t("calendar.dayWeighIn", { value: formatKg(entry.weightKg), time: formatClock(entry.weighedAt) })}
                    >
                      <IconBathScale size={12} />
                      {formatKg(entry.weightKg)} kg
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    {addTarget && <AddMenuSheet date={addTarget.date} time={addTarget.time} onClose={() => setAddTarget(null)} />}
    </>
  );
}

function SleepBands({ window, hourHeight = HOUR_HEIGHT }: { window: SleepWindow | null; hourHeight?: number }) {
  if (!window) return null;
  const bandClass = "pointer-events-none absolute inset-x-0 border-hf-gray-border/60 bg-hf-gray/15";
  // Daytime sleep (e.g. after a night shift): bedtime comes before wake time
  // on the clock, so it is ONE band between them — drawing the two
  // midnight-crossing bands here made them overlap into two shades of gray.
  if (isDaytimeSleep(window)) {
    return (
      <div
        className={`${bandClass} border-y`}
        style={{ top: (window.bedtime / 60) * hourHeight, height: ((window.wakeTime - window.bedtime) / 60) * hourHeight }}
        aria-hidden="true"
      />
    );
  }
  const topHeight = (window.wakeTime / 60) * hourHeight;
  const bottomHeight = ((24 * 60 - bedtimeDisplayMinutes(window)) / 60) * hourHeight;
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 border-b border-hf-gray-border/60 bg-hf-gray/15"
        style={{ height: topHeight }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-hf-gray-border/60 bg-hf-gray/15"
        style={{ height: bottomHeight }}
        aria-hidden="true"
      />
    </>
  );
}

// Hvor tæt på visningens kant (px) fingeren skal være, før tidslinjen
// begynder at scrolle med under et træk i søvn-håndtaget, og hvor hurtigt
// (px pr. frame) den scroller helt ude ved kanten.
const SLEEP_DRAG_EDGE_PX = 48;
const SLEEP_DRAG_MAX_SCROLL_PX = 5;

function SleepBoundaryHandle({
  minutes,
  type,
  onCommit,
  onDrag,
  hourHeight = HOUR_HEIGHT,
  scrollRef,
}: {
  minutes: number;
  type: SleepAdjustType;
  onCommit: (type: SleepAdjustType, minutes: number) => void;
  /** Live position while dragging (null when released), so the gray band can follow. */
  onDrag?: (type: SleepAdjustType, minutes: number | null) => void;
  hourHeight?: number;
  /** The timeline's scroll container — scrolled along when the finger reaches its edge. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation();
  const [dragMinutes, setDragMinutes] = useState<number | null>(null);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const lastYRef = useRef(0);
  const startMinutesRef = useRef(minutes);
  const dragMinutesRef = useRef<number | null>(null);
  const autoScrollFrame = useRef<number | null>(null);

  useEffect(() => () => stopAutoScroll(), []);

  function stopAutoScroll() {
    if (autoScrollFrame.current !== null) cancelAnimationFrame(autoScrollFrame.current);
    autoScrollFrame.current = null;
  }

  // Minutterne følger fingeren OG det, tidslinjen er scrollet siden trækket
  // startede — så håndtaget bliver under fingeren, mens visningen ruller med.
  function updateFromPointer() {
    const scrollDelta = (scrollRef?.current?.scrollTop ?? 0) - startScrollTopRef.current;
    const deltaY = lastYRef.current - startYRef.current + scrollDelta;
    const deltaMinutes = (deltaY / hourHeight) * 60;
    // Sengetid kan trækkes helt ned til 24:00 (gemmes som 00:00), men ikke op
    // i nattetimerne, hvor den ville blive vist nederst igen.
    const min = type === "bedtime" ? LATE_BEDTIME_CUTOFF_MINUTES : 0;
    const max = type === "bedtime" ? 24 * 60 : 24 * 60 - 1;
    const next = Math.min(max, Math.max(min, startMinutesRef.current + deltaMinutes));
    dragMinutesRef.current = next;
    setDragMinutes(next);
    onDrag?.(type, next);
  }

  // Træk mod toppen/bunden af visningen scroller den med, ligesom et
  // almindeligt scroll — ellers kunne natten ikke gøres kortere, når
  // håndtaget allerede stod øverst i det synlige udsnit.
  function autoScrollStep() {
    autoScrollFrame.current = null;
    const node = scrollRef?.current;
    if (!node || dragMinutesRef.current === null) return;
    const rect = node.getBoundingClientRect();
    const y = lastYRef.current;
    let speed = 0;
    if (y < rect.top + SLEEP_DRAG_EDGE_PX) {
      speed = -Math.min(1, (rect.top + SLEEP_DRAG_EDGE_PX - y) / SLEEP_DRAG_EDGE_PX) * SLEEP_DRAG_MAX_SCROLL_PX;
    } else if (y > rect.bottom - SLEEP_DRAG_EDGE_PX) {
      speed = Math.min(1, (y - (rect.bottom - SLEEP_DRAG_EDGE_PX)) / SLEEP_DRAG_EDGE_PX) * SLEEP_DRAG_MAX_SCROLL_PX;
    }
    if (speed === 0) return;
    const before = node.scrollTop;
    node.scrollTop = before + speed;
    if (node.scrollTop === before) return;
    updateFromPointer();
    autoScrollFrame.current = requestAnimationFrame(autoScrollStep);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    startYRef.current = event.clientY;
    lastYRef.current = event.clientY;
    startScrollTopRef.current = scrollRef?.current?.scrollTop ?? 0;
    startMinutesRef.current = minutes;
    dragMinutesRef.current = minutes;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragMinutes(minutes);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragMinutesRef.current === null) return;
    event.stopPropagation();
    lastYRef.current = event.clientY;
    updateFromPointer();
    if (autoScrollFrame.current === null) autoScrollFrame.current = requestAnimationFrame(autoScrollStep);
  }

  function finishDrag() {
    stopAutoScroll();
    const final = dragMinutesRef.current;
    // A tap without real movement changes nothing (it used to save and pop a dialog).
    if (final !== null && Math.round(final / 15) !== Math.round(startMinutesRef.current / 15)) {
      onCommit(type, final);
    }
    dragMinutesRef.current = null;
    setDragMinutes(null);
    onDrag?.(type, null);
  }

  const displayMinutes = dragMinutes ?? minutes;
  const top = (displayMinutes / 60) * hourHeight;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label={type === "bedtime" ? t("calendar.adjustBedtimeAriaLabel") : t("calendar.adjustWakeTimeAriaLabel")}
      className="absolute inset-x-0 z-10 flex touch-none items-center justify-center"
      style={{ top: top - 14, height: 28 }}
    >
      <div
        className={`h-1 w-10 rounded-full shadow-sm ${dragMinutes !== null ? "bg-hf-black" : "bg-hf-gray"}`}
      />
    </div>
  );
}

// Halvmåne + "Søvn: 7,50 timer" nederst i det grå felt, der slutter ved
// stå-op-tiden, så man ved første blik kan se, om natten ser rigtig ud.
// Mens stå-op-håndtaget trækkes, står teksten lige under stregen i stedet, så
// timetallet stadig kan ses, når håndtaget er trukket helt op til kanten.
function SleepDurationLabel({
  wakeTime,
  durationMinutes,
  hourHeight,
  belowLine = false,
}: {
  wakeTime: number;
  durationMinutes: number;
  hourHeight: number;
  belowLine?: boolean;
}) {
  const { t, locale } = useTranslation();
  const hours = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    durationMinutes / 60,
  );
  return (
    <p
      className="hf-type-caption pointer-events-none absolute left-2 flex items-center gap-1 whitespace-nowrap"
      style={{ top: (wakeTime / 60) * hourHeight + (belowLine ? 12 : -22) }}
    >
      <IconMoon size={14} stroke={1.8} aria-hidden="true" />
      {t("calendar.nightSleepDuration", { hours })}
    </p>
  );
}

function DayDetails({
  date,
  registrations,
  activities,
  waterEntries,
  measurements,
  goals,
  weighIns,
  loading,
  error,
  sleepWindow,
  previousSleepWindow,
  hasHistory,
  onSleepAdjust,
  onEntryMoved,
  onClose,
  onNavigate,
  viewOptions,
  activeView,
  viewMenuOpen,
  onToggleViewMenu,
  onSelectView,
}: {
  date: Date;
  registrations: Registration[];
  activities: Activity[];
  waterEntries: WaterEntry[];
  /** Dagens vejninger og kropsmålinger (Withings m.fl. eller manuelle). */
  measurements: CalendarMeasurement[];
  goals: GoalDTO[];
  weighIns: WeightEntry[];
  loading: boolean;
  error: boolean;
  sleepWindow: SleepWindow;
  /** The day before's window — its bedtime starts the night that ends this morning. */
  previousSleepWindow: SleepWindow;
  /** Har brugeren registreret noget før? Ellers vises altid morgenen. */
  hasHistory: boolean;
  onSleepAdjust: (type: SleepAdjustType, minutes: number) => void;
  onEntryMoved: (registrationId: string, newCreatedAt: Date) => void;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
  viewOptions: { value: CalendarView; label: string; icon: typeof IconCalendarMonth }[];
  activeView: { value: CalendarView; label: string; icon: typeof IconCalendarMonth };
  viewMenuOpen: boolean;
  onToggleViewMenu: () => void;
  onSelectView: (view: CalendarView) => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const pointerStart = useRef<number | null>(null);
  const [addBarHour, setAddBarHour] = useState<number | null>(null);
  const [openHour, setOpenHour] = useState<number | null>(null);
  const latestWeighIn = weighIns.reduce<WeightEntry | null>(
    (latest, entry) => (!latest || new Date(entry.weighedAt) > new Date(latest.weighedAt) ? entry : latest),
    null,
  );
  // Timen, hvis "Tilføj" har åbnet tilføj-menuen i bundarket (KRAV.md "Bundark").
  const [addSheetHour, setAddSheetHour] = useState<number | null>(null);
  // Målsætningscirklen vises hver gang en dag med en målsætning åbnes
  // (DayDetails er keyed på datoen); et tryk udenfor lukker den, og derefter
  // står kun det lille ikon ud for kl. GOAL_HOUR.
  const [goalPopupDismissed, setGoalPopupDismissed] = useState(false);
  const inWebShell = useInWebShell();
  const [hourHeight, setHourHeight] = useState(() => loadStoredHourHeight(inWebShell));
  const activeZoomPointers = useRef(new Map<number, number>());
  const zoomStart = useRef<{ avgY: number; hourHeight: number } | null>(null);
  const mouseDrag = useRef<{ y: number; scrollTop: number } | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const visitedTodayRef = useRef<boolean | null>(null);
  const [sleepDrag, setSleepDrag] = useState<{ type: SleepAdjustType; minutes: number } | null>(null);
  // Oplevelse af søvn (docs/DECISIONS.md 2026-09-26): the day's 1–5 rating,
  // shown as a black bar at the top. DayDetails is keyed by date, so this
  // runs once per day shown.
  const [sleepRating, setSleepRating] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSleepQuality(localDateKey(date))
      .then((entries) => {
        if (!cancelled) setSleepRating(entries[0]?.rating ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [date]);
  const liveSleepWindow: SleepWindow = sleepDrag
    ? sleepDrag.type === "wake"
      ? { ...sleepWindow, wakeTime: sleepDrag.minutes }
      : { ...sleepWindow, bedtime: sleepDrag.minutes }
    : sleepWindow;
  // Nattens søvn = fra aftenen før (gårsdagens sengetid) til dagens
  // stå-op-tid. Sover man om dagen (sengetid før stå-op-tid på samme dato),
  // er det i stedet dagens eget grå felt, der tælles.
  const nightStart =
    isDaytimeSleep(liveSleepWindow) || isDaytimeSleep(previousSleepWindow)
      ? liveSleepWindow.bedtime
      : previousSleepWindow.bedtime;
  const nightSleepMinutes = (liveSleepWindow.wakeTime - nightStart + 1440) % 1440;
  function handleSleepDrag(type: SleepAdjustType, minutes: number | null) {
    setSleepDrag(minutes === null ? null : { type, minutes });
  }

  function handleTimelinePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    activeZoomPointers.current.set(event.pointerId, event.clientY);
    if (activeZoomPointers.current.size === 2) {
      const values = Array.from(activeZoomPointers.current.values());
      zoomStart.current = { avgY: (values[0] + values[1]) / 2, hourHeight };
    } else if (event.pointerType === "mouse") {
      mouseDrag.current = { y: event.clientY, scrollTop: event.currentTarget.scrollTop };
    }
  }

  function handleTimelinePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (activeZoomPointers.current.has(event.pointerId)) {
      activeZoomPointers.current.set(event.pointerId, event.clientY);
      if (activeZoomPointers.current.size === 2 && zoomStart.current) {
        event.stopPropagation();
        const values = Array.from(activeZoomPointers.current.values());
        const avgY = (values[0] + values[1]) / 2;
        const deltaY = avgY - zoomStart.current.avgY;
        const next = Math.round(zoomStart.current.hourHeight + deltaY * (HOUR_HEIGHT / ZOOM_SENSITIVITY) * 4);
        setHourHeight(Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, next)));
      }
      return;
    }
    if (mouseDrag.current) {
      event.currentTarget.scrollTop = mouseDrag.current.scrollTop - (event.clientY - mouseDrag.current.y);
    }
  }

  function handleTimelinePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    activeZoomPointers.current.delete(event.pointerId);
    if (activeZoomPointers.current.size < 2) zoomStart.current = null;
    mouseDrag.current = null;
    if (activeZoomPointers.current.size === 0) {
      try {
        window.localStorage.setItem(
          inWebShell ? WEB_HOUR_HEIGHT_STORAGE_KEY : HOUR_HEIGHT_STORAGE_KEY,
          String(hourHeight),
        );
      } catch {
        // localStorage unavailable — ignore.
      }
    }
  }

  const timelineHeight = hourHeight * 24;
  const showMinuteLines = hourHeight >= HOUR_HEIGHT * 2;
  const minuteStep = hourHeight >= HOUR_HEIGHT * 3 ? 5 : inWebShell ? 30 : 15;

  // Tidslinjen løber altid fra 00:00 (top) til 24:00 (bund) — ikke roteret om
  // stå-op-tiden. Ved åbning af en dag scroller vi ned, så den sidste hele
  // time af nattens grå felt (med "Nattens søvn: …") er synlig lige over
  // stå-op-håndtaget, og resten af visningen er dagens indhold. Brugeren kan
  // stadig scrolle helt op til 00:00 (Fejlretninger/FEJLLISTE.md #27-opfølgning).
  const dateKey = dayKey(date);
  useEffect(() => {
    const node = timelineScrollRef.current;
    if (!node) return;
    const wakeHour = sleepWindow.wakeTime / 60;
    // Første besøg i dag (cookie): morgenen med nattens søvn. Derefter, for
    // i dag: nu ±2 timer i fokus.
    const todayStr = localDateKey(new Date());
    // Cookien læses kun første gang pr. visning (effekten kører igen ved indlæsning).
    if (visitedTodayRef.current === null) {
      try {
        visitedTodayRef.current = document.cookie.split("; ").some((c) => c === `${VISIT_COOKIE}=${todayStr}`);
        document.cookie = `${VISIT_COOKIE}=${todayStr}; path=/; max-age=172800; SameSite=Lax`;
      } catch {
        visitedTodayRef.current = false;
      }
    }
    const visitedToday = visitedTodayRef.current;
    if (visitedToday && hasHistory && localDateKey(date) === todayStr) {
      const now = new Date();
      const nowHour = now.getHours() + now.getMinutes() / 60;
      // Kan nattens sidste time og "nu" ses på samme skærm (fx kl. 9 med
      // stå-op kl. 7), vises natten stadig — ellers forsvandt den om morgenen.
      const visibleHours = node.clientHeight / hourHeight;
      const startHour = nowHour + 1 - (wakeHour - 1) <= visibleHours ? wakeHour - 1 : nowHour - 2;
      node.scrollTop = Math.max(0, startHour * hourHeight);
    } else {
      node.scrollTop = Math.max(0, (wakeHour - 1) * hourHeight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, dateKey]);

  const dayKcal = registrations.reduce((sum, registration) => sum + registration.kcalSnapshot, 0);
  const dayBonusKcal = activities.reduce((sum, activity) => sum + activity.caloriesBurned, 0);
  // Mål uden motion til visning; nået/ikke nået regnes mod mål + motion.
  const dayGoalKcal = useBaseDailyGoal()(date);
  const hasEntries = registrations.length > 0;
  const met = hasEntries && dayKcal <= dayGoalKcal + dayBonusKcal;
  // Dagsstatus: fremtidige dage viser ingen status.
  const todayKey = dayKey(new Date());
  const isFutureDay = dateKey > todayKey;

  function goToAddFlow(hour: number) {
    // Opens the same "everything you can add" menu as the front page's
    // joystick "Se alle" slot, per explicit user request — since 2026-09-27
    // in the bottom sheet instead of the /add/menu page with a back arrow.
    // date/time are forwarded so the food-search path still lands the
    // registration at the tapped hour.
    setAddSheetHour(hour);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-hf-cream" role="dialog" aria-modal="true" aria-labelledby="day-title">
      <div className="hf-appbar hf-appbar--brand">
        <div className="hf-appbar__slot">
          <button onClick={onClose} aria-label={t("common.back")} className="text-hf-white">
            <HfChevron direction="left" />
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2">
          <div className="relative z-[100] flex h-6 w-6 shrink-0 items-center justify-center text-hf-white">
            <button
              type="button"
              aria-label={t("calendar.switchViewAriaLabel", { view: activeView.label })}
              aria-haspopup="listbox"
              aria-expanded={viewMenuOpen}
              onClick={onToggleViewMenu}
              className="relative flex h-6 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-white"
            >
              <IconCalendar size={24} stroke={1.6} className="text-hf-white" />
              <IconChevronDown
                size={12}
                stroke={2.5}
                className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-hf-white ${viewMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {viewMenuOpen && (
              <div className="absolute left-0 top-full z-[100] mt-2 w-44 overflow-hidden rounded-2xl border border-hf-tan-dark bg-hf-white p-1.5 text-hf-black shadow-xl">
                {viewOptions.map((option) => {
                  const OptionIcon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onSelectView(option.value)}
                      className="hf-type-body hf-type-strong hf-control-row flex w-full items-center gap-3 rounded-xl px-3 text-left hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black"
                    >
                      <OptionIcon size={20} stroke={1.8} />
                      <span className="flex-1">{option.label}</span>
                      {activeView.value === option.value && <IconCheck size={18} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <h1 className="hf-type-nav-title hf-appbar__title first-letter:uppercase">{t("nav.calendar")}</h1>
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        </div>
        {/* Dagsvisningen tegner sin egen topbjælke (fuldskærmsdialog over
            HfScreen), så profilcirklen skal stå her også — ellers forsvinder
            den, så snart en dag åbnes. */}
        <div className="hf-appbar__end">
          <ProfileAvatarLink />
        </div>
      </div>
      {viewMenuOpen && (
        <button
          type="button"
          aria-label={t("calendar.closeMenuAriaLabel")}
          className="fixed inset-0 z-[90] cursor-default"
          onClick={onToggleViewMenu}
        />
      )}
      {/* Samme dato-navigation som uge-/månedsvisningen (ingen hvid boks). */}
      <div className="flex items-center justify-center gap-3 bg-hf-cream px-4 pt-4">
        <button
          type="button"
          onClick={() => onNavigate(-1)}
          aria-label={t("calendar.previousDayAriaLabel")}
          className="hf-btn-icon text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          <IconChevronLeft size={22} />
        </button>
        <h2
          id="day-title"
          className="hf-type-body hf-type-strong flex min-h-11 min-w-0 items-center justify-center px-3 text-hf-black"
        >
          <span className="truncate first-letter:uppercase">
            {date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => onNavigate(1)}
          aria-label={t("calendar.nextDayAriaLabel")}
          className="hf-btn-icon text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          <IconChevronRight size={22} />
        </button>
      </div>
      {sleepRating !== null && (
        <div className="px-4 pt-4">
          <div className="relative rounded-lg bg-hf-black px-4 py-2 text-center text-hf-white">
            <Link
              href="/statistics/sleep"
              className="hf-type-small absolute inset-y-0 right-4 flex items-center text-hf-white no-underline"
            >
              {t("sleepStats.calendarLink")}
            </Link>
            <p className="hf-type-body hf-type-strong">{t("sleepQuality.calendarBar", { rating: sleepRating })}</p>
          </div>
        </div>
      )}
      <div
        className="flex-1 overflow-y-auto p-4 touch-pan-y"
        onPointerDown={(event) => {
          pointerStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerStart.current !== null && Math.abs(event.clientX - pointerStart.current) > 48) {
            onNavigate(event.clientX < pointerStart.current ? 1 : -1);
          }
          pointerStart.current = null;
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        {loading ? (
          <SkeletonScreen className="flex flex-col gap-2">
            <Skeleton type="caption" width={40} height={12} />
            <SkeletonCards count={6} height={52} gap={6} radius={16} />
          </SkeletonScreen>
        ) : error ? (
          <div className="rounded-2xl bg-hf-white p-4 text-center">
            <p className="hf-type-strong text-hf-black">{t("calendar.registrationsLoadError")}</p>
            <p className="hf-type-body text-text-secondary mt-1">{t("calendar.registrationsLoadErrorHint")}</p>
          </div>
        ) : (
          <>
            <div className="mb-1 flex pl-px" aria-hidden="true">
              <span
                className="hf-type-micro hf-type-strong text-text-secondary shrink-0 text-center"
                style={{ width: DAY_TIME_GUTTER_WIDTH }}
              >
                {t("calendar.hourColumnLabel")}
              </span>
            </div>
            <div
              ref={timelineScrollRef}
              className="no-scrollbar relative touch-pan-y overflow-y-auto rounded-2xl border border-hf-tan bg-hf-white"
              style={{ maxHeight: "calc(100vh - 300px)" }}
              onPointerDown={handleTimelinePointerDown}
              onPointerMove={handleTimelinePointerMove}
              onPointerUp={handleTimelinePointerEnd}
              onPointerCancel={handleTimelinePointerEnd}
              onScroll={() => setAddBarHour(null)}
            >
              <div className="relative" style={{ height: timelineHeight, marginLeft: DAY_TIME_GUTTER_WIDTH }}>
                <div
                  className="absolute top-0 h-full"
                  style={{ left: -DAY_TIME_GUTTER_WIDTH, width: DAY_TIME_GUTTER_WIDTH }}
                >
                  {HOUR_MARKS.map((mark) => (
                    <span
                      key={mark}
                      className="hf-type-micro hf-type-strong text-text-secondary absolute inset-x-0 -translate-y-1/2 text-center"
                      style={{ top: mark * hourHeight }}
                    >
                      {String(mark % 24).padStart(2, "0")}
                    </span>
                  ))}
                </div>
                {HOUR_MARKS.map((mark) => (
                  <div key={mark} className="absolute left-0 right-0 border-t border-hf-tan/60" style={{ top: mark * hourHeight }} />
                ))}
                {showMinuteLines &&
                  Array.from({ length: 24 }, (_, mark) =>
                    Array.from({ length: Math.floor(60 / minuteStep) - 1 }, (_, step) => (step + 1) * minuteStep).map(
                      (minuteOffset) => (
                        <div
                          key={`${mark}-${minuteOffset}`}
                          className="absolute left-0 right-0 border-t border-hf-tan/30"
                          style={{ top: mark * hourHeight + (minuteOffset / 60) * hourHeight }}
                        />
                      ),
                    ),
                  )}
                <SleepBands window={liveSleepWindow} hourHeight={hourHeight} />
                <SleepDurationLabel
                  wakeTime={liveSleepWindow.wakeTime}
                  durationMinutes={nightSleepMinutes}
                  hourHeight={hourHeight}
                  belowLine={sleepDrag?.type === "wake"}
                />
                <SleepBoundaryHandle
                  minutes={sleepWindow.wakeTime}
                  type="wake"
                  hourHeight={hourHeight}
                  scrollRef={timelineScrollRef}
                  onCommit={onSleepAdjust}
                  onDrag={handleSleepDrag}
                />
                <SleepBoundaryHandle
                  minutes={bedtimeDisplayMinutes(sleepWindow)}
                  type="bedtime"
                  hourHeight={hourHeight}
                  scrollRef={timelineScrollRef}
                  onCommit={onSleepAdjust}
                  onDrag={handleSleepDrag}
                />
                {addBarHour !== null && (
                  <button
                    type="button"
                    aria-label={t("calendar.closeAddAriaLabel")}
                    className="absolute inset-0 z-10"
                    onClick={() => setAddBarHour(null)}
                  />
                )}
                {Array.from({ length: 24 }, (_, hour) => {
                  const hourRegistrations = registrations.filter(
                    (registration) => new Date(registration.createdAt).getHours() === hour,
                  );
                  const kcalTotal = hourRegistrations.reduce((sum, registration) => sum + registration.kcalSnapshot, 0);
                  const hourActivities = activities.filter(
                    (activity) => new Date(activity.startedAt).getHours() === hour,
                  );
                  // Vand (egen tabel + vand-registreringer) vises som glas + cl,
                  // aldrig som "0 kalorier".
                  const hourWaterEntries = waterEntries.filter((entry) => new Date(entry.loggedAt).getHours() === hour);
                  const waterRegistrations = hourRegistrations.filter(isWaterRegistration);
                  const waterMl =
                    hourWaterEntries.reduce((sum, entry) => sum + entry.amountMl, 0) +
                    waterRegistrations.reduce((sum, registration) => sum + waterRegistrationMl(registration), 0);
                  // Kun dagens seneste vejning vises i timeoversigten; alle står i timens detaljer.
                  const hourWeighIns = latestWeighIn && new Date(latestWeighIn.weighedAt).getHours() === hour ? [latestWeighIn] : [];
                  // Ældre vejninger på dagen vises kun i timens detaljer.
                  const hourMeasurements = measurements.filter(
                    (item) =>
                      item.time.getHours() === hour &&
                      (item.weightKg === null || (latestWeighIn !== null && item.id === `weight-${latestWeighIn.id}`)),
                  );
                  return (
                    <HourRow
                      key={hour}
                      hour={hour}
                      top={hour * hourHeight}
                      height={hourHeight}
                      kcalTotal={kcalTotal}
                      waterMl={waterMl}
                      activities={hourActivities}
                      weighIns={hourWeighIns}
                      weightKg={hourMeasurements.findLast((item) => item.weightKg !== null)?.weightKg ?? null}
                      hasMeasurement={hourMeasurements.length > 0}
                      hasEntries={hourRegistrations.length > 0 || hourWaterEntries.length > 0 || hourMeasurements.length > 0}
                      hasFood={hourRegistrations.length > waterRegistrations.length}
                      hasGoal={hour === GOAL_HOUR && goals.length > 0}
                      showAddBar={addBarHour === hour}
                      onOpenDetails={setOpenHour}
                      onLongPress={setAddBarHour}
                      onTapAddBar={(h) => {
                        setAddBarHour(null);
                        goToAddFlow(h);
                      }}
                    />
                  );
                })}
                {showMinuteLines &&
                  registrations.map((registration) => (
                    <DraggableEntryMarker
                      key={registration.id}
                      registration={registration}
                      hourHeight={hourHeight}
                      onOpen={() => router.push(`/registration/${registration.id}`)}
                      onMoved={(newCreatedAt) => onEntryMoved(registration.id, newCreatedAt)}
                    />
                  ))}
              </div>
            </div>
          </>
        )}

        {/* Dagens vejning(er) med klokkeslæt — her er der plads til tallet. */}
        {latestWeighIn && (
          <div className="mt-4 space-y-1 pr-1">
            {[latestWeighIn].map((entry) => (
              <p
                key={entry.id}
                className="hf-type-body flex items-center justify-end gap-1.5 whitespace-nowrap text-right text-hf-black"
              >
                <IconBathScale size={16} />
                {t("calendar.dayWeighIn", { value: formatKg(entry.weightKg), time: formatClock(entry.weighedAt) })}
              </p>
            ))}
          </div>
        )}
        <GoalStatusSummary
          className="mt-2 pr-1"
          status={isFutureDay ? null : hasEntries ? (met ? "met" : "missed") : "none"}
          goalKcal={dayGoalKcal}
          intakeKcal={dayKcal}
          bonusKcal={dayBonusKcal}
        />
      </div>

      {!goalPopupDismissed && goals.length > 0 && (
        <GoalPopup goal={goals[0]} onOpen={() => router.push("/profile/goals")} onClose={() => setGoalPopupDismissed(true)} />
      )}

      {openHour !== null && (
        <HourEntriesOverlay
          hour={openHour}
          registrations={registrations.filter((registration) => new Date(registration.createdAt).getHours() === openHour)}
          waterEntries={waterEntries.filter((entry) => new Date(entry.loggedAt).getHours() === openHour)}
          measurements={measurements.filter((item) => item.time.getHours() === openHour)}
          goals={openHour === GOAL_HOUR ? goals : []}
          weighIns={weighIns.filter((entry) => new Date(entry.weighedAt).getHours() === openHour)}
          onClose={() => setOpenHour(null)}
        />
      )}

      {addSheetHour !== null && (
        <AddMenuSheet
          date={isoDate(date)}
          time={`${String(Math.floor(addSheetHour)).padStart(2, "0")}:${addSheetHour % 1 ? "30" : "00"}`}
          onClose={() => setAddSheetHour(null)}
        />
      )}
    </div>
  );
}

function HourRow({
  hour,
  top,
  height,
  kcalTotal,
  waterMl,
  weightKg,
  hasMeasurement,
  activities,
  weighIns,
  hasEntries,
  hasFood,
  hasGoal,
  showAddBar,
  onOpenDetails,
  onLongPress,
  onTapAddBar,
}: {
  hour: number;
  top: number;
  height: number;
  kcalTotal: number;
  /** Timens vand i ml (0 = intet vand). */
  waterMl: number;
  /** Timens (seneste) vejning — null uden vejning. */
  weightKg: number | null;
  /** En måling uden vejning (fx blodtryk) viser kun vægt-ikonet. */
  hasMeasurement: boolean;
  activities: Activity[];
  weighIns: WeightEntry[];
  hasEntries: boolean;
  /** Mindst én registrering, der ikke er vand — ellers vises kun glasset. */
  hasFood: boolean;
  hasGoal: boolean;
  showAddBar: boolean;
  onOpenDetails: (hour: number) => void;
  onLongPress: (hour: number) => void;
  onTapAddBar: (hour: number) => void;
}) {
  const { t } = useTranslation();
  const bonusKcal = activities.reduce((sum, activity) => sum + activity.caloriesBurned, 0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const longPressedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  function clearTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    movedRef.current = false;
    longPressedRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = setTimeout(() => {
      if (!movedRef.current) {
        longPressedRef.current = true;
        onLongPress(hour);
      }
    }, ADD_BAR_HOLD_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > ADD_BAR_MOVE_TOLERANCE) {
      movedRef.current = true;
      clearTimer();
    }
  }

  return (
    <div
      className="absolute inset-x-0 select-none [-webkit-touch-callout:none]"
      style={{ top, height }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      // Dobbeltklik (mus) / dobbelttryk åbner tilføj-menuen direkte på timen —
      // det lange tryk med "Tilføj"-baren er ikke til at gætte med en mus.
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        clearTimer();
        const rect = event.currentTarget.getBoundingClientRect();
        onTapAddBar(hour + (event.clientY - rect.top >= rect.height / 2 ? 0.5 : 0));
      }}
    >
      {/* Timen med en målsætning kan trykkes på i hele sin bredde og åbner
          timens oversigt med målsætningen øverst (men ikke lige efter et
          langt tryk, der viser "Tilføj"-baren). */}
      {(hasGoal || weighIns.length > 0) && (
        <button
          type="button"
          aria-label={t(hasGoal ? "calendar.openTargetDateAriaLabel" : "calendar.openWeighInAriaLabel")}
          onClick={() => {
            if (!longPressedRef.current && !movedRef.current) onOpenDetails(hour);
          }}
          className="absolute inset-0 z-[4] focus-visible:outline-2 focus-visible:outline-hf-black"
        />
      )}
      {(activities.length > 0 || hasGoal || weighIns.length > 0) && (
        <div className="pointer-events-none absolute inset-y-0 left-1 z-[5] flex items-center gap-1">
          {hasGoal && <IconPartyPopper size={16} className="text-hf-black" />}
          {weighIns.map((entry) => (
            <span key={entry.id} className="hf-type-small hf-type-strong flex items-center gap-1 text-hf-black">
              <IconBathScale size={16} />
              {formatKg(entry.weightKg)} kg
            </span>
          ))}
          {activities.map((activity) => {
            const { icon: SportIcon, label } = getSportMeta(activity.sportType);
            return <SportIcon key={activity.id} size={16} className="text-hf-black opacity-70" aria-label={label} />;
          })}
          {activities.length > 0 && (
            <EnergyChip kind="burned" value={bonusKcal} className="hf-type-small hf-type-strong text-hf-green" />
          )}
        </div>
      )}
      {hasEntries && (
        <button
          type="button"
          onClick={() => onOpenDetails(hour)}
          className="hf-type-small hf-type-strong absolute inset-y-0 right-1 z-[5] flex items-center gap-2 pl-2 text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          {hasFood && <EnergyChip kind="intake" value={kcalTotal} />}
          {waterMl > 0 && <EnergyChip kind="water" value={waterMl} />}
          {hasMeasurement && weighIns.length === 0 && (
            <span className="flex items-center gap-1">
              <IconScale size={16} aria-hidden="true" />
              {weightKg !== null && formatWeightKg(weightKg)}
            </span>
          )}
          <IconChevronRight size={16} className="-ml-1 opacity-50" />
        </button>
      )}
      {showAddBar && (
        <button
          type="button"
          onClick={() => onTapAddBar(hour)}
          className="hf-type-small hf-type-strong absolute inset-x-1 inset-y-0.5 z-20 flex items-center justify-center rounded-md bg-hf-black text-hf-white"
        >
          {t("nav.add")}
        </button>
      )}
    </div>
  );
}

// A single registration shown directly on the timeline, only once two-finger
// zoom has revealed minute lines (otherwise all of the day's registrations
// would flood the compact 40px-tall view). A short tap opens the registration;
// a ½ sec hold enters "move" mode (shows time+name), and a subsequent
// vertical drag adjusts the time (5-min snap) until release, which saves via
// PATCH /api/registrations/[id].
function DraggableEntryMarker({
  registration,
  hourHeight,
  onOpen,
  onMoved,
}: {
  registration: Registration;
  hourHeight: number;
  onOpen: () => void;
  onMoved: (newCreatedAt: Date) => void;
}) {
  const originalMinutes = minutesFromMidnight(new Date(registration.createdAt));
  const [dragMinutes, setDragMinutes] = useState<number | null>(null);
  const armedRef = useRef(false);
  const movedRef = useRef(false);
  const startYRef = useRef(0);
  const dragMinutesRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    startYRef.current = event.clientY;
    movedRef.current = false;
    armedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    timerRef.current = setTimeout(() => {
      if (!movedRef.current) {
        armedRef.current = true;
        dragMinutesRef.current = originalMinutes;
        setDragMinutes(originalMinutes);
      }
    }, MOVE_ENTRY_HOLD_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const deltaY = event.clientY - startYRef.current;
    if (!armedRef.current) {
      if (Math.abs(deltaY) > MOVE_ENTRY_MOVE_TOLERANCE) {
        movedRef.current = true;
        clearTimer();
      }
      return;
    }
    event.stopPropagation();
    const deltaMinutesRaw = (deltaY / hourHeight) * 60;
    const snapped = Math.round(deltaMinutesRaw / 5) * 5;
    const next = Math.min(24 * 60 - 1, Math.max(0, originalMinutes + snapped));
    dragMinutesRef.current = next;
    setDragMinutes(next);
  }

  function finish() {
    clearTimer();
    if (armedRef.current && dragMinutesRef.current !== null && dragMinutesRef.current !== originalMinutes) {
      const next = new Date(registration.createdAt);
      next.setHours(Math.floor(dragMinutesRef.current / 60), dragMinutesRef.current % 60, 0, 0);
      onMoved(next);
    } else if (!armedRef.current && !movedRef.current) {
      onOpen();
    }
    armedRef.current = false;
    movedRef.current = false;
    dragMinutesRef.current = null;
    setDragMinutes(null);
  }

  const displayMinutes = dragMinutes ?? originalMinutes;
  const top = (displayMinutes / 60) * hourHeight;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
      className={`hf-type-micro hf-type-strong absolute left-1 right-14 z-[6] touch-none truncate rounded-md px-1.5 text-hf-white ${
        dragMinutes !== null ? "bg-hf-black" : "bg-hf-green"
      }`}
      style={{ top, height: 16, lineHeight: "16px" }}
    >
      {dragMinutes !== null
        ? `${minutesToTime(displayMinutes)} · ${registration.titleSnapshot}`
        : registration.titleSnapshot}
    </div>
  );
}

// Målsætningscirklen midt på dagvisningen: samme størrelse og tan-baggrund
// som produktbilledet på produktsiden (190px), med konfettikanonen og målet.
// Tryk på cirklen åbner målsætningen; tryk udenfor lukker den.
function GoalPopup({ goal, onOpen, onClose }: { goal: GoalDTO; onOpen: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const target = primaryGoalTarget(goal);
  return (
    <div className="absolute inset-0 z-[55] flex items-center justify-center">
      <button
        type="button"
        aria-label={t("calendar.closeTargetDateAriaLabel")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onOpen}
        aria-label={t("calendar.openTargetDateAriaLabel")}
        className="relative flex size-[190px] flex-col items-center justify-center gap-2 rounded-full bg-hf-tan text-hf-black shadow-xl focus-visible:outline-2 focus-visible:outline-hf-black"
      >
        <PartyPopperImage size={72} />
        {target && <GoalTargetValue target={target} className="hf-type-body-lg hf-heading" />}
      </button>
    </div>
  );
}

// Målværdien: grøn når målet er nået, ellers grå.
function GoalTargetValue({ target, className = "" }: { target: GoalTargetDTO; className?: string }) {
  return (
    <span className={`tabular-nums ${target.completedAt ? "text-hf-green" : "text-text-muted"} ${className}`}>
      {formatGoalValue(target.value)} {target.unit}
    </span>
  );
}

// Målsætningen øverst i timens oversigt: foldbar som tidsgrupperne under den.
// Er det et vægtmål, står målvægten i midten af rækken.
function GoalAccordion({ goal }: { goal: GoalDTO }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const weight = goal.targets.find((target) => target.type === "weight") ?? null;
  return (
    <div className="mb-2 overflow-hidden rounded-2xl bg-hf-tan">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="hf-control-row grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
      >
        <span className="hf-type-body flex min-w-0 items-center gap-2 text-hf-black">
          <IconPartyPopper size={18} className="shrink-0" />
          <span className="truncate">{t("goals.title")}</span>
        </span>
        {weight ? <GoalTargetValue target={weight} className="hf-type-body" /> : <span />}
        <span className="flex justify-end">
          <HfChevron direction={open ? "down" : "right"} className="text-hf-black" />
        </span>
      </button>
      {open && (
        <div className="bg-hf-cream px-4">
          {goal.targets.map((target) => (
            <div key={target.id} className="flex items-center justify-between gap-4 border-b border-hf-tan-dark py-3">
              <span className="hf-type-body text-hf-black">{t(goalTargetNameKey(target.type))}</span>
              <GoalTargetValue target={target} className="hf-type-body" />
            </div>
          ))}
          <Link
            href="/profile/goals"
            className="hf-control-row hf-type-body flex items-center justify-between text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
          >
            {t("calendar.openTargetDate")}
            <IconChevronRight size={18} className="shrink-0" />
          </Link>
        </div>
      )}
    </div>
  );
}

// Én linje i timens oversigt: en registrering (mad eller vand-vare) eller et
// glas vand fra /water/create.
type HourItem =
  | { kind: "registration"; id: string; time: Date; registration: Registration }
  | { kind: "water"; id: string; time: Date; entry: WaterEntry }
  | { kind: "measurement"; id: string; time: Date; measurement: CalendarMeasurement };

function HourEntriesOverlay({
  hour,
  registrations,
  waterEntries,
  measurements,
  goals,
  weighIns,
  onClose,
}: {
  hour: number;
  registrations: Registration[];
  waterEntries: WaterEntry[];
  measurements: CalendarMeasurement[];
  goals: GoalDTO[];
  weighIns: WeightEntry[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sorted: HourItem[] = [
    ...registrations.map<HourItem>((registration) => ({
      kind: "registration",
      id: registration.id,
      time: new Date(registration.createdAt),
      registration,
    })),
    ...waterEntries.map<HourItem>((entry) => ({ kind: "water", id: entry.id, time: new Date(entry.loggedAt), entry })),
    ...measurements.map<HourItem>((measurement) => ({ kind: "measurement", id: measurement.id, time: measurement.time, measurement })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());
  const groups: Array<{ key: string; time: Date; items: HourItem[] }> = [];
  for (const item of sorted) {
    const key = `${item.time.getHours()}:${item.time.getMinutes()}`;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) lastGroup.items.push(item);
    else groups.push({ key, time: item.time, items: [item] });
  }
  // Hvert præcist tidspunkt er en foldbar accordion (lukket som standard) —
  // brugerens eksplicitte rettelse: tidligere var alle indtastninger altid
  // fuldt udfoldet under tidsangivelsen. Kollapset viser tid + samlet kcal +
  // HfChevron, magen til den kollapsede time-række i selve dagsvisningen.
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  function toggleGroup(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-hf-cream" role="dialog" aria-modal="true">
      <div
        className="relative flex items-center justify-center bg-hf-green px-4 pb-4 text-hf-white"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.back")}
          className="hf-btn-icon absolute bottom-3 left-3 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <HfChevron direction="left" className="text-hf-white" />
        </button>
        <h2 className="hf-type-body-lg hf-heading">
          {t("calendar.hourRangeLabel", {
            start: String(hour).padStart(2, "0"),
            end: String((hour + 1) % 24).padStart(2, "0"),
          })}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {goals.map((goal) => (
          <GoalAccordion key={goal.id} goal={goal} />
        ))}
        {weighIns.map((entry) => (
          <div key={entry.id} className="hf-control-row mb-2 flex items-center justify-between rounded-2xl bg-hf-tan px-4">
            <span className="hf-type-body hf-type-strong text-hf-black">{formatClock(entry.weighedAt)}</span>
            <span className="hf-type-body hf-type-strong flex items-center gap-1.5 text-hf-black">
              <IconBathScale size={18} />
              {formatKg(entry.weightKg)} kg
            </span>
          </div>
        ))}
        {groups.map((group) => {
          const isOpen = openKeys.has(group.key);
          // Kalorier fra mad som "540 kcal", vand som glas + cl — begge kan
          // stå på samme tidspunkt. Vand-varer tæller ikke som mad.
          const foodItems = group.items.filter(
            (item) => item.kind === "registration" && !isWaterRegistration(item.registration),
          );
          const groupKcal = foodItems.reduce(
            (sum, item) => sum + (item.kind === "registration" ? item.registration.kcalSnapshot : 0),
            0,
          );
          const groupWaterMl = group.items.reduce(
            (sum, item) =>
              sum +
              (item.kind === "water"
                ? item.entry.amountMl
                : item.kind === "registration" && isWaterRegistration(item.registration)
                  ? waterRegistrationMl(item.registration)
                  : 0),
            0,
          );
          const groupWeight = group.items.find(
            (item): item is Extract<HourItem, { kind: "measurement" }> => item.kind === "measurement" && item.measurement.weightKg !== null,
          );
          return (
            <div key={group.key} className="mb-2 overflow-hidden rounded-2xl bg-hf-tan">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
                className="hf-control-row flex w-full items-center justify-between px-4 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
              >
                <span className="hf-type-body hf-type-strong text-hf-black">
                  {new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(group.time)}
                </span>
                <span className="hf-type-body hf-type-strong flex items-center gap-2 text-hf-black">
                  {foodItems.length > 0 && <EnergyChip kind="intake" value={groupKcal} iconSize={18} />}
                  {groupWaterMl > 0 && <EnergyChip kind="water" value={groupWaterMl} iconSize={18} />}
                  {groupWeight && (
                    <span className="flex items-center gap-1">
                      <IconScale size={18} aria-hidden="true" />
                      {formatWeightKg(groupWeight.measurement.weightKg as number)}
                    </span>
                  )}
                  <HfChevron direction={isOpen ? "down" : "right"} className="-ml-1 text-hf-black" />
                </span>
              </button>
              {isOpen && (
                <div className="bg-hf-cream px-4">
                  {group.items.map((item, i) => {
                    const rowClass = `block focus-visible:outline-2 focus-visible:outline-hf-black ${
                      i < group.items.length - 1 ? "border-b border-hf-tan-dark" : ""
                    }`;
                    if (item.kind === "water") {
                      return (
                        <div key={item.id} className={rowClass}>
                          <FoodRow
                            thumbnail={<IconWaterGlass size={22} className="text-hf-black" />}
                            title={t("calendar.waterTitle")}
                            right={
                              <EnergyChip
                                kind="water"
                                value={item.entry.amountMl}
                                iconSize={18}
                                className="hf-type-body hf-type-strong text-hf-black"
                              />
                            }
                          />
                        </div>
                      );
                    }
                    if (item.kind === "measurement") {
                      return <MeasurementRow key={item.id} measurement={item.measurement} className={rowClass} />;
                    }
                    const { registration } = item;
                    const isWater = isWaterRegistration(registration);
                    return (
                      <Link key={item.id} href={`/registration/${registration.id}`} className={rowClass}>
                        <FoodRow
                          image={isWater ? undefined : registration.product?.imageUrl}
                          thumbnail={
                            isWater && !registration.product?.imageUrl ? (
                              <IconWaterGlass size={22} className="text-hf-black" />
                            ) : undefined
                          }
                          title={registration.titleSnapshot}
                          right={
                            <EnergyChip
                              kind={isWater ? "water" : "intake"}
                              value={isWater ? waterRegistrationMl(registration) : registration.kcalSnapshot}
                              iconSize={18}
                              className="hf-type-body hf-type-strong text-hf-black"
                            />
                          }
                        />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// En vejning med vægtens øvrige målinger (fedtprocent, muskelmasse …) eller
// en måling uden vejning (fx blodtryk) — alt, integrationen har leveret.
function MeasurementRow({ measurement, className }: { measurement: CalendarMeasurement; className: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const weighInId = measurement.id.startsWith("weight-") ? measurement.id.slice("weight-".length) : null;
  const source = measurement.source && measurement.source !== "MANUAL" ? t(`calendar.measurement.source.${measurement.source}`) : null;
  return (
    <div
      className={`${className} ${weighInId ? "cursor-pointer" : ""}`}
      {...(weighInId
        ? {
            role: "button",
            tabIndex: 0,
            onClick: () => setOpen(true),
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === "Enter" || event.key === " ") setOpen(true);
            },
          }
        : {})}
    >
      <FoodRow
        thumbnail={<IconScale size={22} className="text-hf-black" aria-hidden="true" />}
        title={measurement.weightKg !== null ? t("calendar.measurement.weight") : t("calendar.measurement.title")}
        subtitle={source ? <p className="hf-type-small text-text-secondary">{source}</p> : undefined}
        right={
          measurement.weightKg !== null ? (
            <span className="hf-type-body hf-type-strong text-hf-black">{formatWeightKg(measurement.weightKg)}</span>
          ) : undefined
        }
      />
      {measurement.metrics.length > 0 && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 pb-3 pl-[54px]">
          {measurement.metrics.map((metric) => (
            <div key={metric.type} className="contents">
              <dt className="hf-type-small text-text-secondary">{t(`calendar.measurement.type.${metric.type}`)}</dt>
              <dd className="hf-type-small hf-type-strong text-right text-hf-black">{formatMeasurementValue(metric)}</dd>
            </div>
          ))}
        </dl>
      )}
      {open && weighInId && (
        <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <WeightEntryDetailsSheet id={weighInId} onClose={() => setOpen(false)} />
        </span>
      )}
    </div>
  );
}

type MonthlyStatusData = {
  isCurrentMonth: boolean;
  consideredDays: number;
  metCount: number;
  remaining: number;
  sevenDayRemaining: number;
  streak: number;
  goalSum: number;
  consumed: number;
  bonusKcal: number;
};

function MonthlyStatus({ status }: { status: MonthlyStatusData }) {
  const { t } = useTranslation();
  const { remaining, streak } = status;
  const withinGoal = remaining >= 0;

  return (
    <div className="mb-8 mt-2 space-y-2 text-center">
      {streak >= 5 && (
        <div className="mb-4 flex flex-col items-center gap-1">
          <span className="relative flex size-9 items-center justify-center" aria-label={t("calendar.streakAriaLabel", { streak })}>
            <IconStarFilled size={36} className="text-hf-green" aria-hidden="true" />
            <span className="hf-type-small hf-type-strong absolute text-hf-white">{streak}</span>
          </span>
          <p className="hf-type-body hf-type-strong text-hf-black">{t("calendar.streakMessage", { streak })}</p>
        </div>
      )}

      <GoalStatusSummary
        className="text-left"
        period="month"
        status={withinGoal ? "met" : "missed"}
        goalKcal={status.goalSum}
        intakeKcal={status.consumed}
        bonusKcal={status.bonusKcal}
      />
    </div>
  );
}
