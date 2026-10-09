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
import { clockToMinutes, durationMinutes, endClock, minutesUntil, setStartClock, splitDuration, stepDuration } from "@/lib/activity-duration";

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
  const [hasWeight, setHasWeight] = useState(true);
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
      .then((data: { estimate: ActivityEstimate; hasWeight: boolean } | null) => {
        if (cancelled || !data) return;
        setEstimate(data.estimate);
        setHasWeight(data.hasWeight);
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
  const endMinutes = clockToMinutes(endClock(startedAt, totalMinutes)) ?? 0;

  // Slut-håndtaget ændrer varigheden; start-håndtaget flytter starten, så
  // sluttidspunktet bliver stående (varigheden regnes om).
  function setEnd(value: number) {
    const next = minutesUntil(startedAt, minutesToClock(value));
    if (next !== null) applyDuration(next);
  }

  function setStart(value: number) {
    const end = endClock(startedAt, totalMinutes);
    const nextStart = setStartClock(startedAt, minutesToClock(value));
    setStartedAt(nextStart);
    const next = minutesUntil(nextStart, end);
    if (next !== null) applyDuration(next);
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
                  onClick={() => applyDuration(stepDuration(totalMinutes, -1))}
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
                  onClick={() => applyDuration(stepDuration(totalMinutes, 1))}
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
              {TRAINING_INTENSITIES.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="hf-choice hf-control w-full text-left"
                  aria-pressed={intensity === key}
                  onClick={() => setIntensity(key)}
                >
                  {t(`onboarding.activity.intensity.${key}`)}
                </button>
              ))}
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
                value={kcal}
                placeholder={estimate?.kcal ? t("activity.kcalEstimated", { kcal: estimate.kcal }) : ""}
                onChange={(e) => setKcal(e.target.value)}
              />
              <span className="hf-type-small text-text-secondary">
                {!hasWeight
                  ? t("activity.kcalNoWeight")
                  : estimate
                    ? t(estimate.method === "SPEED" ? "activity.kcalHintSpeed" : "activity.kcalHintMet", { met: estimate.met })
                    : ""}
              </span>
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
