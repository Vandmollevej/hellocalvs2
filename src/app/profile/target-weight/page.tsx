"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

export default function TargetWeightPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as { user: { targetWeightKg: number | null } };
      })
      .then((data) => {
        if (!cancelled && data.user.targetWeightKg !== null) {
          setTargetWeightKg(String(data.user.targetWeightKg));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Gemmer automatisk ved blur, samme mønster som vægt-kalibrering-siden —
  // ingen synlig "Gem"-knap, jf. design.md.
  async function save() {
    const trimmed = targetWeightKg.replace(",", ".");
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && (!parsed || parsed <= 0)) return;

    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetWeightKg: parsed }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <HfScreen title={t("targetWeight.title")} onBack={() => router.back()}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("targetWeight.intro")}</p>
        </div>

        {loading ? (
          <p className="text-center text-[13px] text-hf-black opacity-60">{t("targetWeight.loading")}</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
            <label className="flex items-end gap-2 border-b border-hf-black/30 pb-1.5">
              <input
                type="number"
                inputMode="decimal"
                value={targetWeightKg}
                onChange={(event) => setTargetWeightKg(event.target.value)}
                onBlur={() => save()}
                className="w-full bg-transparent text-[17px] text-hf-black outline-none"
                placeholder={t("targetWeight.weightPlaceholder")}
              />
              <span className="pb-0.5 text-[13px] font-semibold text-hf-black opacity-60">kg</span>
            </label>
            {saving && (
              <p className="text-center text-[11px] text-hf-black opacity-50">{t("targetWeight.saving")}</p>
            )}
          </div>
        )}
      </div>
    </HfScreen>
  );
}
