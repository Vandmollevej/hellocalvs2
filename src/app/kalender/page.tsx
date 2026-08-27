"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  IconCalendarMonth,
  IconCalendarWeek,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconLayoutList,
  IconMinus,
  IconStarFilled,
  IconX,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { DAILY_KCAL_GOAL } from "@/lib/goals";
import { groupByDay } from "@/lib/daily-totals";

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

const HOUR_HEIGHT = 56;
const TIMELINE_HEIGHT = HOUR_HEIGHT * 24;
const HOUR_MARKS = Array.from({ length: 25 }, (_, hour) => hour);
const SLEEP_ADJUST_HOLD_MS = 500;
const SLEEP_ADJUST_MOVE_TOLERANCE = 10;

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

function getSleepWindow(
  date: Date,
  defaults: SleepDefaults | null,
  weekdaySchedules: Record<number, SleepScheduleEntry>,
  workShifts: Record<string, WorkShiftEntry>,
): SleepWindow | null {
  const weekday = (date.getDay() + 6) % 7;
  const override = workShifts[isoDate(date)];
  const perDay = weekdaySchedules[weekday];
  const bedtime = timeToMinutes(override?.bedtime || perDay?.bedtime || defaults?.defaultBedtime);
  const wakeTime = timeToMinutes(override?.wakeTime || perDay?.wakeTime || defaults?.defaultWakeTime);
  if (bedtime === null && wakeTime === null) return null;
  return { bedtime: bedtime ?? 23 * 60, wakeTime: wakeTime ?? 7 * 60 };
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
  const effectiveView: CalendarView = isLandscape ? "week" : view;

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
        <div className="relative z-30">
          <button
            type="button"
            aria-label={`Skift kalendervisning. Aktuel visning: ${activeView.label}`}
            aria-haspopup="listbox"
            aria-expanded={viewMenuOpen}
            disabled={isLandscape}
            onClick={() => {
              setViewMenuOpen((open) => !open);
              setMonthMenuOpen(false);
            }}
            className="flex flex-col items-center gap-0.5 rounded-lg focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50"
          >
            <IconCalendarMonth size={20} stroke={2} />
            <IconChevronDown size={12} stroke={2.5} className={viewMenuOpen ? "rotate-180" : ""} />
          </button>
          {viewMenuOpen && !isLandscape && (
            <div className="absolute left-0 top-full z-40 mt-2 w-44 overflow-hidden rounded-2xl border border-hf-tan-dark bg-hf-white p-1.5 text-hf-black shadow-xl">
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
            className="fixed inset-0 z-30 cursor-default"
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
              className="flex min-h-11 max-w-full items-center justify-center gap-1.5 rounded-full px-3 text-hf-black hover:bg-hf-tan focus-visible:outline-2 focus-visible:outline-hf-black"
            >
              <span className="hf-heading truncate text-[15px] capitalize">
                {effectiveView === "week" || effectiveView === "list" ? weekLabel : monthLabel}
              </span>
              <IconChevronDown size={18} className={monthMenuOpen ? "rotate-180" : ""} />
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
            {isLandscape ? (
              <WeekTimelineView
                days={weekDays}
                today={today}
                registrations={registrations}
                onOpenDate={openDate}
                getSleepWindow={resolveSleepWindow}
                onSleepAdjust={requestSleepAdjust}
              />
            ) : (
              <>
                {view === "month" && (
                  <MonthView cells={monthCells} month={month} today={today} onOpenDate={openDate} />
                )}
                {view === "week" && <WeekView days={weekDays} today={today} onOpenDate={openDate} />}
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
              </>
            )}
          </div>
        </div>

        {!isLandscape && <MonthlyStatus status={monthlyStatus} />}
      </div>

      {selectedDate && (
        <DayDetails
          date={selectedDate}
          today={today}
          registrations={registrations.filter((registration) =>
            isSameDay(new Date(registration.createdAt), selectedDate),
          )}
          loading={registrationsLoading}
          error={registrationsError}
          sleepWindow={resolveSleepWindow(selectedDate)}
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
          const isPast = date < today && !current;
          const faded = isOtherMonth && isPast;
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
                  : `border-transparent bg-hf-tan ${faded ? "text-hf-gray" : "text-hf-black"}`
              }`}
            >
              {date.getDate()}
              {!current &&
                (met ? (
                  <IconCheck size={13} stroke={3} className="absolute right-1 top-1 text-hf-green" aria-hidden="true" />
                ) : (
                  <IconMinus size={13} stroke={3} className="absolute right-1 top-1 text-hf-red-dark" aria-hidden="true" />
                ))}
            </button>
          );
        })}
      </div>
    </>
  );
}

function WeekView({ days, today, onOpenDate }: { days: Date[]; today: Date; onOpenDate: (date: Date) => void }) {
  return (
    <div className="space-y-2">
      {days.map((date) => {
        const met = goalWasMet(date, today);
        const current = isSameDay(date, today);
        return (
          <button
            key={date.toISOString()}
            type="button"
            onClick={() => onOpenDate(date)}
            className={`relative flex min-h-[66px] w-full items-center gap-3 rounded-2xl border px-4 text-left focus-visible:outline-2 focus-visible:outline-hf-black ${
              current
                ? "border-hf-green bg-hf-green text-hf-white"
                : met
                  ? "border-hf-green bg-hf-tan text-hf-black"
                  : "border-transparent bg-hf-tan text-hf-black"
            }`}
          >
            <span className="w-10 text-xs font-bold uppercase opacity-70">{date.toLocaleDateString("da-DK", { weekday: "short" })}</span>
            <span className="hf-heading w-8 text-xl">{date.getDate()}</span>
            <span className="flex-1 text-sm font-semibold">{met ? "Dagens mål nået" : "Se dagen"}</span>
            <IconChevronRight size={19} />
            {met && <IconCheck size={14} stroke={3} className="absolute right-2 top-2 text-hf-green-light" aria-hidden="true" />}
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
        className="max-h-[min(60vh,420px)] snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl bg-hf-white"
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
                <IconCheck size={18} stroke={2.5} className="shrink-0 text-hf-green" aria-hidden="true" />
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
  return (
    <div className="overflow-hidden rounded-2xl border border-hf-tan bg-hf-white">
      <div className="flex overflow-x-auto">
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
              <span className="hf-heading flex items-center gap-1 text-sm">
                {date.getDate()}
                {met && <IconCheck size={11} stroke={3} aria-hidden="true" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 260px)" }}>
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
  const activatedRef = useRef(false);
  const movedRef = useRef(false);
  const startYRef = useRef(0);
  const startMinutesRef = useRef(minutes);
  const dragMinutesRef = useRef<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    startYRef.current = event.clientY;
    startMinutesRef.current = minutes;
    movedRef.current = false;
    activatedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    longPressTimer.current = setTimeout(() => {
      if (!movedRef.current) {
        activatedRef.current = true;
        dragMinutesRef.current = minutes;
        setDragMinutes(minutes);
      }
    }, SLEEP_ADJUST_HOLD_MS);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const deltaY = event.clientY - startYRef.current;
    if (!activatedRef.current) {
      if (Math.abs(deltaY) > SLEEP_ADJUST_MOVE_TOLERANCE) {
        movedRef.current = true;
        clearTimer();
      }
      return;
    }
    event.stopPropagation();
    const deltaMinutes = (deltaY / HOUR_HEIGHT) * 60;
    const next = startMinutesRef.current + deltaMinutes;
    dragMinutesRef.current = next;
    setDragMinutes(next);
  }

  function finishDrag() {
    clearTimer();
    if (activatedRef.current && dragMinutesRef.current !== null) {
      onCommit(type, dragMinutesRef.current);
    }
    activatedRef.current = false;
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
  loading,
  error,
  sleepWindow,
  onSleepAdjust,
  onClose,
  onNavigate,
}: {
  date: Date;
  today: Date;
  registrations: Registration[];
  loading: boolean;
  error: boolean;
  sleepWindow: SleepWindow | null;
  onSleepAdjust: (type: SleepAdjustType, minutes: number) => void;
  onClose: () => void;
  onNavigate: (direction: -1 | 1) => void;
}) {
  const met = goalWasMet(date, today);
  const canGoForward = stripTime(date) < stripTime(today);
  const pointerStart = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    timelineRef.current?.scrollTo({ top: Math.max(0, 6 * HOUR_HEIGHT - 40) });
  }, [date]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-hf-cream" role="dialog" aria-modal="true" aria-labelledby="day-title">
      <div className="relative flex items-center justify-center bg-hf-green px-4 pb-4 pt-9 text-hf-white">
        <button type="button" onClick={onClose} aria-label="Luk dagsvisning" className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
          <IconX size={25} />
        </button>
        <h2 id="day-title" className="hf-heading text-lg capitalize">{date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}</h2>
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
          <div>
            <p className="font-bold">{met ? "Dagens mål blev nået" : "Dagens mål er ikke markeret"}</p>
            <p className="text-sm opacity-75">{met ? "Flot balance i dagens registreringer" : "Du kan stadig åbne og se dagens detaljer"}</p>
          </div>
        </div>

        <h3 className="hf-heading mb-2 text-base">Registreringer</h3>
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
            ref={timelineRef}
            className="relative overflow-y-auto rounded-2xl border border-hf-tan bg-hf-white"
            style={{ maxHeight: "calc(100vh - 320px)" }}
          >
            <div className="relative ml-12" style={{ height: TIMELINE_HEIGHT }}>
              <div className="absolute -left-12 top-0 h-full w-12">
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
              <SleepBands window={sleepWindow} />
              {HOUR_MARKS.map((hour) => (
                <div key={hour} className="absolute left-0 right-0 border-t border-hf-tan/60" style={{ top: hour * HOUR_HEIGHT }} />
              ))}
              {sleepWindow && (
                <>
                  <SleepBoundaryHandle minutes={sleepWindow.wakeTime} type="wake" onCommit={onSleepAdjust} />
                  <SleepBoundaryHandle minutes={sleepWindow.bedtime} type="bedtime" onCommit={onSleepAdjust} />
                </>
              )}
              {registrations.map((registration) => {
                const time = new Date(registration.createdAt);
                return (
                  <Link
                    key={registration.id}
                    href={`/registrering/${registration.id}`}
                    className="absolute left-1 right-1 flex items-center gap-2 truncate rounded-lg bg-hf-green px-2 text-xs font-semibold text-hf-white focus-visible:outline-2 focus-visible:outline-hf-black"
                    style={{ top: (minutesFromMidnight(time) / 60) * HOUR_HEIGHT, minHeight: 26 }}
                  >
                    <span className="shrink-0 opacity-80">
                      {new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(time)}
                    </span>
                    <span className="flex-1 truncate">{registration.titleSnapshot}</span>
                    <span className="shrink-0 opacity-80">{Math.round(registration.kcalSnapshot)} kcal</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {!loading && !error && registrations.length === 0 && (
          <div className="mt-3 rounded-2xl bg-hf-white p-5 text-center">
            <p className="font-semibold text-hf-black">Ingen registreringer denne dag</p>
            <p className="mt-1 text-sm text-hf-black opacity-60">Dagens registreringer vises her, når de er tilføjet.</p>
          </div>
        )}
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
  const { isCurrentMonth, consideredDays, metCount, remaining, sevenDayRemaining, streak } = status;
  const withinGoal = remaining >= 0;
  const goalDaysText = isCurrentMonth
    ? `${metCount} ud af ${consideredDays} dage har du opnået din målsætning.`
    : `${metCount} ud af ${consideredDays} dage opnåede du din målsætning.`;

  return (
    <div className="mt-5 space-y-1.5 text-center">
      {streak >= 5 && (
        <div className="mb-2 flex justify-center">
          <span className="relative flex size-9 items-center justify-center" aria-label={`${streak} dages stribe i træk`}>
            <IconStarFilled size={36} className="text-hf-green" aria-hidden="true" />
            <span className="absolute text-xs font-bold text-hf-white">{streak}</span>
          </span>
        </div>
      )}

      <p className="flex items-center justify-center gap-2 text-lg">
        {withinGoal ? (
          <IconCheck size={22} stroke={2.5} className="shrink-0 text-hf-green" aria-hidden="true" />
        ) : (
          <IconMinus size={22} stroke={2.5} className="shrink-0 text-hf-red-dark" aria-hidden="true" />
        )}
        <span className="text-hf-gray-dark">
          {withinGoal ? "Du er inden for din målsætning. Du har " : "Du er ikke inden for din målsætning. Du har overskredet med "}
          <span className="font-bold text-hf-black">{Math.round(Math.abs(remaining))}</span>
          {withinGoal ? " kalorier til gode." : " kalorier."}
        </span>
      </p>

      <p className="text-sm text-hf-gray">
        Over de sidste syv dage er du {sevenDayRemaining >= 0 ? "under" : "over"} din målsætning.
      </p>

      <p className="text-sm text-hf-gray">{goalDaysText}</p>
    </div>
  );
}
