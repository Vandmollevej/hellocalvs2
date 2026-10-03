"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { HfProgressStepper } from "@/components/hf/HfProgressStepper";
import { useTranslation } from "@/i18n/LocaleProvider";

type SetupProgressUser = {
  weightKg: number | null;
};

// Reuses the same "Step X of Y" + progress bar pattern as
// OnboardingWizard.tsx, per design.md §12 (reuse instead of inventing new style).
// Setup is considered complete once weight calibration has been done (at least
// one weigh-in) — see the weight-calibration page.
function SetupProgressBar({ weightSet }: { weightSet: boolean }) {
  const { t } = useTranslation();
  const steps = [
    t("settings.setupProgressStepRegion"),
    t("settings.setupProgressStepAllergens"),
    t("settings.setupProgressStepWeight"),
  ];
  const doneCount = weightSet ? steps.length : steps.length - 1;
  // Fælles HelloFresh-trinindikator (prik pr. trin, linjer med mellemrum,
  // label under hver prik) — samme komponent som på Profil.
  return (
    <div className="px-1 pb-1">
      <HfProgressStepper
        steps={steps}
        current={Math.min(doneCount, steps.length - 1)}
        progress={weightSet ? 1 : 0}
        label={t("settings.setupProgress", { done: doneCount, total: steps.length })}
      />
      {!weightSet && (
        <p className="text-text-secondary hf-type-small mt-2">{t("settings.setupProgressHint")}</p>
      )}
    </div>
  );
}

// Opsætning viser fremdriften. "Sprog og region" findes under Indstillinger og
// "Resultatvisning" under Indstillinger → Visning (ejerens valg 2026-10-03).
export default function ProfileSettingsPage() {
  const { t } = useTranslation();
  const [weightSet, setWeightSet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setWeightSet(Boolean((data.user as SetupProgressUser | undefined)?.weightKg));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HfScreen title={t("settings.setupTitle")}>
      <div className="flex flex-col gap-4 p-4">
        {!loading && <SetupProgressBar weightSet={weightSet} />}
      </div>
    </HfScreen>
  );
}
