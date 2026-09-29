"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconActivity } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActivityPicker } from "@/components/activity/ActivityPicker";
import type { ActivityOption } from "@/lib/activity-types";
import { useTranslation } from "@/i18n/LocaleProvider";

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
  const [minutes, setMinutes] = useState("30");
  const [kcal, setKcal] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!option) return;
    const durationMinutes = Number(minutes);
    const caloriesBurned = Number(kcal);
    if (!(durationMinutes > 0) || !(caloriesBurned > 0)) {
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
          durationMinutes,
          caloriesBurned,
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
            <button type="button" className="hf-btn-text self-start" onClick={() => setOption(null)}>
              {option.label} · {t("activity.change")}
            </button>
            <label className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.startedAt")}</span>
              <input className="hf-field" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.minutes")}</span>
              <input className="hf-field" type="number" inputMode="numeric" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="hf-type-small text-text-secondary">{t("activity.kcal")}</span>
              <input className="hf-field" type="number" inputMode="numeric" min={1} value={kcal} onChange={(e) => setKcal(e.target.value)} />
            </label>
            {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
            <button type="button" className="hf-btn-primary" onClick={() => void save()} disabled={saving}>
              {t("activity.save")}
            </button>
          </div>
        )}
      </div>
    </HfScreen>
  );
}

export default function ActivityCreatePage() {
  return (
    <Suspense fallback={null}>
      <ActivityCreateContent />
    </Suspense>
  );
}
