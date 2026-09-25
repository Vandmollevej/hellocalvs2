"use client";

import { useEffect, useState } from "react";
import { IconCalendarHeart } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type CycleEntry = {
  id: string;
  startDate: string;
  endDate: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

// Only reachable when sex = FEMALE and User.cycleTrackingEnabled is on — see
// src/lib/add-actions.ts and docs/DECISIONS.md 2026-09-19. Deliberately
// simple: log when a period started (and, once it's over, when it ended).
// No prediction/fertility-window UI here — that's future work, not something
// to invent without a spec.
export default function PeriodCreatePage() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(todayIso());
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    fetch("/api/menstrual-cycle")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { entries: CycleEntry[] };
      })
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/menstrual-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate }),
      });
      if (!response.ok) {
        setSaveError(t("periodLog.saveError"));
        return;
      }
      setSaved(true);
      load();
    } catch {
      setSaveError(t("periodLog.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title={t("periodLog.title")} icon={<IconCalendarHeart size={20} stroke={2} />}>
      <div className="hf-page">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("periodLog.intro")}</p>
        </div>

        <div className="hf-card hf-card--form">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
              {t("periodLog.startDate")}
            </span>
            <input
              type="date"
              className="rounded-xl bg-hf-white px-4 py-3 text-[15px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
              value={startDate}
              max={todayIso()}
              onChange={(event) => {
                setStartDate(event.target.value);
                setSaved(false);
              }}
            />
          </label>

          {saveError && <p className="hf-type-caption text-center">{saveError}</p>}
          {saved && !saveError && (
            <p className="text-center text-[13px] font-semibold text-hf-green">{t("periodLog.saved")}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="hf-btn-primary h-12 disabled:opacity-40"
          >
            <span className="hf-type-button">{saving ? t("periodLog.saving") : t("periodLog.add")}</span>
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {!loading && entries.length > 0 && <p className="hf-type-caption px-1">{t("periodLog.recentTitle")}</p>}
          {loading && <p className="text-center text-[13px] text-hf-black opacity-60">{t("periodLog.loading")}</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-[13px] text-hf-black opacity-60">{t("periodLog.noEntriesYet")}</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
              <p className="text-[16px] font-bold text-hf-black">{formatDate(entry.startDate)}</p>
            </div>
          ))}
        </div>
      </div>
    </HfScreen>
  );
}
