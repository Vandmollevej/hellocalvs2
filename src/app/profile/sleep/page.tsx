"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

type SleepUser = {
  defaultBedtime: string | null;
  defaultWakeTime: string | null;
  shiftWorkEnabled: boolean;
  workHoursInCalendarEnabled: boolean;
};

type SleepSchedule = {
  weekday: number;
  bedtime: string;
  wakeTime: string;
};

const timeInputClass =
  "rounded-xl bg-hf-tan px-4 py-3 text-[15px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
        {label}
      </span>
      {children}
    </label>
  );
}

export default function SleepSchedulePage() {
  const { t } = useTranslation();
  const router = useRouter();
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

  function updateDefault<K extends keyof SleepUser>(key: K, value: SleepUser[K]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }).catch(() => {});
    }, 500);
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
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title={t("profileSleep.title")} onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("profileSleep.loading") : t("profileSleep.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("profileSleep.defaultBedtime")}>
              <input
                type="time"
                className={timeInputClass}
                value={user.defaultBedtime ?? ""}
                onChange={(event) => updateDefault("defaultBedtime", event.target.value || null)}
              />
            </Field>
            <Field label={t("profileSleep.defaultWakeTime")}>
              <input
                type="time"
                className={timeInputClass}
                value={user.defaultWakeTime ?? ""}
                onChange={(event) => updateDefault("defaultWakeTime", event.target.value || null)}
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setPerDayOpen((open) => !open)}
            className="flex w-full items-center gap-2 rounded-2xl bg-hf-tan px-4 py-3 text-left"
          >
            <span className="flex-1 text-[15px] font-medium text-hf-black">
              {t("profileSleep.perDayToggle")}
            </span>
            <IconChevronDown size={18} className={perDayOpen ? "rotate-180" : ""} />
          </button>

          {perDayOpen && (
            <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
              <p className="text-[12px] text-hf-black opacity-60">
                {t("profileSleep.perDayHint")}
              </p>
              {[0, 1, 2, 3, 4, 5, 6].map((weekday) => {
                const label = t(`profileSleep.weekdays.${weekday}`);
                const schedule = schedules[weekday];
                return (
                  <div key={label} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
                    <span className="text-[13px] font-semibold text-hf-black">{label}</span>
                    <input
                      type="time"
                      aria-label={t("profileSleep.bedtimeAria", { day: label })}
                      className="rounded-xl bg-hf-cream px-3 py-2 text-[14px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
                      value={schedule?.bedtime ?? ""}
                      onChange={(event) => updateWeekday(weekday, "bedtime", event.target.value)}
                    />
                    <input
                      type="time"
                      aria-label={t("profileSleep.wakeTimeAria", { day: label })}
                      className="rounded-xl bg-hf-cream px-3 py-2 text-[14px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
                      value={schedule?.wakeTime ?? ""}
                      onChange={(event) => updateWeekday(weekday, "wakeTime", event.target.value)}
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
            <p className="text-[13px] text-hf-black opacity-70">
              {t("profileSleep.shiftWorkHint")}
            </p>
          )}

          <Toggle
            label={t("profileSleep.workHours")}
            description={t("profileSleep.workHoursDescription")}
            checked={user.workHoursInCalendarEnabled}
            onChange={(value) => updateDefault("workHoursInCalendarEnabled", value)}
          />
        </div>
      )}
    </div>
  );
}
