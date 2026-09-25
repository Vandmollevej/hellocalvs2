"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  IconStarFilled,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { HfChevron } from "@/components/hf/HfChevron";
import { ActionLink } from "@/components/hf/ActionButton";
import { FoodRow } from "@/components/FoodRow";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
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
  type EnergyProfile,
  type WeighIn,
  type WeightChangeEstimate,
} from "@/lib/weekly-energy-summary";
import { computeAge } from "@/lib/age";
import { getSportMeta } from "@/lib/sport-icons";
import { useDefaultCalendarView } from "@/lib/calendar-view-pref";
import { useTranslation } from "@/i18n/LocaleProvider";

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
  createdAt: string;
  productId?: string | null;
  product?: { imageUrl: string | null } | null;
};

type Activity = {
  id: string;
  sportType: string;
  startedAt: string;
  durationMinutes: number;
  caloriesBurned: number;
};

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

function dailyGoalMet(dailyTotals: Map<string, number>, date: Date) {
  const total = totalKcalForDate(dailyTotals, date);
  return total > 0 && total <= DAILY_KCAL_GOAL;
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
const ADD_BAR_HOLD_MS = 1000;
const ADD_BAR_MOVE_TOLERANCE = 10;
const MOVE_ENTRY_HOLD_MS = 500;
const MOVE_ENTRY_MOVE_TOLERANCE = 10;
const MIN_HOUR_HEIGHT = HOUR_HEIGHT;
const MAX_HOUR_HEIGHT = HOUR_HEIGHT * 4;
const ZOOM_SENSITIVITY = 220; // px to fingers must move for a full 1x scale step
const HOUR_HEIGHT_STORAGE_KEY = "hellocal.kalender.hourHeight";

function loadStoredHourHeight(): number {
  if (typeof window === "undefined") return HOUR_HEIGHT;
  const raw = window.localStorage.getItem(HOUR_HEIGHT_STORAGE_KEY);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isNaN(parsed)) return HOUR_HEIGHT;
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
  const [view, setView] = useState<CalendarView>(defaultView);
  const appliedDefaultView = useRef(false);
  // Settings → Visning → Kalendervisning determines only the INITIAL view on
  // load (useState above already SSR-safely defaults to "month" before the
  // localStorage-backed preference hydrates) — apply it once when it becomes
  // available, without overriding a view the user has since picked by hand.
  useEffect(() => {
    if (appliedDefaultView.current) return;
    appliedDefaultView.current = true;
    setView(defaultView);
  }, [defaultView]);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "previous">("next");
  const [animationKey, setAnimationKey] = useState(0);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sleepDefaults, setSleepDefaults] = useState<SleepDefaults | null>(null);
  const [energyProfile, setEnergyProfile] = useState<EnergyProfile | null>(null);
  const [weighIns, setWeighIns] = useState<WeighIn[]>([]);
  const [weekdaySchedules, setWeekdaySchedules] = useState<Record<number, SleepScheduleEntry>>({});
  const [workShifts, setWorkShifts] = useState<Record<string, WorkShiftEntry>>({});
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
      formulaMaintenance: formulaMaintenanceEstimate(bmr, activities),
    });
    return estimateWeeklyWeightChange({
      days: weekDays,
      today,
      dailyTotals,
      activityByDay: activityKcalByDay(activities),
      bmr,
      adaptiveMaintenance,
    });
  }, [energyProfile, weighIns, activities, dailyTotals, weekDays, today]);

  const monthlyStatus = useMemo(() => {
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const consideredDays = isCurrentMonth ? today.getDate() : daysInMonth;

    let consumed = 0;
    let metCount = 0;
    for (let day = 1; day <= consideredDays; day += 1) {
      const total = totalKcalForDate(dailyTotals, new Date(year, month, day));
      consumed += total;
      if (total > 0 && total <= DAILY_KCAL_GOAL) metCount += 1;
    }
    const remaining = DAILY_KCAL_GOAL * consideredDays - consumed;

    let sevenDayConsumed = 0;
    for (let offset = 0; offset < 7; offset += 1) {
      sevenDayConsumed += totalKcalForDate(dailyTotals, addDays(today, -offset));
    }
    const sevenDayRemaining = DAILY_KCAL_GOAL * 7 - sevenDayConsumed;

    let streak = 0;
    while (dailyGoalMet(dailyTotals, addDays(today, -streak))) streak += 1;

    return { isCurrentMonth, consideredDays, metCount, remaining, sevenDayRemaining, streak };
  }, [dailyTotals, year, month, today]);

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
    fetch("/api/weight-entries")
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((data: { entries?: WeighIn[] }) => {
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
    <HfScreen
      title={isLandscape ? periodLabel : t("nav.calendar")}
      titleClassName={isLandscape ? "hf-appbar__title--tight capitalize" : undefined}
      icon={
        <div className="relative z-[100]">
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
          {viewMenuOpen && (
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
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black"
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
                  <span className="whitespace-nowrap text-[15px] font-semibold capitalize">
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
              <p className="pointer-events-none absolute inset-x-0 top-[calc(100%+2px)] -translate-y-1/2 text-center text-[13px] font-normal leading-none lowercase text-hf-black opacity-60">
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
                  onOpenDate={openDate}
                  getSleepWindow={resolveSleepWindow}
                  onSleepAdjust={requestSleepAdjust}
                />
              ) : (
                <WeekView days={weekDays} today={today} dailyTotals={dailyTotals} onOpenDate={openDate} />
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
          </div>
        </div>

        {/* G3: "Månedens synder" for den viste måned (docs/DECISIONS.md 2026-09-24). */}
        {view === "month" && (
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
          today={today}
          registrations={registrations.filter((registration) =>
            isSameDay(new Date(registration.createdAt), selectedDate),
          )}
          activities={activities.filter((activity) => isSameDay(new Date(activity.startedAt), selectedDate))}
          loading={registrationsLoading}
          error={registrationsError}
          sleepWindow={resolveSleepWindow(selectedDate)}
          previousSleepWindow={resolveSleepWindow(addDays(selectedDate, -1))}
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
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
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
    <div className="absolute left-1/2 top-12 z-40 w-[310px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-3xl border border-hf-tan-dark bg-hf-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label={t("calendar.previousYearAriaLabel")} onClick={() => onYearChange(new Date(year - 1, month, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-hf-cream">
          <IconChevronLeft size={20} />
        </button>
        <span className="hf-heading">{year}</span>
        <button type="button" aria-label={t("calendar.nextYearAriaLabel")} onClick={() => onYearChange(new Date(year + 1, month, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-hf-cream">
          <IconChevronRight size={20} />
        </button>
      </div>
      <div role="listbox" aria-label={t("calendar.selectMonthAriaLabel", { year })} className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="option"
            aria-selected={index === month}
            onClick={() => onSelect(index)}
            className={`min-h-11 rounded-xl px-2 text-sm capitalize focus-visible:outline-2 focus-visible:outline-hf-black ${
              index === month ? "bg-hf-green font-bold text-hf-white" : "bg-hf-cream hover:bg-hf-tan"
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
  onOpenDate,
  weekdays,
}: {
  cells: Array<Date | null>;
  month: number;
  today: Date;
  dailyTotals: Map<string, number>;
  onOpenDate: (date: Date) => void;
  weekdays: string[];
}) {
  const { t } = useTranslation();
  // Fejlretninger: brugeren bekræftede eksplicit at ISO-ugenumre til venstre
  // for hver uge i månedsvisningen MÅ bryde det ellers faste layout (kolonnen
  // sidder delvist i den normale p-4-margen) — der er ikke plads til den uden.
  const weeks = useMemo(() => {
    const rows: Array<Array<Date | null>> = [];
    for (let index = 0; index < cells.length; index += 7) rows.push(cells.slice(index, index + 7));
    return rows;
  }, [cells]);
  return (
    <>
      <div className="mb-2 flex items-center gap-1.5">
        <span className="w-3.5 shrink-0" aria-hidden="true" />
        <div className="grid flex-1 grid-cols-7 text-center">
          {weekdays.map((day) => <span key={day} className="text-xs font-medium opacity-60">{day}</span>)}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, weekIndex) => {
          const anchor = week.find((date): date is Date => date !== null);
          const weekNumber = anchor ? getIsoWeek(anchor) : null;
          return (
            <div key={weekIndex} className="flex items-center gap-1.5">
              <span
                className="-ml-2.5 w-3.5 shrink-0 text-right text-[9px] font-medium leading-none opacity-45"
                aria-hidden="true"
              >
                {weekNumber ?? ""}
              </span>
              <div className="grid flex-1 grid-cols-7 gap-1.5">
                {week.map((date, index) => {
                  if (!date) return <div key={`empty-${weekIndex}-${index}`} className="aspect-square" aria-hidden="true" />;
                  const met = dailyGoalMet(dailyTotals, date);
                  const current = isSameDay(date, today);
                  const isOtherMonth = date.getMonth() !== month;
                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      onClick={() => onOpenDate(date)}
                      aria-label={`${date.toLocaleDateString("da-DK", { dateStyle: "long" })}${current ? t("calendar.todaySuffix") : ""}${
                        met ? t("calendar.goalMetSuffix") : t("calendar.goalMissedSuffix")
                      }`}
                      className={`relative flex aspect-square items-center justify-center rounded-lg border text-sm font-medium focus-visible:outline-2 focus-visible:outline-hf-black ${
                        current
                          ? "border-hf-green bg-hf-green text-hf-white"
                          : isOtherMonth
                            ? "border-hf-gray-border bg-transparent text-hf-gray"
                            : "border-transparent bg-hf-tan text-hf-black"
                      }`}
                    >
                      {date.getDate()}
                      {!current &&
                        (met ? (
                          <IconCheck
                            size={12}
                            stroke={3}
                            className="absolute right-0.5 top-0.5 text-hf-lime"
                            aria-hidden="true"
                          />
                        ) : (
                          <span
                            className="absolute right-1 top-0.5 text-[11px] font-bold leading-none text-hf-red-muted"
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
  onOpenDate,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  onOpenDate: (date: Date) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {days.map((date) => {
        const kcal = totalKcalForDate(dailyTotals, date);
        const met = dailyGoalMet(dailyTotals, date);
        const diff = Math.round(Math.abs(DAILY_KCAL_GOAL - kcal));
        const current = isSameDay(date, today);
        // Days that haven't happened yet have no status to show.
        const future = stripTime(date).getTime() > stripTime(today).getTime();
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onOpenDate(date)}
            className="flex min-h-[66px] w-full items-center justify-between gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 text-left text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
          >
            <span className="w-10 text-xs font-bold uppercase opacity-70">{date.toLocaleDateString("da-DK", { weekday: "short" })}</span>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                current ? "border-hf-green bg-hf-green text-hf-white" : "border-hf-gray bg-hf-white text-hf-black"
              }`}
            >
              {date.getDate()}
            </span>
            {future ? (
              <span className="flex-1" />
            ) : (
              <>
                {met && <IconCheck size={16} stroke={3} className="shrink-0 text-hf-lime" aria-hidden="true" />}
                <span className="text-sm font-normal">{met ? t("calendar.goalMet") : t("calendar.goalMissed")}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={`text-sm font-bold tabular-nums ${met ? "text-hf-green" : "text-hf-red-dark"}`}>
                    {met ? "+" : "÷"}
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
  const summary = computeWeeklyEnergySummary(days, today, dailyTotals, DAILY_KCAL_GOAL);
  if (!summary) return null;
  // Same sign convention as the day rows above ("+" = under the goal), so the
  // total reads as the sum of the column it sits under.
  const goalBalance = -summary.balanceKcal;
  const withinGoal = goalBalance >= 0;
  // Same px-4/gap-3 as the rows above; the trailing 19px spacer matches their
  // chevron so the total sits directly under the kcal column.
  return (
    <div className="mt-2 flex items-center gap-3 px-4">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-normal">
        {weightEstimate !== null && (
          <>
            <span className="text-base leading-none text-hf-green" aria-hidden="true">∼</span>
            <span className="text-hf-black opacity-60">
              {t("calendar.weeklyEstimatedWeight", { value: formatEstimatedWeight(weightEstimate.grams) })}
            </span>
          </>
        )}
      </span>
      <span className={`shrink-0 text-sm font-bold tabular-nums ${withinGoal ? "text-hf-green" : "text-hf-red-dark"}`}>
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
  onOpenDate,
  onPrevWeek,
  onNextWeek,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  onOpenDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const overscroll = useRef(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = 0;
  }, [days]);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    const node = scrollRef.current;
    if (!node) return;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
      overscroll.current += event.deltaY;
      if (overscroll.current > 80) {
        overscroll.current = 0;
        onNextWeek();
      } else if (overscroll.current < -80) {
        overscroll.current = 0;
        onPrevWeek();
      }
    } else {
      overscroll.current = 0;
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    touchStartY.current = event.touches[0].clientY;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const node = scrollRef.current;
    if (!node || touchStartY.current === null) return;
    const deltaY = touchStartY.current - event.touches[0].clientY;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    if ((atTop && deltaY < 0) || (atBottom && deltaY > 0)) {
      if (Math.abs(deltaY) > 60) {
        touchStartY.current = event.touches[0].clientY;
        if (deltaY > 0) onNextWeek();
        else onPrevWeek();
      }
    }
  }

  return (
    <div
      ref={scrollRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        touchStartY.current = null;
      }}
      className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto overscroll-contain"
    >
      {days.map((date) => {
        const kcal = totalKcalForDate(dailyTotals, date);
        const met = dailyGoalMet(dailyTotals, date);
        const diff = Math.round(Math.abs(DAILY_KCAL_GOAL - kcal));
        const current = isSameDay(date, today);
        // Days that haven't happened yet have no status to show.
        const future = stripTime(date).getTime() > stripTime(today).getTime();
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onOpenDate(date)}
            className="flex min-h-[66px] w-full shrink-0 items-center justify-between gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 text-left text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
          >
            <span className="w-10 text-xs font-bold uppercase opacity-70">{date.toLocaleDateString("da-DK", { weekday: "short" })}</span>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                current ? "border-hf-green bg-hf-green text-hf-white" : "border-hf-gray bg-hf-white text-hf-black"
              }`}
            >
              {date.getDate()}
            </span>
            {future ? (
              <span className="flex-1" />
            ) : (
              <>
                {met && <IconCheck size={16} stroke={3} className="shrink-0 text-hf-lime" aria-hidden="true" />}
                <span className="text-sm font-normal">{met ? t("calendar.goalMet") : t("calendar.goalMissed")}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={`text-sm font-bold tabular-nums ${met ? "text-hf-green" : "text-hf-red-dark"}`}>
                    {met ? "+" : "÷"}
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
  onOpenDate,
  getSleepWindow,
  onSleepAdjust,
}: {
  days: Date[];
  today: Date;
  dailyTotals: Map<string, number>;
  registrations: Registration[];
  onOpenDate: (date: Date) => void;
  getSleepWindow: (date: Date) => SleepWindow | null;
  onSleepAdjust: (date: Date, type: SleepAdjustType, minutes: number) => void;
}) {
  const headerDrag = useRef<{ x: number; scrollLeft: number } | null>(null);
  const gridDrag = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
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
          const met = dailyGoalMet(dailyTotals, date);
          const current = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onOpenDate(date)}
              className={`flex h-12 min-w-[92px] flex-1 flex-col items-center justify-center border-b border-r border-hf-tan last:border-r-0 focus-visible:outline-2 focus-visible:outline-hf-black ${
                current ? "bg-hf-green text-hf-white" : "text-hf-black"
              }`}
            >
              <span className="text-[10px] font-bold uppercase opacity-70">
                {date.toLocaleDateString("da-DK", { weekday: "short" })}
              </span>
              <span className="hf-heading flex items-center gap-2 text-sm">
                {date.getDate()}
                {met && <IconCheck size={15} stroke={3.5} className="text-hf-lime" aria-hidden="true" />}
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
                className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium opacity-50"
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
                      minutes={sleepWindow.bedtime}
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
                      className="absolute left-0.5 right-0.5 truncate rounded-md bg-hf-green px-1 text-[10px] font-semibold text-hf-white"
                      style={{ top: (minutesFromMidnight(time) / 60) * HOUR_HEIGHT, minHeight: 18 }}
                      title={`${registration.titleSnapshot} · ${Math.round(registration.kcalSnapshot)} kcal`}
                    >
                      {Math.round(registration.kcalSnapshot)} kcal
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SleepBands({ window, hourHeight = HOUR_HEIGHT }: { window: SleepWindow | null; hourHeight?: number }) {
  if (!window) return null;
  const bandClass = "pointer-events-none absolute inset-x-0 border-hf-gray-border/60 bg-hf-gray/15";
  // Daytime sleep (e.g. after a night shift): bedtime comes before wake time
  // on the clock, so it is ONE band between them — drawing the two
  // midnight-crossing bands here made them overlap into two shades of gray.
  if (window.bedtime < window.wakeTime) {
    return (
      <div
        className={`${bandClass} border-y`}
        style={{ top: (window.bedtime / 60) * hourHeight, height: ((window.wakeTime - window.bedtime) / 60) * hourHeight }}
        aria-hidden="true"
      />
    );
  }
  const topHeight = (window.wakeTime / 60) * hourHeight;
  const bottomHeight = ((24 * 60 - window.bedtime) / 60) * hourHeight;
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
    const next = Math.min(24 * 60 - 1, Math.max(0, startMinutesRef.current + deltaMinutes));
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

// "Nattens søvn: 7,50 timer" nederst i det grå felt, der slutter ved
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
      className="hf-type-caption pointer-events-none absolute left-2 whitespace-nowrap"
      style={{ top: (wakeTime / 60) * hourHeight + (belowLine ? 12 : -22) }}
    >
      {t("calendar.nightSleepDuration", { hours })}
    </p>
  );
}

function DayDetails({
  date,
  today,
  registrations,
  activities,
  loading,
  error,
  sleepWindow,
  previousSleepWindow,
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
  today: Date;
  registrations: Registration[];
  activities: Activity[];
  loading: boolean;
  error: boolean;
  sleepWindow: SleepWindow;
  /** The day before's window — its bedtime starts the night that ends this morning. */
  previousSleepWindow: SleepWindow;
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
  const canGoForward = stripTime(date) < stripTime(today);
  const pointerStart = useRef<number | null>(null);
  const [addBarHour, setAddBarHour] = useState<number | null>(null);
  const [openHour, setOpenHour] = useState<number | null>(null);
  const [hourHeight, setHourHeight] = useState(() => loadStoredHourHeight());
  const activeZoomPointers = useRef(new Map<number, number>());
  const zoomStart = useRef<{ avgY: number; hourHeight: number } | null>(null);
  const mouseDrag = useRef<{ y: number; scrollTop: number } | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [sleepDrag, setSleepDrag] = useState<{ type: SleepAdjustType; minutes: number } | null>(null);
  const liveSleepWindow: SleepWindow = sleepDrag
    ? sleepDrag.type === "wake"
      ? { ...sleepWindow, wakeTime: sleepDrag.minutes }
      : { ...sleepWindow, bedtime: sleepDrag.minutes }
    : sleepWindow;
  // Nattens søvn = fra aftenen før (gårsdagens sengetid) til dagens
  // stå-op-tid. Sover man om dagen (sengetid før stå-op-tid på samme dato),
  // er det i stedet dagens eget grå felt, der tælles.
  const nightStart =
    liveSleepWindow.bedtime < liveSleepWindow.wakeTime ||
    previousSleepWindow.bedtime < previousSleepWindow.wakeTime
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
        window.localStorage.setItem(HOUR_HEIGHT_STORAGE_KEY, String(hourHeight));
      } catch {
        // localStorage unavailable — ignore.
      }
    }
  }

  const timelineHeight = hourHeight * 24;
  const showMinuteLines = hourHeight >= HOUR_HEIGHT * 2;
  const minuteStep = hourHeight >= HOUR_HEIGHT * 3 ? 5 : 15;

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
    node.scrollTop = Math.max(0, (wakeHour - 1) * hourHeight);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, dateKey]);

  const dayKcal = registrations.reduce((sum, registration) => sum + registration.kcalSnapshot, 0);
  const remaining = DAILY_KCAL_GOAL - dayKcal;
  const hasEntries = registrations.length > 0;
  const met = hasEntries && dayKcal <= DAILY_KCAL_GOAL;

  function goToAddFlow(hour: number) {
    // Opens the same "everything you can add" menu as the front page's
    // joystick "list" slot (/add/menu), per explicit user request — not the
    // old direct jump to /foods. date/time are forwarded so the food-search
    // path still lands the registration at the tapped hour.
    const params = new URLSearchParams({
      date: isoDate(date),
      time: `${String(hour).padStart(2, "0")}:00`,
    });
    router.push(`/add/menu?${params.toString()}`);
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
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black"
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
        <div className="hf-appbar__slot" />
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
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          <IconChevronLeft size={22} />
        </button>
        <h2
          id="day-title"
          className="flex min-h-11 min-w-0 items-center justify-center px-3 text-[15px] font-semibold text-hf-black"
        >
          <span className="truncate first-letter:uppercase">
            {date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => canGoForward && onNavigate(1)}
          disabled={!canGoForward}
          aria-label={t("calendar.nextDayAriaLabel")}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black disabled:opacity-30"
        >
          <IconChevronRight size={22} />
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto p-4 touch-pan-y"
        onPointerDown={(event) => {
          pointerStart.current = event.clientX;
        }}
        onPointerUp={(event) => {
          if (pointerStart.current !== null && Math.abs(event.clientX - pointerStart.current) > 48) {
            const direction: -1 | 1 = event.clientX < pointerStart.current ? 1 : -1;
            if (direction === 1 && !canGoForward) {
              pointerStart.current = null;
              return;
            }
            onNavigate(direction);
          }
          pointerStart.current = null;
        }}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        {loading ? (
          <div className="rounded-2xl bg-hf-white p-5 text-center text-sm opacity-60">
            {t("calendar.loadingDayRegistrations")}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-hf-white p-5 text-center">
            <p className="font-semibold text-hf-black">{t("calendar.registrationsLoadError")}</p>
            <p className="mt-1 text-sm text-hf-black opacity-60">{t("calendar.registrationsLoadErrorHint")}</p>
          </div>
        ) : (
          <>
            <div className="mb-1 flex pl-px" aria-hidden="true">
              <span
                className="shrink-0 text-center text-[10px] font-medium opacity-50"
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
            >
              <div className="relative" style={{ height: timelineHeight, marginLeft: DAY_TIME_GUTTER_WIDTH }}>
                <div
                  className="absolute top-0 h-full"
                  style={{ left: -DAY_TIME_GUTTER_WIDTH, width: DAY_TIME_GUTTER_WIDTH }}
                >
                  {HOUR_MARKS.map((mark) => (
                    <span
                      key={mark}
                      className="absolute inset-x-0 -translate-y-1/2 text-center text-[10px] font-medium opacity-50"
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
                  minutes={sleepWindow.bedtime}
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
                  return (
                    <HourRow
                      key={hour}
                      hour={hour}
                      top={hour * hourHeight}
                      height={hourHeight}
                      kcalTotal={kcalTotal}
                      activities={hourActivities}
                      hasEntries={hourRegistrations.length > 0}
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

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2 gap-y-1 pr-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
                met ? "bg-hf-green" : hasEntries ? "bg-hf-red-dark" : "bg-hf-gray"
              }`}
            >
              {met ? (
                <IconCheck size={13} stroke={3} className="text-hf-white" aria-hidden="true" />
              ) : (
                <span className="size-2 rounded-full bg-hf-white" aria-hidden="true" />
              )}
            </span>
            <p className="min-w-0 truncate text-sm font-semibold text-hf-black">
              {hasEntries
                ? met
                  ? t("calendar.dailyGoalReached")
                  : t("calendar.dailyGoalExceeded")
                : t("calendar.dailyGoalNone")}
            </p>
          </div>
          <p className="whitespace-nowrap text-right text-sm text-hf-gray">
            {t("calendar.goalLabel", { goal: DAILY_KCAL_GOAL })}
          </p>
          <div aria-hidden="true" />
          {remaining >= 0 ? (
            <p className="whitespace-nowrap text-right text-sm font-normal text-hf-black">
              {t("calendar.remainingToday")}
            </p>
          ) : (
            <p className="whitespace-nowrap text-right text-sm font-semibold text-hf-red-dark">
              {t("calendar.exceededCalories", { amount: Math.round(Math.abs(remaining)) })}
            </p>
          )}
        </div>
      </div>

      {openHour !== null && (
        <HourEntriesOverlay
          hour={openHour}
          registrations={registrations.filter((registration) => new Date(registration.createdAt).getHours() === openHour)}
          onClose={() => setOpenHour(null)}
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
  activities,
  hasEntries,
  showAddBar,
  onOpenDetails,
  onLongPress,
  onTapAddBar,
}: {
  hour: number;
  top: number;
  height: number;
  kcalTotal: number;
  activities: Activity[];
  hasEntries: boolean;
  showAddBar: boolean;
  onOpenDetails: (hour: number) => void;
  onLongPress: (hour: number) => void;
  onTapAddBar: (hour: number) => void;
}) {
  const { t } = useTranslation();
  const bonusKcal = activities.reduce((sum, activity) => sum + activity.caloriesBurned, 0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  function clearTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    movedRef.current = false;
    startRef.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = setTimeout(() => {
      if (!movedRef.current) onLongPress(hour);
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
    >
      {activities.length > 0 && (
        <div className="absolute inset-y-0 left-1 z-[5] flex items-center gap-1">
          {activities.map((activity) => {
            const { icon: SportIcon, label } = getSportMeta(activity.sportType);
            return <SportIcon key={activity.id} size={16} className="text-hf-black opacity-70" aria-label={label} />;
          })}
          <span className="text-xs font-bold text-hf-green">+{Math.round(bonusKcal)} kcal</span>
        </div>
      )}
      {hasEntries && (
        <button
          type="button"
          onClick={() => onOpenDetails(hour)}
          className="absolute inset-y-0 right-1 z-[5] flex items-center gap-1 pl-2 text-xs font-bold text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
        >
          <span>{Math.round(kcalTotal)} kalorier</span>
          <IconChevronRight size={16} className="opacity-50" />
        </button>
      )}
      {showAddBar && (
        <button
          type="button"
          onClick={() => onTapAddBar(hour)}
          className="absolute inset-x-1 inset-y-0.5 z-20 flex items-center justify-center rounded-md bg-hf-black text-xs font-semibold text-hf-white"
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
      className={`absolute left-1 right-14 z-[6] touch-none truncate rounded-md px-1.5 text-[10px] font-semibold text-hf-white ${
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

function HourEntriesOverlay({
  hour,
  registrations,
  onClose,
}: {
  hour: number;
  registrations: Registration[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sorted = [...registrations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const groups: Array<{ key: string; time: Date; items: Registration[] }> = [];
  for (const registration of sorted) {
    const time = new Date(registration.createdAt);
    const key = `${time.getHours()}:${time.getMinutes()}`;
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.key === key) lastGroup.items.push(registration);
    else groups.push({ key, time, items: [registration] });
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
          className="absolute bottom-3 left-3 flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <HfChevron direction="left" className="text-hf-white" />
        </button>
        <h2 className="hf-heading text-lg">
          {t("calendar.hourRangeLabel", {
            start: String(hour).padStart(2, "0"),
            end: String((hour + 1) % 24).padStart(2, "0"),
          })}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => {
          const isOpen = openKeys.has(group.key);
          const groupKcal = group.items.reduce((sum, registration) => sum + registration.kcalSnapshot, 0);
          return (
            <div key={group.key} className="mb-2 overflow-hidden rounded-2xl bg-hf-tan">
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
              >
                <span className="text-sm font-semibold text-hf-black">
                  {new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(group.time)}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-hf-black">
                  {Math.round(groupKcal)} kalorier
                  <HfChevron direction={isOpen ? "down" : "right"} className="text-hf-black" />
                </span>
              </button>
              {isOpen && (
                <div className="bg-hf-cream px-4">
                  {group.items.map((registration, i) => (
                    <Link
                      key={registration.id}
                      href={`/registration/${registration.id}`}
                      className={`block focus-visible:outline-2 focus-visible:outline-hf-black ${
                        i < group.items.length - 1 ? "border-b border-hf-tan-dark" : ""
                      }`}
                    >
                      <FoodRow
                        image={registration.product?.imageUrl}
                        title={registration.titleSnapshot}
                        right={
                          <span className="text-sm font-bold text-hf-black">
                            {Math.round(registration.kcalSnapshot)} kcal
                          </span>
                        }
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
};

function MonthlyStatus({ status }: { status: MonthlyStatusData }) {
  const { t } = useTranslation();
  const { remaining, streak } = status;
  const withinGoal = remaining >= 0;

  return (
    <div className="mb-6 mt-2 space-y-1.5 text-center">
      {streak >= 5 && (
        <div className="mb-3 flex flex-col items-center gap-1">
          <span className="relative flex size-9 items-center justify-center" aria-label={t("calendar.streakAriaLabel", { streak })}>
            <IconStarFilled size={36} className="text-hf-green" aria-hidden="true" />
            <span className="absolute text-xs font-bold text-hf-white">{streak}</span>
          </span>
          <p className="text-sm font-semibold text-hf-black">{t("calendar.streakMessage", { streak })}</p>
        </div>
      )}

      <div className="flex items-start justify-start gap-2 text-left">
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
            withinGoal ? "bg-hf-green" : "bg-hf-red-muted"
          }`}
        >
          {withinGoal ? (
            <IconCheck size={13} stroke={3} className="text-hf-white" aria-hidden="true" />
          ) : (
            <span className="text-[11px] font-bold leading-none text-hf-white" aria-hidden="true">
              ÷
            </span>
          )}
        </span>
        <p className="text-base font-semibold text-hf-black">
          {withinGoal ? t("calendar.withinGoal") : t("calendar.notWithinGoal")}
        </p>
      </div>
    </div>
  );
}
