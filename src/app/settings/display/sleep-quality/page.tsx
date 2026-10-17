"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";
import {
  SLEEP_QUALITY_FREQUENCIES,
  SLEEP_QUALITY_RATINGS,
  fetchSleepQuality,
  isSleepQualityFrequency,
  localDateKey,
  saveSleepQuality,
  type SleepQualityFrequency,
} from "@/lib/sleep-quality";

// Profil → Screeninger → Søvn (docs/DECISIONS.md 2026-09-26, 2026-10-17; adressen
// er uændret): til/fra øverst, derefter hvor ofte der spørges, "Vis i kalenderen"
// og dagens vurdering, som kan sættes eller rettes direkte her. Spørgsmålet
// stilles af src/components/SleepQualityGate.tsx.
type SleepSettings = { enabled: boolean; frequency: SleepQualityFrequency; showInCalendar: boolean };

export default function SleepQualityDisplaySettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SleepSettings | null>(null);
  const [todayRating, setTodayRating] = useState<number | null>(null);
  // ?focus=toggle — opened from "Slå fra" in the sleep question overlay: the
  // toggle gets a thin green ring and keyboard focus.
  const focusToggle = useSearchParams().get("focus") === "toggle";
  const toggleRef = useRef<HTMLDivElement>(null);
  const loaded = settings !== null;

  useEffect(() => {
    if (focusToggle && loaded)
      toggleRef.current?.querySelector<HTMLElement>("[role=switch]")?.focus();
  }, [focusToggle, loaded]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as {
          user: { sleepQualityPromptEnabled: boolean; sleepQualityFrequency?: string; sleepQualityShowInCalendar?: boolean };
        };
      })
      .then(({ user }) => {
        if (cancelled) return;
        setSettings({
          enabled: user.sleepQualityPromptEnabled,
          frequency: isSleepQualityFrequency(user.sleepQualityFrequency) ? user.sleepQualityFrequency : "DAILY",
          showInCalendar: user.sleepQualityShowInCalendar !== false,
        });
      })
      .catch(() => undefined);
    fetchSleepQuality(localDateKey(new Date()))
      .then((entries) => {
        if (!cancelled) setTodayRating(entries[0]?.rating ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function save(patch: Partial<SleepSettings>) {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    const body: Record<string, unknown> = {};
    if (patch.enabled !== undefined) body.sleepQualityPromptEnabled = patch.enabled;
    if (patch.frequency !== undefined) body.sleepQualityFrequency = patch.frequency;
    if (patch.showInCalendar !== undefined) body.sleepQualityShowInCalendar = patch.showInCalendar;
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function rate(rating: number) {
    setTodayRating(rating);
    saveSleepQuality(localDateKey(new Date()), rating).catch(() => undefined);
  }

  return (
    <HfScreen title={t("settings.sleepQuality")}>
      <div className="flex flex-col gap-6 p-4">
        {settings === null ? (
          <SkeletonScreen className="">
            <SkeletonToggle />
            <SkeletonToggle />
          </SkeletonScreen>
        ) : (
          <>
            <div ref={toggleRef} className={focusToggle ? "rounded-xl ring-2 ring-hf-green" : undefined}>
              <Toggle
                checked={settings.enabled}
                onChange={(value) => save({ enabled: value })}
                label={t("sleepQualitySettings.toggleLabel")}
                description={t("sleepQualitySettings.toggleDescription")}
              />
            </div>

            <section className={`flex flex-col gap-3 ${settings.enabled ? "" : "opacity-50"}`}>
              <h2 className="hf-type-section-title">{t("screenings.frequencyTitle")}</h2>
              {SLEEP_QUALITY_FREQUENCIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="hf-chip"
                  disabled={!settings.enabled}
                  aria-pressed={settings.frequency === key}
                  onClick={() => save({ frequency: key })}
                >
                  {t(`screenings.frequency.${key}`)}
                </button>
              ))}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="hf-type-section-title">{t("screenings.calendarTitle")}</h2>
              <Toggle
                checked={settings.showInCalendar}
                onChange={(value) => save({ showInCalendar: value })}
                label={t("screenings.calendarLabel")}
                description={t("sleepQualitySettings.calendarDesc")}
              />
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="hf-type-section-title">{t("sleepQualitySettings.todayTitle")}</h2>
              <p className="hf-type-body text-text-secondary">{t("sleepQuality.question")}</p>
              <div className="flex items-center justify-between gap-2">
                {SLEEP_QUALITY_RATINGS.map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => rate(rating)}
                    aria-label={t("sleepQuality.ratingAriaLabel", { rating: String(rating) })}
                    aria-pressed={todayRating === rating}
                    className={`hf-type-section-title flex size-12 items-center justify-center rounded-full transition-colors duration-200 ${
                      todayRating === rating ? "bg-hf-green text-white" : "bg-hf-tan text-hf-black"
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </HfScreen>
  );
}
