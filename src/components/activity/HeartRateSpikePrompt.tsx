"use client";

import { useEffect, useState } from "react";
import { ActivityPicker } from "@/components/activity/ActivityPicker";
import { HeartRateSpikeChart } from "@/components/activity/HeartRateSpikeChart";
import type { ActivityOption } from "@/lib/activity-types";
import type { HeartRateSpike } from "@/lib/heart-rate-spikes";
import { useTranslation } from "@/i18n/LocaleProvider";

// Første skærm efter login/åbning, når en tilsluttet integration har vist et
// mærkbart pulsudsving (src/lib/heart-rate-spikes.ts): graf over de fire timer
// med udsvinget i midten + "Hvad foretog du dig?" med aktivitetssøgning.
function dayLabel(iso: string, today: string) {
  const date = new Date(iso);
  if (date.toDateString() === new Date().toDateString()) return today;
  return `d. ${new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long" }).format(date)}`;
}

export function HeartRateSpikePrompt() {
  const { t } = useTranslation();
  const [spike, setSpike] = useState<HeartRateSpike | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/activities/spike")
      .then((res) => (res.ok ? (res.json() as Promise<{ spike: HeartRateSpike | null }>) : { spike: null }))
      .then((data) => setSpike(data.spike))
      .catch(() => undefined);
  }, []);

  if (!spike) return null;
  const current = spike;

  async function resolve(activityId?: string) {
    await fetch("/api/activities/spike", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startedAt: current.startedAt,
        endedAt: current.endedAt,
        extraKcal: current.extraKcal,
        activityId,
      }),
    }).catch(() => undefined);
    setSpike(null);
  }

  async function pick(option: ActivityOption) {
    setSaving(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportType: option.key,
          startedAt: current.startedAt,
          durationMinutes: current.durationMinutes,
          caloriesBurned: current.extraKcal,
        }),
      });
      const data = res.ok ? ((await res.json()) as { activity: { id: string } }) : null;
      await resolve(data?.activity.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-hf-cream" role="dialog" aria-modal="true">
      <div className="hf-page">
        <h1 className="hf-type-title pt-6 text-hf-black">
          {t("activity.spikeTitle", { day: dayLabel(current.startedAt, t("activity.today")), kcal: current.extraKcal })}
        </h1>
        <p className="hf-type-small text-text-secondary">
          {t("activity.spikeHint", { peak: current.peakBpm, rest: current.restingBpm, minutes: current.durationMinutes })}
        </p>
        <HeartRateSpikeChart
          samples={current.samples}
          windowStart={current.windowStart}
          windowEnd={current.windowEnd}
          spikeStart={current.startedAt}
          spikeEnd={current.endedAt}
        />
        <p className="hf-type-body hf-type-strong text-hf-black">{t("activity.spikeQuestion")}</p>
        <ActivityPicker onPick={(option) => void pick(option)} busy={saving} />
        <button type="button" className="hf-btn-text self-center" onClick={() => void resolve()} disabled={saving}>
          {t("activity.skip")}
        </button>
      </div>
    </div>
  );
}
