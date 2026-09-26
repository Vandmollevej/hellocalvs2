"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

type ProfileFlags = {
  sex: "FEMALE" | "MALE" | null;
  cycleTrackingEnabled: boolean;
};

// Settings → Visning → Menstruationscyklus (docs/DECISIONS.md 2026-09-19):
// only reachable from the settings list when sex = FEMALE. The single
// "Vis menstruationscyklus" toggle is what makes "Menstruation" appear in the
// shared add-menu (src/lib/add-actions.ts) — off by default, same "never a
// visible-by-default extra" convention as showAllergens/showExtendedNutrition.
export default function MenstrualCycleDisplaySettingsPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ProfileFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { user: ProfileFlags };
      })
      .then((data) => {
        if (!cancelled) setProfile(data.user);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(value: boolean) {
    setProfile((current) => (current ? { ...current, cycleTrackingEnabled: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cycleTrackingEnabled: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.menstrualCycle")}>
      <div className="hf-page">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("menstrualCycleSettings.intro")}</p>
        </div>

        {loading || !profile ? (
          <p className="text-center text-[14px] text-hf-black opacity-60">{t("profile.loading")}</p>
        ) : (
          <Toggle
            checked={profile.cycleTrackingEnabled}
            onChange={toggle}
            label={t("menstrualCycleSettings.toggleLabel")}
            description={t("menstrualCycleSettings.toggleDescription")}
          />
        )}
      </div>
    </HfScreen>
  );
}
