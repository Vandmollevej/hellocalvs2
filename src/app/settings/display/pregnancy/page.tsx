"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";
import { PregnancyFields, type PregnancyPatch, type PregnancyValue } from "@/components/PregnancyFields";
import { currentBreastfeedingWeeks, currentPregnancyWeek } from "@/lib/pregnancy";

type ProfileFields = PregnancyValue & { pregnancyStatusUpdatedAt: string | null };

// Settings → Visning → Graviditet og amning (docs/DECISIONS.md 2026-10-14):
// kun i listen for sex = FEMALE (eller ukendt). Samme spørgsmål som i
// oprettelsesguiden; det gemte tal regnes frem til i dag, så feltet viser den
// aktuelle uge, og hver rettelse gælder fra i dag igen.
export default function PregnancyDisplaySettingsPage() {
  const { t } = useTranslation();
  const [value, setValue] = useState<PregnancyValue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { user: ProfileFields };
      })
      .then((data) => {
        if (cancelled) return;
        const user = data.user;
        const now = new Date();
        setValue({
          pregnancyStatus: user.pregnancyStatus ?? null,
          pregnancyWeek:
            user.pregnancyStatus === "PREGNANT" ? currentPregnancyWeek(user.pregnancyWeek, user.pregnancyStatusUpdatedAt, now) : null,
          breastfeedingWeeks:
            user.pregnancyStatus === "BREASTFEEDING"
              ? currentBreastfeedingWeeks(user.breastfeedingWeeks, user.pregnancyStatusUpdatedAt, now)
              : null,
        });
      })
      .catch(() => {
        if (!cancelled) setValue(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(patch: PregnancyPatch) {
    setValue((current) => (current ? { ...current, ...patch } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.pregnancy")}>
      <div className="hf-page">
        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("pregnancySettings.intro")}</p>
        </div>

        {loading || !value ? (
          <SkeletonScreen className="">
            <SkeletonToggle />
          </SkeletonScreen>
        ) : (
          <PregnancyFields value={value} onChange={update} question={t("pregnancySettings.question")} />
        )}
      </div>
    </HfScreen>
  );
}
