"use client";

import { activitySummaryUrl } from "@/lib/daily-budget";
import { useEffect, useState } from "react";
import { EnergyGoalEditor, type EnergyGoalUser } from "@/components/EnergyGoalEditor";
import { SkeletonForm, SkeletonScreen } from "@/components/hf/Skeleton";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { EnergySummary } from "@/lib/activity-profile";

// Kaloriemål-indhold (intro + editor) uden skærmramme, så det både kan stå på
// /profile/energy-goal (mobil) og som dropdown på Målsætning (desktop).
export function EnergyGoalPanel() {
  const { t } = useTranslation();
  const [user, setUser] = useState<EnergyGoalUser | null>(null);
  const [summary, setSummary] = useState<EnergySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/profile").then((response) => (response.ok ? response.json() : null)),
      fetch(activitySummaryUrl()).then((response) => (response.ok ? response.json() : null)),
    ])
      .then(([profile, activity]: [{ user: EnergyGoalUser } | null, { summary: EnergySummary } | null]) => {
        if (cancelled) return;
        if (profile?.user) {
          const { goalMode, goalPaceKgPerWeek, targetWeightKg, weightKg, heightCm } = profile.user;
          setUser({ goalMode, goalPaceKgPerWeek, targetWeightKg, weightKg, heightCm });
        }
        if (activity) setSummary(activity.summary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="hf-type-body text-text-secondary">{t("energyGoal.intro")}</p>
      {user ? (
        <EnergyGoalEditor
          user={user}
          summary={summary}
          onChange={(nextUser, nextSummary) => {
            setUser(nextUser);
            if (nextSummary) setSummary(nextSummary);
          }}
        />
      ) : (
        <SkeletonScreen className="">
          <SkeletonForm />
        </SkeletonScreen>
      )}
    </div>
  );
}
