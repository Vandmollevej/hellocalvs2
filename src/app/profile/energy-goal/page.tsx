"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { EnergyGoalPanel } from "@/components/EnergyGoalPanel";
import { useInWebShell } from "@/components/web/WebShell";
import { useTranslation } from "@/i18n/LocaleProvider";

// Kaloriemål: energibehov → budget (docs/ACTIVITY-PAL.md F6). Link fra
// Målsætning og fra startguidens sidste aktivitetsside. På desktop er det en
// dropdown på Målsætning — den gamle adresse sender derhen.
export default function EnergyGoalPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const inWebShell = useInWebShell();

  useEffect(() => {
    if (inWebShell) router.replace("/profile/goals?open=energy");
  }, [inWebShell, router]);

  if (inWebShell) return null;

  return (
    <HfScreen title={t("energyGoal.title")}>
      <div className="hf-page">
        <EnergyGoalPanel />
      </div>
    </HfScreen>
  );
}
