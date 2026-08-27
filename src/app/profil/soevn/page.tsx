"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";

const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

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

  function updateWeekday(weekday: number, field: "bedtime" | "wakeTime", value: string) {
    setSchedules((current) => {
      const existing = current[weekday] ?? { weekday, bedtime: "", wakeTime: "" };
      const next = { ...existing, [field]: value };
      const existingTimeout = weekdaySaveTimeouts.current[weekday];
      if (existingTimeout) clearTimeout(existingTimeout);
      weekdaySaveTimeouts.current[weekday] = setTimeout(() => {
        fetch("/api/sleep-schedule", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekday,
            bedtime: next.bedtime || null,
            wakeTime: next.wakeTime || null,
          }),
        }).catch(() => {});
      }, 500);
      return { ...current, [weekday]: next };
    });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Søvnmønster" onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? "Henter…" : "Kunne ikke hente søvnmønster."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Normal sengetid">
              <input
                type="time"
                className={timeInputClass}
                value={user.defaultBedtime ?? ""}
                onChange={(event) => updateDefault("defaultBedtime", event.target.value || null)}
              />
            </Field>
            <Field label="Normal stå-op-tid">
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
              Individuelle tider pr. ugedag
            </span>
            <IconChevronDown size={18} className={perDayOpen ? "rotate-180" : ""} />
          </button>

          {perDayOpen && (
            <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
              <p className="text-[12px] text-hf-black opacity-60">
                Angiv kun tider for de dage, der afviger fra normal sengetid/stå-op-tid ovenfor.
              </p>
              {WEEKDAY_LABELS.map((label, weekday) => {
                const schedule = schedules[weekday];
                return (
                  <div key={label} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2">
                    <span className="text-[13px] font-semibold text-hf-black">{label}</span>
                    <input
                      type="time"
                      aria-label={`${label} sengetid`}
                      className="rounded-xl bg-hf-cream px-3 py-2 text-[14px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
                      value={schedule?.bedtime ?? ""}
                      onChange={(event) => updateWeekday(weekday, "bedtime", event.target.value)}
                    />
                    <input
                      type="time"
                      aria-label={`${label} stå-op-tid`}
                      className="rounded-xl bg-hf-cream px-3 py-2 text-[14px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
                      value={schedule?.wakeTime ?? ""}
                      onChange={(event) => updateWeekday(weekday, "wakeTime", event.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          <label className="flex items-center gap-3 rounded-2xl bg-hf-tan px-4 py-4">
            <input
              type="checkbox"
              className="size-5 accent-hf-green"
              checked={user.shiftWorkEnabled}
              onChange={(event) => toggleShiftWork(event.target.checked)}
            />
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-hf-black">Skiftende arbejdstider</span>
              <span className="block text-[12px] text-hf-black opacity-60">
                Registrér natarbejde/skiftehold og tilhørende søvntider direkte i kalenderen.
              </span>
            </span>
          </label>

          {user.shiftWorkEnabled && (
            <p className="text-[13px] text-hf-black opacity-70">
              Åbn en dag i kalenderen for at registrere arbejdstid og en eventuel søvn-override for den
              dag. Dataene bruges i kalenderens søvnvisualisering.
            </p>
          )}

          <label className="flex items-center gap-3 rounded-2xl bg-hf-tan px-4 py-4">
            <input
              type="checkbox"
              className="size-5 accent-hf-green"
              checked={user.workHoursInCalendarEnabled}
              onChange={(event) => updateDefault("workHoursInCalendarEnabled", event.target.checked)}
            />
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-hf-black">Arbejdstider i kalenderen</span>
              <span className="block text-[12px] text-hf-black opacity-60">
                Vis mulighed for at registrere arbejdstider direkte på en dag i kalenderen.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
