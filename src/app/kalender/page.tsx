"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconCalendar,
  IconCalendarMonth,
  IconCalendarWeek,
  IconCheck,
  IconArrowLeft,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconLayoutList,
  IconMinus,
  IconStarFilled,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import { groupByDay } from "@/lib/daily-totals";
import { getSportMeta } from "@/lib/sport-icons";

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
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

const VIEW_OPTIONS = [
  { value: "month" as const, label: "Måned", icon: IconCalendarMonth },
  { value: "week" as const, label: "Uge", icon: IconCalendarWeek },
  { value: "list" as const, label: "Liste", icon: IconLayoutList },
];

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mondayOf(date: Date) {
  return addDays(date, -((date.getDay() + 6) % 7));
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function goalWasMet(date: Date, today: Date) {
  return new Set([2, 5, 6, 9, 14, 18, 23, 27]).has(date.getDate()) || isSameDay(date, today);
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
  while (cells.length % 7) cells.push(null);
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

// Falder tilbage til en typisk nattesøvn (23:00–07:00), hvis brugeren endnu
// ikke har sat søvnmønster/arbejdstider — søvnvisualiseringen skal altid vises.
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
  return { bedtime: bedtime ?? 23 * 60, wakeTime: wakeTime ?? 7 * 60 };
}

function rotatedTop(minutes: number, anchorMinutes: number, hourHeight: number = HOUR_HEIGHT) {
  const wrapped = (((minutes - anchorMinutes) % 1440) + 1440) % 1440;
  return (wrapped / 60) * hourHeight;
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

export default function KalenderPage() {
  const [today] = useState(() => new Date());
  const [visibleDate, setVisibleDate] = useState(() => new Date(today));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"next" | "previous">("next");
  const [animationKey, setAnimationKey] = useState(0);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationsLoading, setRegistrationsLoading] = useState(true);
  const [registrationsError, setRegistrationsError] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sleepDefaults, setSleepDefaults] = useState<SleepDefaults | null>(null);
  const [weekdaySchedules, setWeekdaySchedules] = useState<Record<number, SleepScheduleEntry>>({});
  const [workShifts, setWorkShifts] = useState<Record<string, WorkShiftEntry>>({});
  const [pendingSleepChange, setPendingSleepChange] = useState<{
    date: Date;
    type: SleepAdjustType;
    minutes: number;
  } | null>(null);
  const pointerStart = useRef<number | null>(null);
  const isLandscape = useIsLandscape();
  // Liggende visning bruges kun som en ekstra tidslinje-fremstilling af ugevisningen —
  // den må aldrig overstyre brugerens valgte visning eller det faste standardvalg (måned).
  const effectiveView: CalendarView = view;
  const showWeekTimeline = isLandscape && view === "week";

  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const monthCells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const weekDays = useMemo(() => {
    const monday = mondayOf(visibleDate);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [visibleDate]);

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
    Promise.all([
      fetch("/api/profile").then((response) => response.json()),
      fetch("/api/sleep-schedule").then((response) => response.json()),
      fetch("/api/work-shifts").then((response) => response.json()),
    ])
      .then(([profileData, scheduleData, shiftData]) => {
        if (cancelled) return;
        setSleepDefaults(profileData.user ?? null);
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

  function requestSleepAdjust(date: Date, type: SleepAdjustType, minutes: number) {
    setPendingSleepChange({ date, type, minutes });
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

  function applySleepChange(scope: "date" | "pattern") {
    if (!pendingSleepChange) return;
    const { date, type, minutes } = pendingSleepChange;
    const time = minutesToTime(minutes);

    if (scope === "date") {
      const iso = isoDate(date);
      const body = type === "bedtime" ? { bedtime: time } : { wakeTime: time };
      setWorkShifts((current) => ({
        ...current,
        [iso]: { ...(current[iso] ?? { date: iso, bedtime: null, wakeTime: null }), ...body },
      }));
      fetch(`/api/work-shifts/${iso}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => {});
    } else {
      const weekday = (date.getDay() + 6) % 7;
      const existing = weekdaySchedules[weekday];
      const bedtime = type === "bedtime" ? time : existing?.bedtime || sleepDefaults?.defaultBedtime || null;
      const wakeTime = type === "wake" ? time : existing?.wakeTime || sleepDefaults?.defaultWakeTime || null;
      setWeekdaySchedules((current) => ({
        ...current,
        [weekday]: { weekday, bedtime: bedtime ?? "", wakeTime: wakeTime ?? "" },
      }));
      fetch("/api/sleep-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekday, bedtime, wakeTime }),
      }).catch(() => {});
    }
    setPendingSleepChange(null);
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

  return (
    <HfScreen
      title="Kalender"
      icon={
        <div className="relative z-[100]">
          <button
            type="button"
            aria-label={`Skift kalendervisning. Aktuel visning: ${activeView.label}`}
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
            aria-label="Luk menu"
            className="fixed inset-0 z-20 cursor-default"
            onClick={() => {
              setMonthMenuOpen(false);
              setViewMenuOpen(false);
            }}
          />
        )}

        <div className="relative z-30 mb-4 flex items-center justify-between gap-2">
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
                {effectiveView === "week" || effectiveView === "list" ? weekLabel : monthLabel}
              </span>
            </button>
            {monthMenuOpen && (
              <MonthPicker year={year} month={month} onYearChange={setVisibleDate} onSelect={selectMonth} />
            )}
          </div>
          <PeriodButton direction="next" view={effectiveView} onClick={() => movePeriod(1)} />
        </div>

        <div
          className="touch-pan-y overflow-hidden"
          onPointerDown={(event) => {
            pointerStart.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (pointerStart.current !== null && Math.abs(event.clientX - pointerStart.current) > 48) {
              movePeriod(event.clientX < pointerStart.current ? 1 : -1);
            }
            pointerStart.current = null;
          }}
          onPointerCancel={() => {
            pointerStart.current = null;
          }}
        >
          <div
            key={`${effectiveView}-${year}-${month}-${animationKey}`}
            className={slideDirection === "next" ? "calendar-slide-next" : "calendar-slide-previous"}
          >
            {view === "month" && (
              <MonthView cells={monthCells} month={month} today={today} onOpenDate={openDate} />
            )}
            {view === "week" &&
              (showWeekTimeline ? (
                <WeekTimelineView
                  days={weekDays}
                  today={today}
                  registrations={registrations}
                  onOpenDate={openDate}
                  getSleepWindow={resolveSleepWindow}
                  onSleepAdjust={requestSleepAdjust}
                />
              ) : (
                <WeekView days={weekDays} today={today} dailyTotals={dailyTotals} onOpenDate={openDate} />
              ))}
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
          </div>
        </div>

        <MonthlyStatus status={monthlyStatus} />
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
          onEntryMoved={handleEntryMoved}
          onSleepAdjust={(type, minutes) => requestSleepAdjust(selectedDate, type, minutes)}
          onClose={() => setSelectedDate(null)}
          onNavigate={(direction) => setSelectedDate((current) => (current ? addDays(current, direction) : current))}
        />
      )}

      {pendingSleepChange && (
        <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-hf-tan-dark bg-hf-white p-4 text-hf-black shadow-xl">
            <p className="mb-3 text-sm">
              {pendingSleepChange.type === "bedtime" ? "Sengetid" : "Stå-op-tid"} sat til{" "}
              <span className="font-bold">{minutesToTime(pendingSleepChange.minutes)}</span>. Skal ændringen
              gælde kun denne dato, eller dit faste mønster?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applySleepChange("date")}
                className="min-h-11 flex-1 rounded-xl bg-hf-tan px-3 text-sm font-semibold text-hf-black"
              >
                Kun denne dato
              </button>
              <button
                type="button"
                onClick={() => applySleepChange("pattern")}
                className="min-h-11 flex-1 rounded-xl bg-hf-green px-3 text-sm font-semibold text-hf-white"
              >
                Standardmønster
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingSleepChange(null)}
              className="mt-2 min-h-9 w-full text-center text-xs font-semibold opacity-60"
            >
              Annuller
            </button>
          </div>
        </div>
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
  const Icon = direction === "previous" ? IconChevronLeft : IconChevronRight;
  const period = view === "week" || view === "list" ? "uge" : "måned";
  return (
    <button
      type="button"
      aria-label={`${direction === "previous" ? "Forrige" : "Næste"} ${period}`}
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
  return (
    <div className="absolute left-1/2 top-12 z-40 w-[310px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-3xl border border-hf-tan-dark bg-hf-white p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Forrige år" onClick={() => onYearChange(new Date(year - 1, month, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-hf-cream">
          <IconChevronLeft size={20} />
        </button>
        <span className="hf-heading">{year}</span>
        <button type="button" aria-label="Næste år" onClick={() => onYearChange(new Date(year + 1, month, 1))} className="flex size-10 items-center justify-center rounded-full hover:bg-hf-cream">
          <IconChevronRight size={20} />
        </button>
      </div>
      <div role="listbox" aria-label={`Vælg måned i ${year}`} className="grid grid-cols-3 gap-1.5">
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
  onOpenDate,
}: {
  cells: Array<Date | null>;
  month: number;
  today: Date;
  onOpenDate: (date: Date) => void;
}) {
  return (
    <>
      <div className="mb-2 grid grid-cols-7 text-center">
        {WEEKDAYS.map((day) => <span key={day} className="text-xs font-medium opacity-60">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, index) => {
          if (!date) return <div key={`empty-${index}`} />;
          const met = goalWasMet(date, today);
          const current = isSameDay(date, today);
          const isOtherMonth = date.getMonth() !== month;
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onOpenDate(date)}
              aria-label={`${date.toLocaleDateString("da-DK", { dateStyle: "long" })}${current ? ", i dag" : ""}${
                met ? ", mål nået" : ", mål ikke nået"
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
  return (
    <div className="space-y-2">
      {days.map((date) => {
        const kcal = totalKcalForDate(dailyTotals, date);
        const met = dailyGoalMet(dailyTotals, date);
        const diff = Math.round(Math.abs(DAILY_KCAL_GOAL - kcal));
        const current = isSameDay(date, today);
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onOpenDate(date)}
            className="flex min-h-[66px] w-full items-center gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 text-left text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
          >
            <span className="w-10 text-xs font-bold uppercase opacity-70">{date.toLocaleDateString("da-DK", { weekday: "short" })}</span>
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                current ? "border-hf-green bg-hf-green text-hf-white" : "border-hf-gray bg-hf-white text-hf-black"
              }`}
            >
              {date.getDate()}
            </span>
            {met ? (
              <IconCheck size={16} stroke={3} className="shrink-0 text-hf-lime" aria-hidden="true" />
            ) : (
              <IconMinus size={16} stroke={3} className="shrink-0 opacity-50" aria-hidden="true" />
            )}
            <span className="flex-1 text-sm font-semibold">{met ? "Mål nået" : "Mål ikke nået"}</span>
            <span className={`shrink-0 text-sm font-bold tabular-nums ${met ? "text-hf-green" : "text-hf-red-dark"}`}>
              {met ? "+" : "-"}
              {diff} kcal
            </span>
            <IconChevronRight size={19} className="shrink-0" />
          </button>
        );
      })}
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  const overscroll = useRef(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = 0;
    setOverflowing(node.scrollHeight > node.clientHeight + 1);
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
    <div className="relative">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => {
          touchStartY.current = null;
        }}
        className="no-scrollbar max-h-[min(60vh,420px)] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl bg-hf-white"
      >
        {days.map((date) => {
          const kcal = totalKcalForDate(dailyTotals, date);
          const met = dailyGoalMet(dailyTotals, date);
          const current = isSameDay(date, today);
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onOpenDate(date)}
              className="flex min-h-[58px] w-full shrink-0 snap-start items-center gap-3 border-b border-hf-tan px-4 text-left last:border-b-0 hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black"
            >
              <span className="w-16 shrink-0 truncate text-sm capitalize opacity-80">
                {date.toLocaleDateString("da-DK", { weekday: "long" })}
              </span>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
                  current ? "border-hf-green bg-hf-green text-hf-white" : "border-hf-gray bg-hf-white text-hf-black"
                }`}
              >
                {date.getDate()}
              </span>
              <span className="flex-1 truncate text-sm font-semibold">
                {met ? "Du nåede dit mål" : "Du overskred dit mål"}
              </span>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${met ? "text-hf-green" : "text-hf-black"}`}>
                {Math.round(kcal)} kcal
              </span>
              {met ? (
                <IconCheck size={18} stroke={2.5} className="shrink-0 text-hf-lime" aria-hidden="true" />
              ) : (
                <IconMinus size={18} stroke={2.5} className="shrink-0 opacity-50" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
      {overflowing && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-2xl bg-gradient-to-t from-hf-white to-transparent"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function WeekTimelineView({
  days,
  today,
  registrations,
  onOpenDate,
  getSleepWindow,
  onSleepAdjust,
}: {
  days: Date[];
  today: Date;
  registrations: Registration[];
  onOpenDate: (date: Date) => void;
  getSleepWindow: (date: Date) => SleepWindow | null;
  onSleepAdjust: (date: Date, type: SleepAdjustType, minutes: number) => void;
}) {
  const headerDrag = useRef<{ x: number; scrollLeft: number } | null>(null);
  const gridDrag = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

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
          const met = goalWasMet(date, today);
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

function SleepBands({ window }: { window: SleepWindow | null }) {
  if (!window) return null;
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 bg-hf-gray/15"
        style={{ height: (window.wakeTime / 60) * HOUR_HEIGHT }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-hf-gray/15"
        style={{ height: ((24 * 60 - window.bedtime) / 60) * HOUR_HEIGHT }}
        aria-hidden="true"
      />
    </>
  );
}

function SleepBoundaryHandle({
  minutes,
  type,
  onCommit,
}: {
  minutes: number;
  type: SleepAdjustType;
  onCommit: (type: SleepAdjustType, minutes: number) => void;
}) {
  const [dragMinutes, setDragMinutes] = useState<number | null>(null);
  const startYRef = useRef(0);
  const startMinutesRef = useRef(minutes);
  const dragMinutesRef = useRef<number | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    startYRef.current = event.clientY;
    startMinutesRef.current = minutes;
    dragMinutesRef.current = minutes;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragMinutes(minutes);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragMinutesRef.current === null) return;
    event.stopPropagation();
    const deltaY = event.clientY - startYRef.current;
    const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
    const next = startMinutesRef.current + deltaMinutes;
    dragMinutesRef.current = next;
    setDragMinutes(next);
  }

  function finishDrag() {
    if (dragMinutesRef.current !== null) {
      onCommit(type, dragMinutesRef.current);
    }
    dragMinutesRef.current = null;
    setDragMinutes(null);
  }

  const displayMinutes = dragMinutes ?? minutes;
  const top = (displayMinutes / 60) * HOUR_HEIGHT;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label={type === "bedtime" ? "Justér sengetid" : "Justér stå-op-tid"}
      className="absolute inset-x-0 z-10 flex touch-none items-center justify-center"
      style={{ top: top - 10, height: 20 }}
    >
      <div className={`h-[3px] w-8 rounded-full ${dragMinutes !== null ? "bg-hf-black" : "bg-hf-gray/70"}`} />
    </div>
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
  onSleepAdjust,
  onEntryMoved,
  onClose,
  onNavigate,
}: {
  date: Date;
  today: Date;
  registrations: Registration[];
  activities: Activity[];
  loading: boolean;
  error: boolean;
  sleepWindow: SleepWindow;
  onSleepAdjust: (type: SleepAdjustType, minutes: number) => void;
  onEntryMoved: (registrationId: string, newCreatedAt: Date) => void;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
}) {
  const router = useRouter();
  const met = goalWasMet(date, today);
  const canGoForward = stripTime(date) < stripTime(today);
  const pointerStart = useRef<number | null>(null);
  const [addBarHour, setAddBarHour] = useState<number | null>(null);
  const [openHour, setOpenHour] = useState<number | null>(null);
  const [hourHeight, setHourHeight] = useState(() => loadStoredHourHeight());
  const activeZoomPointers = useRef(new Map<number, number>());
  const zoomStart = useRef<{ avgY: number; hourHeight: number } | null>(null);
  const mouseDrag = useRef<{ y: number; scrollTop: number } | null>(null);

  const anchorHour = Math.floor(sleepWindow.wakeTime / 60);
  const anchorMinutes = anchorHour * 60;

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
        // localStorage utilgængelig — ignorér.
      }
    }
  }

  const timelineHeight = hourHeight * 24;
  const showMinuteLines = hourHeight >= HOUR_HEIGHT * 2;
  const minuteStep = hourHeight >= HOUR_HEIGHT * 3 ? 5 : 15;

  const dayKcal = registrations.reduce((sum, registration) => sum + registration.kcalSnapshot, 0);
  const remaining = DAILY_KCAL_GOAL - dayKcal;

  function goToAddFlow(hour: number) {
    const params = new URLSearchParams({
      date: isoDate(date),
      time: `${String(hour).padStart(2, "0")}:00`,
    });
    router.push(`/madvarer?${params.toString()}`);
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-hf-cream" role="dialog" aria-modal="true" aria-labelledby="day-title">
      <div
        className="relative flex items-center justify-between gap-1 bg-hf-green px-1 pb-4 text-hf-white"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <button
          type="button"
          onClick={() => onNavigate(-1)}
          aria-label="Forrige dag"
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <IconChevronLeft size={20} />
        </button>
        <h2 id="day-title" className="hf-heading flex min-w-0 items-center justify-center gap-1.5 text-base">
          <IconCalendar size={16} className="shrink-0" aria-hidden="true" />
          <span className="truncate first-letter:uppercase">
            {date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => canGoForward && onNavigate(1)}
            disabled={!canGoForward}
            aria-label="Næste dag"
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-30"
          >
            <IconChevronRight size={20} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tilbage"
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          >
            <IconArrowLeft size={22} />
          </button>
        </div>
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
        <div className={`mb-4 flex items-center gap-3 rounded-2xl p-4 ${met ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black"}`}>
          <div className={`flex size-10 items-center justify-center rounded-full ${met ? "bg-white/20" : "bg-hf-white"}`}>
            {met ? <IconCheck size={23} /> : <span className="size-2.5 rounded-full bg-hf-tan-dark" />}
          </div>
          <p className="font-bold">{met ? "Dagens mål blev nået" : "Dagens mål er ikke markeret"}</p>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <h3 className="hf-heading text-base">Registreringer</h3>
          {!loading && !error && registrations.length === 0 && (
            <span className="text-sm text-hf-gray">Ingen registreringer</span>
          )}
        </div>
        {loading ? (
          <div className="rounded-2xl bg-hf-white p-5 text-center text-sm opacity-60">
            Henter dagens registreringer…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-hf-white p-5 text-center">
            <p className="font-semibold text-hf-black">Registreringerne kunne ikke hentes</p>
            <p className="mt-1 text-sm text-hf-black opacity-60">Prøv igen, når forbindelsen til databasen er tilbage.</p>
          </div>
        ) : (
          <div
            className="no-scrollbar relative touch-pan-y overflow-y-auto rounded-2xl border border-hf-tan bg-hf-white"
            style={{ maxHeight: "calc(100vh - 380px)" }}
            onPointerDown={handleTimelinePointerDown}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerEnd}
            onPointerCancel={handleTimelinePointerEnd}
          >
            <div className="relative ml-12" style={{ height: timelineHeight }}>
              <div className="absolute -left-12 top-0 h-full w-12">
                {HOUR_MARKS.map((mark) => (
                  <span
                    key={mark}
                    className="absolute right-1.5 -translate-y-1/2 text-[10px] font-medium opacity-50"
                    style={{ top: mark * hourHeight }}
                  >
                    {String((anchorHour + mark) % 24).padStart(2, "0")}
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
              <SleepBlock sleepWindow={sleepWindow} anchorMinutes={anchorMinutes} hourHeight={hourHeight} onAdjust={onSleepAdjust} />
              {addBarHour !== null && (
                <button
                  type="button"
                  aria-label="Luk tilføj"
                  className="absolute inset-0 z-10"
                  onClick={() => setAddBarHour(null)}
                />
              )}
              {Array.from({ length: 24 }, (_, mark) => {
                const hour = (anchorHour + mark) % 24;
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
                    top={mark * hourHeight}
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
                    anchorMinutes={anchorMinutes}
                    onOpen={() => router.push(`/registrering/${registration.id}`)}
                    onMoved={(newCreatedAt) => onEntryMoved(registration.id, newCreatedAt)}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-col items-end gap-0.5 pr-1 text-right">
          <p className="text-sm text-hf-gray">Mål: {DAILY_KCAL_GOAL} kcal</p>
          {remaining >= 0 ? (
            <p className="text-sm font-semibold text-hf-black">Du har {Math.round(remaining)} kalorier endnu</p>
          ) : (
            <p className="text-sm font-semibold text-hf-red-dark">Du er overskredet med {Math.round(Math.abs(remaining))} kcal</p>
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

function SleepBlock({
  sleepWindow,
  anchorMinutes,
  hourHeight,
  onAdjust,
}: {
  sleepWindow: SleepWindow;
  anchorMinutes: number;
  hourHeight: number;
  onAdjust: (type: SleepAdjustType, minutes: number) => void;
}) {
  const [dragDelta, setDragDelta] = useState<number | null>(null);
  const startYRef = useRef(0);
  const dragDeltaRef = useRef<number | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    startYRef.current = event.clientY;
    dragDeltaRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragDelta(0);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragDeltaRef.current === null) return;
    event.stopPropagation();
    const deltaY = event.clientY - startYRef.current;
    const deltaMinutes = (deltaY / hourHeight) * 60;
    dragDeltaRef.current = deltaMinutes;
    setDragDelta(deltaMinutes);
  }

  function finishDrag() {
    if (dragDeltaRef.current !== null && Math.round(dragDeltaRef.current) !== 0) {
      const delta = dragDeltaRef.current;
      onAdjust("wake", sleepWindow.wakeTime + delta);
      onAdjust("bedtime", sleepWindow.bedtime + delta);
    }
    dragDeltaRef.current = null;
    setDragDelta(null);
  }

  const delta = dragDelta ?? 0;
  const top = Math.max(0, rotatedTop(sleepWindow.bedtime, anchorMinutes, hourHeight) + delta);
  const height = Math.max(0, hourHeight * 24 - top);
  const handleTop = top + height / 2;

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-hf-gray/15"
        style={{ top, height }}
        aria-hidden="true"
      />
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        aria-label="Justér nattesøvn"
        className="absolute inset-x-0 z-10 flex touch-none items-center justify-center"
        style={{ top: handleTop - 12, height: 24 }}
      >
        <div className={`h-[3px] w-10 rounded-full ${dragDelta !== null ? "bg-hf-black" : "bg-hf-gray-dark/60"}`} />
      </div>
    </>
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
      className="absolute inset-x-0"
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
          Tilføj
        </button>
      )}
    </div>
  );
}

// En enkelt registrering vist direkte på tidslinjen, kun når to-finger-zoom
// har afsløret minut-linjer (ellers ville alle dagens registreringer oversvømme
// den kompakte 40px-høje visning). Kort tryk åbner registreringen; ½ sek. hold
// går i "flyt"-tilstand (viser klokkeslæt+navn), og lodret træk derefter
// justerer tidspunktet (5-min snap) indtil slip, som gemmer via
// PATCH /api/registrations/[id].
function DraggableEntryMarker({
  registration,
  hourHeight,
  anchorMinutes,
  onOpen,
  onMoved,
}: {
  registration: Registration;
  hourHeight: number;
  anchorMinutes: number;
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
  const top = rotatedTop(displayMinutes, anchorMinutes, hourHeight);

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

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-hf-cream" role="dialog" aria-modal="true">
      <div
        className="relative flex items-center justify-center bg-hf-green px-4 pb-4 text-hf-white"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tilbage"
          className="absolute bottom-3 left-3 flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          <IconArrowLeft size={24} />
        </button>
        <h2 className="hf-heading text-lg">
          Kl. {String(hour).padStart(2, "0")}–{String((hour + 1) % 24).padStart(2, "0")}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="my-3 flex items-center gap-2 text-xs font-semibold text-hf-gray">
              <span className="h-px flex-1 bg-hf-tan-dark" aria-hidden="true" />
              <span>{new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(group.time)}</span>
              <span className="h-px flex-1 bg-hf-tan-dark" aria-hidden="true" />
            </div>
            {group.items.map((registration) => (
              <Link
                key={registration.id}
                href={`/registrering/${registration.id}`}
                className="mb-2 flex items-center justify-between rounded-2xl bg-hf-white p-3 focus-visible:outline-2 focus-visible:outline-hf-black"
              >
                <span className="truncate text-sm text-hf-black">{registration.titleSnapshot}</span>
                <span className="ml-2 shrink-0 text-sm font-bold text-hf-black">
                  {Math.round(registration.kcalSnapshot)} kcal
                </span>
              </Link>
            ))}
          </div>
        ))}
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
  const { remaining, streak } = status;
  const withinGoal = remaining >= 0;

  return (
    <div className="mt-5 space-y-1.5 text-center">
      {streak >= 5 && (
        <div className="mb-3 flex flex-col items-center gap-1">
          <span className="relative flex size-9 items-center justify-center" aria-label={`${streak} dages stribe i træk`}>
            <IconStarFilled size={36} className="text-hf-green" aria-hidden="true" />
            <span className="absolute text-xs font-bold text-hf-white">{streak}</span>
          </span>
          <p className="text-sm font-semibold text-hf-black">Flot! {streak} dage i træk har du nået dit mål!</p>
        </div>
      )}

      <div className="flex items-start justify-center gap-2 text-left">
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
          {withinGoal ? "Du er inden for din målsætning." : "Du er ikke inden for din målsætning."}
        </p>
      </div>
    </div>
  );
}
