"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { SleepRangeSlider } from "@/components/hf/SleepRangeSlider";
import { useTranslation } from "@/i18n/LocaleProvider";

type SleepUser = {
  defaultBedtime: string | null;
  defaultWakeTime: string | null;
  shiftWorkEnabled: boolean;
};

type SleepSchedule = {
  weekday: number;
  bedtime: string;
  wakeTime: string;
};

// Lægger (evt. negative) minutter til et "HH:MM"-tidspunkt, med wrap over midnat.
function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440;
  const nextHours = Math.floor(total / 60);
  const nextMinutes = Math.round(total % 60);
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

const timeInputClass =
  "hf-type-body rounded-xl bg-hf-tan px-4 py-3 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

function timeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const [hours, mins] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null;
  return hours * 60 + mins;
}

function minutesToTime(minutes: number) {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="hf-type-small hf-type-strong text-text-secondary uppercase tracking-[0.06em]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function SleepSchedulePage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<SleepUser | null>(null);
  const [schedules, setSchedules] = useState<Record<number, SleepSchedule>>({});
  const [loading, setLoading] = useState(true);
  const [perDayOpen, setPerDayOpen] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekdaySaveTimeouts = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/profile").then((res) => res.json()),
      fetch("/api/sleep-schedule").then((res) => res.json()),
    ])
      .then(([profileData, scheduleData]) => {
        if (cancelled) return;
        setUser(profileData.user);
        const byWeekday: Record<number, SleepSchedule> = {};
        for (const schedule of scheduleData.schedules as SleepSchedule[]) {
          byWeekday[schedule.weekday] = schedule;
        }
        setSchedules(byWeekday);
        if (Object.keys(byWeekday).length > 0) setPerDayOpen(true);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Tager et helt patch-objekt (ikke kun ét felt ad gangen), så to felter der
  // ændres i samme handling (fx stå-op-tid + den auto-udregnede sengetid)
  // rent faktisk begge bliver gemt — den delte debounce-timer nedenfor ville
  // ellers lade det andet kald annullere det første kalds PATCH, før den når
  // at blive sendt.
  function updateDefaults(patch: Partial<SleepUser>) {
    setUser((current) => (current ? { ...current, ...patch } : current));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
    }, 500);
  }

  function updateDefault<K extends keyof SleepUser>(key: K, value: SleepUser[K]) {
    updateDefaults({ [key]: value } as Partial<SleepUser>);
  }

  function toggleShiftWork(enabled: boolean) {
    setUser((current) => (current ? { ...current, shiftWorkEnabled: enabled } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shiftWorkEnabled: enabled }),
    }).catch(() => {});
  }

  function saveWeekday(weekday: number, bedtime: string, wakeTime: string) {
    const existingTimeout = weekdaySaveTimeouts.current[weekday];
    if (existingTimeout) clearTimeout(existingTimeout);
    weekdaySaveTimeouts.current[weekday] = setTimeout(() => {
      fetch("/api/sleep-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekday,
          bedtime: bedtime || null,
          wakeTime: wakeTime || null,
        }),
      }).catch(() => {});
    }, 500);
  }

  // Når Mandag udfyldes, kopieres værdien automatisk til Tirsdag-Fredag
  // (de øvrige hverdage), men kun for felter der stadig er tomme — brugeren
  // kan altid redigere de udfyldte dage bagefter.
  function updateWeekday(weekday: number, field: "bedtime" | "wakeTime", value: string) {
    setSchedules((current) => {
      const existing = current[weekday] ?? { weekday, bedtime: "", wakeTime: "" };
      const next = { ...existing, [field]: value };
      saveWeekday(weekday, next.bedtime, next.wakeTime);
      const updated = { ...current, [weekday]: next };

      if (weekday === 0 && value) {
        for (const otherWeekday of [1, 2, 3, 4]) {
          const otherExisting = current[otherWeekday];
          if (otherExisting?.[field]) continue; // udfyldt af brugeren allerede — rør ikke
          const otherNext = {
            ...(otherExisting ?? { weekday: otherWeekday, bedtime: "", wakeTime: "" }),
            [field]: value,
          };
          updated[otherWeekday] = otherNext;
          saveWeekday(otherWeekday, otherNext.bedtime, otherNext.wakeTime);
        }
      }

      return updated;
    });
  }

  return (
    <HfScreen
      title={t("profileSleep.title")}
    >
      {loading || !user ? (
        <p className="hf-type-body text-text-secondary p-4 text-center">
          {loading ? t("profileSleep.loading") : t("profileSleep.loadError")}
        </p>
      ) : (
        <div className="hf-page">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("profileSleep.defaultWakeTime")}>
              <input
                type="time"
                className={timeInputClass}
                value={user.defaultWakeTime ?? ""}
                onChange={(event) => {
                  const wakeTime = event.target.value || null;
                  // Udregn automatisk 7,5 timers søvn, hvis sengetid endnu ikke er sat.
                  if (wakeTime && !user.defaultBedtime) {
                    updateDefault("defaultBedtime", addMinutes(wakeTime, -7.5 * 60));
                  }
                  updateDefault("defaultWakeTime", wakeTime);
                }}
              />
            </Field>
            <Field label={t("profileSleep.defaultBedtime")}>
              <input
                type="time"
                className={timeInputClass}
                value={user.defaultBedtime ?? ""}
                onChange={(event) => {
                  const bedtime = event.target.value || null;
                  if (bedtime && !user.defaultWakeTime) {
                    updateDefault("defaultWakeTime", addMinutes(bedtime, 7.5 * 60));
                  }
                  updateDefault("defaultBedtime", bedtime);
                }}
              />
            </Field>
          </div>
          <p className="hf-type-small text-text-secondary -mt-2">
            {t("profileSleep.defaultTimesHint")}
          </p>

          <button
            type="button"
            onClick={() => setPerDayOpen((open) => !open)}
            className="flex w-full items-center gap-2 rounded-2xl bg-hf-tan px-4 py-3 text-left"
          >
            <span className="hf-type-body hf-type-strong flex-1 text-hf-black">
              {t("profileSleep.perDayToggle")}
            </span>
            <IconChevronDown size={18} className={perDayOpen ? "rotate-180" : ""} />
          </button>

          {perDayOpen && (
            <div className="hf-card hf-card--form">
              <p className="hf-type-small text-text-secondary">
                {t("profileSleep.perDayHint")}
              </p>
              {[0, 1, 2, 3, 4, 5, 6].map((weekday) => {
                const label = t(`profileSleep.weekdays.${weekday}`);
                const schedule = schedules[weekday];
                // Ikke-udfyldte dage viser den generelle standard som
                // udgangspunkt (nemt at finjustere derfra), men gemmer først
                // en dags-specifik afvigelse, når brugeren rent faktisk
                // rører netop den dags slider.
                const wakeMinutes =
                  timeToMinutes(schedule?.wakeTime) ?? timeToMinutes(user.defaultWakeTime) ?? 7 * 60;
                const bedtimeMinutes =
                  timeToMinutes(schedule?.bedtime) ?? timeToMinutes(user.defaultBedtime) ?? 23 * 60;
                return (
                  <div key={label} className="flex flex-col gap-2">
                    <span className="hf-type-small hf-type-strong text-hf-black">{label}</span>
                    <SleepRangeSlider
                      wakeMinutes={wakeMinutes}
                      bedtimeMinutes={bedtimeMinutes}
                      onChangeWake={(value) => updateWeekday(weekday, "wakeTime", minutesToTime(value))}
                      onChangeBedtime={(value) => updateWeekday(weekday, "bedtime", minutesToTime(value))}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <Toggle
            label={t("profileSleep.shiftWork")}
            description={t("profileSleep.shiftWorkDescription")}
            checked={user.shiftWorkEnabled}
            onChange={toggleShiftWork}
          />

          {user.shiftWorkEnabled && (
            <p className="hf-type-small text-text-secondary">
              {t("profileSleep.shiftWorkHint")}
            </p>
          )}
        </div>
      )}
    </HfScreen>
  );
}
