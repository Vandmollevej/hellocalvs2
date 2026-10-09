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
import { durationMinutes, endClock, minutesUntil, splitDuration } from "@/lib/activity-duration";

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

  function setEnd(value: string) {
    const next = minutesUntil(startedAt, value);
    if (next === null) return;
    const split = splitDuration(next);
    setHours(split.hours);
    setMins(split.minutes);
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
            <label className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.startedAt")}</span>
              <input className={FIELD} type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
            </label>
            <div className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.duration")}</span>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <input
                    className={FIELD}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    aria-label={t("activity.hours")}
                  />
                  <span className="hf-type-small text-text-secondary">{t("activity.hours")}</span>
                </label>
                <label className="flex flex-col gap-1">
                  <input
                    className={FIELD}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={mins}
                    onChange={(e) => setMins(e.target.value)}
                    aria-label={t("activity.minutesShort")}
                  />
                  <span className="hf-type-small text-text-secondary">{t("activity.minutesShort")}</span>
                </label>
                <label className="flex flex-col gap-1">
                  <input
                    className={FIELD}
                    type="time"
                    value={endClock(startedAt, totalMinutes)}
                    onChange={(e) => setEnd(e.target.value)}
                    aria-label={t("activity.endedAt")}
                  />
                  <span className="hf-type-small text-text-secondary">{t("activity.endedAt")}</span>
                </label>
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

const FIELD =
  "hf-type-body hf-field w-full rounded-xl bg-hf-tan px-4 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

export default function ActivityCreatePage() {
  return (
    <Suspense fallback={null}>
      <ActivityCreateContent />
    </Suspense>
  );
}
