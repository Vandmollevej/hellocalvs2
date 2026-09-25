"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Settings → Visning → Anbefalede grænser: a single toggle for
// User.warnOnRecommendedLimits (src/lib/stat-cards.ts /
// StatCardsGrid.tsx). No thresholds are decided here — the toggle only
// controls whether a stat card that some future region/profile-aware
// recommendation evaluator has marked as out of range gets a 1 px dark-red
// stroke.
type DisplaySettingsUser = {
  warnOnRecommendedLimits: boolean;
};

export default function RecommendedLimitsSettingsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<DisplaySettingsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("profile");
        return (await response.json()) as { user: DisplaySettingsUser };
      })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setRecommendedLimitWarnings(value: boolean) {
    setUser((current) => (current ? { ...current, warnOnRecommendedLimits: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warnOnRecommendedLimits: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.recommendedLimits")}>
      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("settings.loading") : t("settings.loadError")}
        </p>
      ) : (
        <div className="hf-page">
          <Toggle
            label={t("displaySettings.warnOnRecommendedLimits")}
            description={t("displaySettings.warnOnRecommendedLimitsDescription")}
            checked={user.warnOnRecommendedLimits}
            onChange={setRecommendedLimitWarnings}
          />
        </div>
      )}
    </HfScreen>
  );
}
