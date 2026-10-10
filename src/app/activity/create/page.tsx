"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconActivity } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActivityPicker } from "@/components/activity/ActivityPicker";
import type { ActivityOption } from "@/lib/activity-types";
import { useTranslation } from "@/i18n/LocaleProvider";
import { TRAINING_INTENSITIES, type TrainingIntensity } from "@/lib/pal-model";
import type { ActivityEstimate } from "@/lib/activity-met";
import { SleepRangeSlider } from "@/components/hf/SleepRangeSlider";
import { clockToMinutes, durationMinutes, setStartClock, splitDuration, stepDuration } from "@/lib/activity-duration";

// Tilføj aktivitet (tilføj-menuen og kalenderens "Tilføj"). date/time fra
// kalenderen forudfylder starttidspunktet.
function defaultStart(date: string | null, time: string | null) {
  const now = new Date();
  const day = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const clock = time ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${day}T${clock.slice(0, 5)}`;
}

function ActivityCreateContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [option, setOption] = useState<ActivityOption | null>(null);
  const [startedAt, setStartedAt] = useState(() => defaultStart(params.get("date"), params.get("time")));
  // Varighed som timer + minutter; sluttidspunktet regnes ud og kan rettes.
  const [hours, setHours] = useState("0");
  const [mins, setMins] = useState("30");
  const totalMinutes = durationMinutes(hours, mins);
  const minutes = String(totalMinutes);
  const [kcal, setKcal] = useState("");
  const [intensity, setIntensity] = useState<TrainingIntensity>("MODERATE");
  const [distanceKm, setDistanceKm] = useState("");
  const [estimate, setEstimate] = useState<ActivityEstimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anslåede kcal fra MET (docs/ACTIVITY-PAL.md F3): taletest + evt.
  // distance for gang/løb. Brugerens eget tal i kcal-feltet vinder.
  const showsDistance = option?.key === "walking" || option?.key === "running";
  useEffect(() => {
    if (!option || !(Number(minutes) > 0)) return;
    const query = new URLSearchParams({ sportType: option.key, minutes, intensity });
    if (showsDistance && Number(distanceKm) > 0) query.set("distanceKm", distanceKm);
    let cancelled = false;
    fetch(`/api/activities/estimate?${query}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { estimate: ActivityEstimate } | null) => {
        if (cancelled || !data) return;
        setEstimate(data.estimate);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [option, minutes, intensity, distanceKm, showsDistance]);

  function applyDuration(total: number) {
    const split = splitDuration(total);
    setHours(split.hours);
    setMins(split.minutes);
  }

  const startMinutes = clockToMinutes(startedAt.split("T")[1] ?? "") ?? 0;
  // Banen viser kun den valgte dag (00:00-23:59): slutningen går aldrig over midnat.
  const endMinutes = Math.min(startMinutes + totalMinutes, LAST_MINUTE);

  // Slut-håndtaget ændrer varigheden; start-håndtaget flytter starten, så
  // sluttidspunktet bliver stående (varigheden regnes om). Begge holdes inden
  // for dagen, og slut ligger altid efter start.
  function setEnd(value: number) {
    const end = Math.min(LAST_MINUTE, Math.max(startMinutes + 1, value));
    applyDuration(end - startMinutes);
  }

  function setStart(value: number) {
    const nextStart = Math.min(LAST_MINUTE - 1, value);
    const end = Math.min(LAST_MINUTE, Math.max(endMinutes, nextStart + 5));
    setStartedAt(setStartClock(startedAt, minutesToClock(nextStart)));
    applyDuration(end - nextStart);
  }

  function stepWithinDay(direction: 1 | -1) {
    applyDuration(Math.min(stepDuration(totalMinutes, direction), LAST_MINUTE - startMinutes));
  }

  async function save() {
    if (!option) return;
    const ownKcal = kcal.trim() === "" ? undefined : Number(kcal);
    if (!(totalMinutes > 0) || (ownKcal !== undefined && !(ownKcal > 0)) || (ownKcal === undefined && !(estimate?.kcal))) {
      setError(t("activity.invalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportType: option.key,
          startedAt: new Date(startedAt).toISOString(),
          durationMinutes: totalMinutes,
          caloriesBurned: ownKcal,
          intensity,
          distanceKm: showsDistance && Number(distanceKm) > 0 ? Number(distanceKm) : null,
        }),
      });
      if (!res.ok) {
        setError(t("activity.saveError"));
        return;
      }
      router.push(params.get("date") ? "/calendar" : "/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title={t("activity.title")} icon={<IconActivity size={20} stroke={2} />}>
      <div className="hf-page">
        {!option ? (
          <ActivityPicker onPick={setOption} />
        ) : (
          <div className="flex flex-col gap-4">
            <button type="button" className="hf-btn-text self-start text-hf-black" onClick={() => setOption(null)}>
              {option.label} · {t("activity.change")}
            </button>
            <div className="flex flex-col gap-2">
              <span className="hf-type-small text-text-secondary">{t("activity.startedAt")}</span>
              <input
                className={FIELD}
                type="date"
                value={startedAt.split("T")[0]}
                onChange={(e) => e.target.value && setStartedAt(`${e.target.value}T${startedAt.split("T")[1] ?? "00:00"}`)}
              />
              <SleepRangeSlider
                bedtimeFirst
                bedtimeMinutes={startMinutes}
                wakeMinutes={endMinutes}
                onChangeBedtime={setStart}
                onChangeWake={setEnd}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.duration")}</span>
              <div className="mx-auto flex w-full max-w-[320px] items-center gap-2">
                <button
                  type="button"
                  onClick={() => stepWithinDay(-1)}
                  className="h-11 w-11 text-hf-black hf-glyph-lg"
                  aria-label="−5 min"
                >
                  −
                </button>
                <div className="flex flex-1 items-baseline justify-center gap-1 rounded-2xl bg-hf-tan py-3 text-center text-hf-black">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    aria-label={t("activity.hours")}
                    style={{ width: `${Math.max(1, hours.length) + 0.5}ch` }}
                    className="hf-type-page-title bg-transparent text-right outline-none"
                  />
                  <span className="hf-type-page-title">{t("activity.hours")}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={mins}
                    onChange={(e) => setMins(e.target.value)}
                    aria-label={t("activity.minutesShort")}
                    style={{ width: `${Math.max(1, mins.length) + 0.5}ch` }}
                    className="hf-type-page-title ml-2 bg-transparent text-right outline-none"
                  />
                  <span className="hf-type-page-title">{t("activity.minutesShort")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => stepWithinDay(1)}
                  className="h-11 w-11 text-hf-black hf-glyph-lg"
                  aria-label="+5 min"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="hf-type-small text-text-secondary">{t("activity.intensity")}</span>
              <p className="hf-type-small text-text-secondary">{t("activity.intensityHint")}</p>
              <div className="flex items-end gap-2" role="radiogroup" aria-label={t("activity.intensity")}>
                {TRAINING_INTENSITIES.map((key, index) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={index <= TRAINING_INTENSITIES.indexOf(intensity)}
                    aria-label={t(`onboarding.activity.intensity.${key}`)}
                    className={`flex-1 rounded-card transition-colors ${
                      index <= TRAINING_INTENSITIES.indexOf(intensity) ? "bg-hf-accent" : "bg-hf-card"
                    }`}
                    style={{ height: 24 + index * 16 }}
                    onClick={() => setIntensity(key)}
                  />
                ))}
              </div>
              <p className="hf-type-body hf-type-strong text-center">{t(`onboarding.activity.intensity.${intensity}`)}</p>
            </div>
            {showsDistance && (
              <label className="flex flex-col gap-1">
                <span className="hf-type-small text-text-secondary">{t("activity.distanceKm")}</span>
                <input className={FIELD} type="number" inputMode="decimal" min={0} step={0.1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.kcal")}</span>
              <input
                className={FIELD}
                type="number"
                inputMode="numeric"
                min={1}
                value={kcal !== "" ? kcal : estimate?.kcal ? String(estimate.kcal) : ""}
                onChange={(e) => setKcal(e.target.value)}
              />
            </label>
            {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
            <button type="button" className="hf-control hf-btn-primary w-full px-4" onClick={() => void save()} disabled={saving}>
              {t("activity.save")}
            </button>
          </div>
        )}
      </div>
    </HfScreen>
  );
}

const LAST_MINUTE = 24 * 60 - 1;

function minutesToClock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

const FIELD =
  "hf-type-body hf-field w-full rounded-xl bg-hf-tan px-4 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

export default function ActivityCreatePage() {
  return (
    <Suspense fallback={null}>
      <ActivityCreateContent />
    </Suspense>
  );
}
