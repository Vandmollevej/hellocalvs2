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
  IconX,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";

const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("da-DK", { month: "long" }).format(new Date(2026, month, 1)),
);

type CalendarView = "month" | "week" | "list";

type Registration = {
  id: string;
  titleSnapshot: string;
  kcalSnapshot: number;
  createdAt: string;
};

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

function buildMonthGrid(year: number, month: number) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = Array(offset).fill(null);
  for (let day = 1; day <= count; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7) cells.push(null);
  return cells;
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
  const pointerStart = useRef<number | null>(null);

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
  const ActiveViewIcon = activeView.icon;

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

  function movePeriod(direction: -1 | 1) {
    setSlideDirection(direction === 1 ? "next" : "previous");
    setAnimationKey((key) => key + 1);
    setVisibleDate((current) =>
      view === "week"
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
      headerRight={
        <div className="relative">
          <button
            type="button"
            aria-label={`Skift kalendervisning. Aktuel visning: ${activeView.label}`}
            aria-expanded={viewMenuOpen}
            onClick={() => {
              setViewMenuOpen((open) => !open);
              setMonthMenuOpen(false);
            }}
            className="flex size-11 items-center justify-center rounded-full text-hf-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          >
            <ActiveViewIcon size={25} stroke={1.8} />
          </button>
          {viewMenuOpen && (
            <div className="absolute right-0 top-12 z-40 w-44 overflow-hidden rounded-2xl border border-hf-tan-dark bg-hf-white p-1.5 text-hf-black shadow-xl">
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
          <PeriodButton direction="previous" view={view} onClick={() => movePeriod(-1)} />
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
                {view === "week" ? weekLabel : monthLabel}
              </span>
              <IconChevronDown size={18} className={monthMenuOpen ? "rotate-180" : ""} />
            </button>
            {monthMenuOpen && (
              <MonthPicker year={year} month={month} onYearChange={setVisibleDate} onSelect={selectMonth} />
            )}
          </div>
          <PeriodButton direction="next" view={view} onClick={() => movePeriod(1)} />
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
            key={`${view}-${year}-${month}-${animationKey}`}
            className={slideDirection === "next" ? "calendar-slide-next" : "calendar-slide-previous"}
          >
            {view === "month" && (
              <MonthView cells={monthCells} today={today} onOpenDate={openDate} />
            )}
            {view === "week" && <WeekView days={weekDays} today={today} onOpenDate={openDate} />}
            {view === "list" && (
              <ListView year={year} month={month} today={today} onOpenDate={openDate} />
            )}
          </div>
        </div>
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
          onClose={() => setSelectedDate(null)}
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
  const Icon = direction === "previous" ? IconChevronLeft : IconChevronRight;
  const period = view === "week" ? "uge" : "måned";
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

function MonthView({ cells, today, onOpenDate }: { cells: Array<Date | null>; today: Date; onOpenDate: (date: Date) => void }) {
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
          return (
            <button
              key={date.toISOString()}
              type="button"
              onClick={() => onOpenDate(date)}
              aria-label={`${date.toLocaleDateString("da-DK", { dateStyle: "long" })}${current ? ", i dag" : ""}${met ? ", mål nået" : ""}`}
              className={`relative flex aspect-square items-center justify-center rounded-lg border text-sm font-medium focus-visible:outline-2 focus-visible:outline-hf-black ${
                current
                  ? "border-hf-green bg-hf-green text-hf-white"
                  : met
                    ? "border-hf-green bg-hf-tan text-hf-black"
                    : "border-transparent bg-hf-tan text-hf-black"
              }`}
            >
              {date.getDate()}
              {met && <IconCheck size={13} stroke={3} className="absolute right-1 top-1 text-hf-green-light" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <Legend />
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
      <Legend />
    </div>
  );
}

function ListView({ year, month, today, onOpenDate }: { year: number; month: number; today: Date; onOpenDate: (date: Date) => void }) {
  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, index) => new Date(year, month, index + 1));
  return (
    <div className="overflow-hidden rounded-2xl bg-hf-white">
      {days.map((date) => {
        const met = goalWasMet(date, today);
        const current = isSameDay(date, today);
        return (
          <button key={date.toISOString()} type="button" onClick={() => onOpenDate(date)} className="flex min-h-[58px] w-full items-center gap-3 border-b border-hf-tan px-4 text-left last:border-b-0 hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black">
            <span className={`relative flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${
              current
                ? "border-hf-green bg-hf-green text-hf-white"
                : met
                  ? "border-hf-green bg-hf-white text-hf-black"
                  : "border-transparent bg-hf-tan text-hf-black"
            }`}>
              {date.getDate()}
              {met && <IconCheck size={11} stroke={3} className="absolute right-0.5 top-0.5 text-hf-green-light" aria-hidden="true" />}
            </span>
            <span className="flex-1 text-sm capitalize">{date.toLocaleDateString("da-DK", { weekday: "long" })}</span>
            {met && <span className="text-xs font-semibold text-hf-green">Mål nået</span>}
            <IconChevronRight size={18} className="opacity-50" />
          </button>
        );
      })}
    </div>
  );
}

function DayDetails({
  date,
  today,
  registrations,
  loading,
  error,
  onClose,
}: {
  date: Date;
  today: Date;
  registrations: Registration[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
}) {
  const met = goalWasMet(date, today);
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-hf-cream" role="dialog" aria-modal="true" aria-labelledby="day-title">
      <div className="relative flex items-center justify-center bg-hf-green px-4 pb-4 pt-9 text-hf-white">
        <button type="button" onClick={onClose} aria-label="Luk dagsvisning" className="absolute bottom-3 right-3 flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
          <IconX size={25} />
        </button>
        <h2 id="day-title" className="hf-heading text-lg capitalize">{date.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
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
        ) : registrations.length > 0 ? (
          <div className="overflow-hidden rounded-2xl bg-hf-white">
            {registrations.map((registration) => (
              <DayEntry key={registration.id} registration={registration} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-hf-white p-5 text-center">
            <p className="font-semibold text-hf-black">Ingen registreringer denne dag</p>
            <p className="mt-1 text-sm text-hf-black opacity-60">Dagens registreringer vises her, når de er tilføjet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DayEntry({ registration }: { registration: Registration }) {
  return (
    <Link href={`/registrering/${registration.id}`} className="flex min-h-[66px] w-full items-center gap-3 border-b border-hf-tan px-4 text-left last:border-b-0 hover:bg-hf-cream focus-visible:outline-2 focus-visible:outline-hf-black">
      <span className="w-11 text-xs font-semibold opacity-55">
        {new Intl.DateTimeFormat("da-DK", { hour: "2-digit", minute: "2-digit" }).format(
          new Date(registration.createdAt),
        )}
      </span>
      <span className="flex-1 font-semibold">{registration.titleSnapshot}</span>
      <span className="text-sm opacity-65">{Math.round(registration.kcalSnapshot)} kcal</span>
      <IconChevronRight size={18} className="opacity-45" />
    </Link>
  );
}

function Legend() {
  return (
    <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs opacity-60">
      <span className="relative size-5 rounded border border-hf-green bg-hf-tan">
        <IconCheck size={11} stroke={3} className="absolute right-0.5 top-0.5 text-hf-green-light" aria-hidden="true" />
      </span>
      Grøn ramme og flueben = dagens mål blev nået
    </p>
  );
}
