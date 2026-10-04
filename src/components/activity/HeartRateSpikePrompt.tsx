"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityPicker } from "@/components/activity/ActivityPicker";
import { HeartRateSpikeChart } from "@/components/activity/HeartRateSpikeChart";
import { PulseSuggestionCard } from "@/components/activity/PulseSuggestionCard";
import { PulseWeekStrip } from "@/components/activity/PulseWeekStrip";
import { BottomSheet, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { intlLocale } from "@/i18n";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { PulsePrompt } from "@/lib/pulse-candidates";

// Første skærm efter login/åbning, når en tilsluttet integration har vist et
// mærkbart pulsudsving uden registreret sport (nattens puls-robot,
// src/lib/pulse-candidates.ts): "Vi kan se, at din puls var højere end
// sædvanlig i går" med graf over de fire timer, ugen vandret med datoer
// (sport krydset af med klokkeslæt), robottens forslag (når der er data nok)
// og "Hvad foretog du dig?". Bundark på både telefon og desktop (KRAV.md
// "Bundark"). Hvis flere udsving venter, spørges der om op til tre pr. besøg.
const MAX_PROMPTS_PER_VISIT = 3;
const LATER_KEY = "hf-pulse-prompt-later";

type Outcome = "answered" | "skipped" | "later";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function laterFlag() {
  try {
    return window.sessionStorage.getItem(LATER_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberLater() {
  try {
    window.sessionStorage.setItem(LATER_KEY, "1");
  } catch {
    // ignoreres — arket lukkes stadig for denne visning
  }
}

export function HeartRateSpikePrompt() {
  const [spike, setSpike] = useState<PulsePrompt | null>(null);
  const outcome = useRef<Outcome>("later");
  const shown = useRef(0);

  const load = useCallback(() => {
    fetch("/api/activities/spike")
      .then((res) => (res.ok ? (res.json() as Promise<{ spike: PulsePrompt | null }>) : { spike: null }))
      .then((data) => {
        if (!data.spike) return;
        shown.current += 1;
        outcome.current = "later";
        setSpike(data.spike);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!laterFlag()) load();
  }, [load]);

  function closed() {
    setSpike(null);
    // Swipe/scrim = "senere": spørges igen ved næste åbning, men ikke igen i denne fane.
    if (outcome.current === "later") {
      rememberLater();
      return;
    }
    if (shown.current < MAX_PROMPTS_PER_VISIT) load();
  }

  if (!spike) return null;
  return (
    <PulseSheet
      key={spike.startedAt}
      spike={spike}
      onClose={closed}
      onOutcome={(value) => {
        outcome.current = value;
      }}
    />
  );
}

function PulseSheet({
  spike,
  onClose,
  onOutcome,
}: {
  spike: PulsePrompt;
  onClose: () => void;
  onOutcome: (outcome: Outcome) => void;
}) {
  const { t, locale } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const started = new Date(spike.startedAt);
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(started)) / 86_400_000);
  const tag = intlLocale(locale);
  const dateText = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long" }).format(started);
  const timeText = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit" }).format(started);
  const day =
    dayDiff <= 0 ? t("activity.today") : dayDiff === 1 ? t("activity.yesterday") : t("activity.onDate", { date: dateText });

  async function answer(activityId?: string) {
    onOutcome(activityId ? "answered" : "skipped");
    await fetch("/api/activities/spike", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: spike.startedAt,
        endedAt: spike.endedAt,
        extraKcal: spike.extraKcal,
        activityId,
      }),
    }).catch(() => undefined);
  }

  return (
    <BottomSheet
      size="full"
      title={t("activity.pulseTitle", { day })}
      onClose={onClose}
      footer={<SkipButton busy={busy} onAnswer={() => answer()} />}
    >
      <PulseBody
        spike={spike}
        busy={busy}
        failed={failed}
        setBusy={setBusy}
        setFailed={setFailed}
        onAnswer={answer}
        whenText={t("activity.pulseWhen", { date: dateText, time: timeText, kcal: Math.round(spike.extraKcal) })}
      />
    </BottomSheet>
  );
}

function SkipButton({ busy, onAnswer }: { busy: boolean; onAnswer: () => Promise<void> }) {
  const { t } = useTranslation();
  const close = useBottomSheetClose();
  return (
    <button
      type="button"
      className="hf-bottom-sheet__skip"
      disabled={busy}
      onClick={() => {
        void onAnswer().then(close);
      }}
    >
      {t("activity.skip")}
    </button>
  );
}

function PulseBody({
  spike,
  busy,
  failed,
  setBusy,
  setFailed,
  onAnswer,
  whenText,
}: {
  spike: PulsePrompt;
  busy: boolean;
  failed: boolean;
  setBusy: (busy: boolean) => void;
  setFailed: (failed: boolean) => void;
  onAnswer: (activityId?: string) => Promise<void>;
  whenText: string;
}) {
  const { t } = useTranslation();
  const close = useBottomSheetClose();

  async function save(sportType: string) {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportType,
          startedAt: spike.startedAt,
          durationMinutes: spike.durationMinutes,
          caloriesBurned: spike.extraKcal,
        }),
      });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const data = (await res.json()) as { activity: { id: string } };
      await onAnswer(data.activity.id);
      close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4">
      <p className="hf-type-small text-center text-text-secondary">
        {whenText} {t("activity.spikeHint", { peak: spike.peakBpm, rest: spike.restingBpm, minutes: spike.durationMinutes })}
      </p>
      <HeartRateSpikeChart
        samples={spike.samples}
        windowStart={spike.windowStart}
        windowEnd={spike.windowEnd}
        spikeStart={spike.startedAt}
        spikeEnd={spike.endedAt}
      />
      <PulseWeekStrip activities={spike.weekActivities} askedAt={spike.startedAt} />
      {spike.suggestion && <PulseSuggestionCard suggestion={spike.suggestion} busy={busy} onPick={(sport) => void save(sport)} />}
      <p className="hf-type-body hf-type-strong text-hf-black">{t("activity.pulseQuestion")}</p>
      <ActivityPicker onPick={(option) => void save(option.key)} busy={busy} />
      {failed && (
        <p className="hf-type-small text-hf-red-dark" role="alert">
          {t("activity.saveFailed")}
        </p>
      )}
    </div>
  );
}
