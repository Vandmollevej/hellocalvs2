"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { IconBathroomScale } from "@/components/icons/BathroomScale";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatWeight, parseWeightInput, useUnits, weightToInputValue, weightUnitLabel } from "@/lib/units";
import { openWeighIn } from "@/components/WeighInPrompt";
import { Skeleton, SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";

type WeightEntry = {
  id: string;
  weightKg: number;
  weighedAt: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function WeightCreatePage() {
  const { t } = useTranslation();
  const { weight: weightUnit } = useUnits();
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/weight-entries")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { entries: WeightEntry[] };
      })
      .then((data) => setEntries(data.entries.slice(0, 5)))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseWeightInput(weightKg, weightUnit);
    if (!parsed) return;

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/weight-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: parsed }),
      });
      if (!response.ok) {
        setSaveError(t("weightLog.saveError"));
        return;
      }
      setWeightKg("");
      setSaved(true);
      load();
    } catch {
      setSaveError(t("weightLog.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen
      title={t("weightLog.title")}
      icon={<IconBathroomScale size={20} stroke={2} />}
    >
      <div className="hf-page">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="hf-type-small">{t("weightLog.intro")}</p>
        </div>

        <form onSubmit={handleSubmit} className="hf-card hf-card--form">
          <TextField
            variant="standard"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            inputMode={weightUnit === "st" ? "text" : "decimal"}
            autoFocus
            label={`${t("weightLog.weightLabel")} (${weightUnitLabel(weightUnit)})`}
            placeholder={weightToInputValue(78.4, weightUnit)}
            required
          />

          {saveError && <p className="hf-type-caption text-center">{saveError}</p>}
          {saved && !saveError && (
            <p className="hf-type-small hf-type-strong text-center text-hf-green">{t("weightLog.saved")}</p>
          )}

          <button type="submit" disabled={saving} className="hf-control hf-btn-primary disabled:opacity-40">
            <span className="hf-type-button">{saving ? t("weightLog.saving") : t("weightLog.save")}</span>
          </button>
        </form>

        <Link href="/profile/weight-calibration" className="hf-type-small hf-type-strong text-text-secondary text-center underline">
          {t("weightLog.moreDetailsLink")}
        </Link>

        <div className="flex flex-col gap-2">
          {!loading && entries.length > 0 && (
            <p className="hf-type-caption px-1">{t("weightLog.recentTitle")}</p>
          )}
          {loading && (
            <SkeletonScreen className="flex flex-col gap-2">
              <Skeleton type="caption" width={96} />
              <SkeletonCards count={3} height={48} radius={16} />
            </SkeletonScreen>
          )}
          {!loading && entries.length === 0 && (
            <p className="hf-type-small text-text-secondary text-center">{t("weightLog.noEntriesYet")}</p>
          )}
          {entries.map((entry) => (
            <button
              type="button"
              key={entry.id}
              onClick={() => openWeighIn(entry.id)}
              className="hf-control-row flex w-full items-center justify-between rounded-2xl bg-hf-tan px-4 text-left"
            >
              <p className="hf-type-body hf-type-strong text-hf-black">
                {formatWeight(entry.weightKg, weightUnit)}
                <span className="hf-type-small text-text-secondary ml-2">{formatDateTime(entry.weighedAt)}</span>
              </p>
            </button>
          ))}
        </div>
      </div>
    </HfScreen>
  );
}
