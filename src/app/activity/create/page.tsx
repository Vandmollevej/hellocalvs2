"use client";

import { FieldSlider } from "@/components/hf/FieldSlider";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconActivity } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActivityPicker } from "@/components/activity/ActivityPicker";
import type { ActivityOption } from "@/lib/activity-types";
import { useTranslation } from "@/i18n/LocaleProvider";
import { intlLocale } from "@/i18n";
import { TRAINING_INTENSITIES, type TrainingIntensity } from "@/lib/pal-model";
import type { ActivityEstimate } from "@/lib/activity-met";
import { SleepRangeSlider } from "@/components/hf/SleepRangeSlider";
import {
  activityTrackStart,
  getSleepWindow,
  type SleepDefaults,
  type SleepScheduleEntry,
  type WorkShiftEntry,
} from "@/lib/sleep-window";
import { clockToMinutes, durationMinutes, setStartClock, splitDuration, stepDuration } from "@/lib/activity-duration";
import {
  TrainingCategoryRows,
  TrainingExerciseCard,
  TrainingExerciseSheet,
  newTrainingEntry,
} from "@/components/activity/TrainingSession";
import { TRAINING_SPORT, type TrainingCategory, type TrainingEntry } from "@/lib/training-exercises";
import { SESSION_DEFAULT_MINUTES } from "@/lib/training-session";
import { TrainingSessionCard, type SessionEntry } from "@/components/activity/TrainingSessionCard";

// Tilføj aktivitet (tilføj-menuen og kalenderens "Tilføj"). date/time fra
// kalenderen forudfylder starttidspunktet. "Opret træningspas" samler flere
// øvelser i én træning (brugerens ønske 2026-10-17); Gem ligger fast nederst.
function defaultStart(date: string | null, time: string | null) {
  const now = new Date();
  const day = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const clock = time ?? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return `${day}T${clock.slice(0, 5)}`;
}

function ActivityCreateContent() {
  const { t, locale } = useTranslation();
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
  // Træningspas: valgt kategori, øvelser med sæt og den åbne øvelses-popup.
  const [trainingCategory, setTrainingCategory] = useState<TrainingCategory | null>(null);
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [sheetCategory, setSheetCategory] = useState<TrainingCategory | null>(null);

  function addExercise(category: TrainingCategory, key: string) {
    if (!option || trainingCategory !== category) {
      setOption({ key: TRAINING_SPORT[category], label: t(`activity.training.category.${category}`), custom: false, pending: false });
      setTrainingCategory(category);
      setEntries([newTrainingEntry(key, category)]);
      return;
    }
    setEntries((current) => [...current, newTrainingEntry(key, category)]);
  }

  function changeActivity() {
    setOption(null);
    setTrainingCategory(null);
    setEntries([]);
  }
  // Træningspas ("Tilføjet"): tom = intet pas. Øvelserne ligger efter hinanden fra startedAt.
  const [session, setSession] = useState<SessionEntry[]>([]);
  const [nextEntryId, setNextEntryId] = useState(1);
  const [sessionKcal, setSessionKcal] = useState<number | null>(null);
  const sessionMinutes = session.reduce((sum, entry) => sum + entry.minutes, 0);
  const [sleep, setSleep] = useState<{
    defaults: SleepDefaults | null;
    weekdays: Record<number, SleepScheduleEntry>;
    shifts: Record<string, WorkShiftEntry>;
  } | null>(null);

  // Søvn fra kalenderen (stå-op-tid efter natten før), så banen kun viser de
  // vågne timer. Uden søvndata viser banen hele døgnet.
  useEffect(() => {
    let cancelled = false;
    const json = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));
    Promise.all([json("/api/profile"), json("/api/sleep-schedule"), json("/api/work-shifts")])
      .then(([profile, schedule, shifts]) => {
        if (cancelled) return;
        const weekdays: Record<number, SleepScheduleEntry> = {};
        for (const entry of (schedule?.schedules ?? []) as SleepScheduleEntry[]) weekdays[entry.weekday] = entry;
        const byDate: Record<string, WorkShiftEntry> = {};
        for (const shift of (shifts?.shifts ?? []) as WorkShiftEntry[]) byDate[String(shift.date).slice(0, 10)] = shift;
        setSleep({ defaults: profile?.user ?? null, weekdays, shifts: byDate });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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

  // Samlet anslået kcal for træningspasset (samme MET-skøn som serveren gemmer).
  useEffect(() => {
    if (session.length === 0) return;
    let cancelled = false;
    Promise.all(
      session.map((entry) =>
        fetch(`/api/activities/estimate?${new URLSearchParams({ sportType: entry.option.key, minutes: String(entry.minutes), intensity })}`)
          .then((res) => (res.ok ? (res.json() as Promise<{ estimate: ActivityEstimate }>) : null))
          .then((data) => data?.estimate.kcal ?? null),
      ),
    )
      .then((values) => {
        if (!cancelled) setSessionKcal(values.every((value) => value !== null) ? values.reduce((sum, value) => sum + (value ?? 0), 0) : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, intensity]);

  function addToSession(picked: ActivityOption) {
    setSession((current) => [...current, { id: nextEntryId, option: picked, minutes: SESSION_DEFAULT_MINUTES }]);
    setNextEntryId((id) => id + 1);
  }

  async function saveSession() {
    if (session.length === 0) {
      setError(t("activity.session.invalid"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session: {
            startedAt: new Date(startedAt).toISOString(),
            intensity,
            items: session.map((entry) => ({ sportType: entry.option.key, durationMinutes: entry.minutes })),
          },
        }),
      });
      if (!res.ok) {
        setError(t("activity.session.saveError"));
        return;
      }
      router.push(params.get("date") ? "/calendar" : "/");
    } finally {
      setSaving(false);
    }
  }

  function applyDuration(total: number) {
    const split = splitDuration(total);
    setHours(split.hours);
    setMins(split.minutes);
  }

  const startMinutes = clockToMinutes(startedAt.split("T")[1] ?? "") ?? 0;
  // Banen viser kun den valgte dag (00:00-23:59): slutningen går aldrig over midnat.
  const endMinutes = Math.min(startMinutes + totalMinutes, LAST_MINUTE);
  const [dayIso] = startedAt.split("T");
  const sleepWindow = sleep ? getSleepWindow(new Date(`${dayIso}T12:00`), sleep.defaults, sleep.weekdays, sleep.shifts) : null;
  const trackStart = activityTrackStart(sleepWindow, startMinutes);

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
          exercises: trainingCategory && entries.length > 0 ? entries : undefined,
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

  // Datoen vises på appens sprog (browserens eget datofelt følger telefonens
  // sprog og ser rodet ud); det usynlige felt ovenpå åbner telefonens datovælger.
  const dateField = (
    <label className={`${FIELD} hf-control relative flex items-center`}>
      <span className="text-hf-black">{formatStartDate(startedAt.split("T")[0], intlLocale(locale))}</span>
      <input
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        type="date"
        aria-label={t("activity.startedAt")}
        value={startedAt.split("T")[0]}
        onChange={(e) => e.target.value && setStartedAt(`${e.target.value}T${startedAt.split("T")[1] ?? "00:00"}`)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // Ældre browsere uden showPicker.
          }
        }}
      />
    </label>
  );

  const intensityPicker = (
    <div className="flex flex-col gap-2">
      <span className="hf-type-caption">{t("activity.intensity")}</span>
      <p className="hf-type-caption">{t("activity.intensityHint")}</p>
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
  );

  // Gem ligger fast nederst over bundmenuen (brugerens ønske 2026-10-17).
  const footer = option ? (
    <div className="flex flex-col gap-2">
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
      <button type="button" className="hf-control hf-btn-primary w-full px-4" onClick={() => void save()} disabled={saving}>
        {t("activity.save")}
      </button>
    </div>
  ) : session.length > 0 ? (
    <div className="flex flex-col gap-2">
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
      <button type="button" className="hf-control hf-btn-primary w-full px-4" onClick={() => void saveSession()} disabled={saving}>
        {t("activity.session.save")}
      </button>
    </div>
  ) : undefined;

  return (
    <HfScreen title={t("activity.title")} icon={<IconActivity size={20} stroke={2} />} footer={footer}>
      <div className="hf-page">
        {!option ? (
          <div className="flex flex-col gap-4">
            <TrainingCategoryRows onPick={setSheetCategory} />
            {/* ⊕ på en sport lægger den her; flere dele gemmes samlet som ét træningspas. */}
            {session.length > 0 && (
              <>
                <section className="flex flex-col gap-2">
                  <h2 className="hf-type-section-title">{t("activity.session.added")}</h2>
                  <TrainingSessionCard entries={session} onChange={setSession} />
                  <p className="hf-type-caption text-right">
                    {sessionKcal !== null
                      ? t("activity.session.totalKcal", { minutes: sessionMinutes, kcal: sessionKcal })
                      : t("activity.session.total", { minutes: sessionMinutes })}
                  </p>
                </section>
                <div className="flex flex-col gap-2">
                  <span className="hf-type-caption">{t("activity.startedAt")}</span>
                  <div className="flex gap-2">
                    {dateField}
                    <input
                      className={FIELD}
                      type="time"
                      aria-label={t("activity.session.startTime")}
                      value={(startedAt.split("T")[1] ?? "00:00").slice(0, 5)}
                      onChange={(e) => e.target.value && setStartedAt(setStartClock(startedAt, e.target.value))}
                    />
                  </div>
                </div>
                {intensityPicker}
              </>
            )}
            <ActivityPicker onPick={setOption} onAdd={addToSession} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <button type="button" className="hf-btn-text self-start text-hf-black" onClick={changeActivity}>
              {option.label}
            </button>
            {trainingCategory && (
              <section className="flex flex-col gap-6">
                <h2 className="hf-type-section-title">{t("activity.training.exercises")}</h2>
                {entries.map((entry, index) => (
                  <TrainingExerciseCard
                    key={`${entry.key}-${index}`}
                    entry={entry}
                    category={trainingCategory}
                    onChange={(next) => setEntries((current) => current.map((item, i) => (i === index ? next : item)))}
                    onRemove={() => setEntries((current) => current.filter((_, i) => i !== index))}
                  />
                ))}
                <button
                  type="button"
                  className="hf-control hf-btn-secondary w-full px-4"
                  onClick={() => setSheetCategory(trainingCategory)}
                >
                  {t("activity.training.addExercise")}
                </button>
              </section>
            )}
            <div className="flex flex-col gap-2">
              <span className="hf-type-caption">{t("activity.startedAt")}</span>
              {dateField}
              <SleepRangeSlider
                bedtimeFirst
                bedtimeMinutes={startMinutes}
                wakeMinutes={endMinutes}
                onChangeBedtime={setStart}
                onChangeWake={setEnd}
                trackStart={trackStart}
                trackEnd={LAST_MINUTE}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="hf-type-caption">{t("activity.duration")}</span>
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
            {intensityPicker}
            {showsDistance && (
              <label className="flex flex-col gap-1">
                <span className="hf-type-caption">{t("activity.distanceKm")}</span>
                <input className={FIELD} type="number" inputMode="decimal" min={0} step={0.1} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
                <FieldSlider value={distanceKm} min={0} max={100} step={0.1} onChange={setDistanceKm} aria-label={t("activity.distanceKm")} />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="hf-type-caption">{t("activity.kcal")}</span>
              <input
                className={FIELD}
                type="number"
                inputMode="numeric"
                min={1}
                value={kcal !== "" ? kcal : estimate?.kcal ? String(estimate.kcal) : ""}
                onChange={(e) => setKcal(e.target.value)}
              />
              <FieldSlider
                value={kcal !== "" ? kcal : estimate?.kcal ? String(estimate.kcal) : ""}
                min={0}
                max={3000}
                step={10}
                onChange={setKcal}
                aria-label={t("activity.kcal")}
              />
            </label>
          </div>
        )}
      </div>
      {sheetCategory && (
        <TrainingExerciseSheet
          category={sheetCategory}
          onPick={(key) => addExercise(sheetCategory, key)}
          onClose={() => setSheetCategory(null)}
        />
      )}
    </HfScreen>
  );
}

const LAST_MINUTE = 24 * 60 - 1;

function minutesToClock(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}

// "17. okt. 2026" på appens sprog — samme som native (dayMonthShort med år).
function formatStartDate(day: string, locale: string) {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(y, m - 1, d));
}

const FIELD =
  "hf-type-body hf-field w-full hf-field-soft hf-field-soft--focus";

export default function ActivityCreatePage() {
  return (
    <Suspense fallback={null}>
      <ActivityCreateContent />
    </Suspense>
  );
}
