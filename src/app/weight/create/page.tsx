"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { IconBathroomScale } from "@/components/icons/BathroomScale";
import { useTranslation } from "@/i18n/LocaleProvider";

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

function formatKg(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
}

export default function WeightCreatePage() {
  const { t } = useTranslation();
  const router = useRouter();
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
    const parsed = Number(weightKg.replace(",", "."));
    if (!parsed || parsed <= 0) return;

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
      onBack={() => router.back()}
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("weightLog.intro")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
          <TextField
            variant="standard"
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
            inputMode="decimal"
            autoFocus
            label={t("weightLog.weightLabel")}
            placeholder={t("weightLog.weightPlaceholder")}
            required
          />

          {saveError && <p className="hf-type-caption text-center">{saveError}</p>}
          {saved && !saveError && (
            <p className="text-center text-[13px] font-semibold text-hf-green">{t("weightLog.saved")}</p>
          )}

          <button type="submit" disabled={saving} className="hf-btn-primary h-12 disabled:opacity-40">
            <span className="hf-type-button">{saving ? t("weightLog.saving") : t("weightLog.save")}</span>
          </button>
        </form>

        <Link href="/profile/weight-calibration" className="text-center text-[13px] font-semibold text-hf-black underline opacity-70">
          {t("weightLog.moreDetailsLink")}
        </Link>

        <div className="flex flex-col gap-2">
          {!loading && entries.length > 0 && (
            <p className="hf-type-caption px-1">{t("weightLog.recentTitle")}</p>
          )}
          {loading && <p className="text-center text-[13px] text-hf-black opacity-60">{t("weightLog.loading")}</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-[13px] text-hf-black opacity-60">{t("weightLog.noEntriesYet")}</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
              <p className="text-[16px] font-bold text-hf-black">
                {formatKg(entry.weightKg)} kg
                <span className="ml-2 text-[12px] font-normal opacity-60">{formatDateTime(entry.weighedAt)}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </HfScreen>
  );
}
