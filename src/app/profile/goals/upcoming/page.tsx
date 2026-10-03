"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { UpcomingGoalsList } from "@/components/UpcomingGoalsList";
import { useInWebShell } from "@/components/web/WebShell";
import { useTranslation } from "@/i18n/LocaleProvider";

// På desktop er Kommende mål en dropdown på Målsætning — den gamle adresse
// sender derhen.
export default function UpcomingGoalsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const inWebShell = useInWebShell();

  useEffect(() => {
    if (inWebShell) router.replace("/profile/goals?open=upcoming");
  }, [inWebShell, router]);

  if (inWebShell) return null;

  return (
    <HfScreen title={t("goals.upcomingTitle")}>
      <div className="p-4">
        <UpcomingGoalsList />
      </div>
    </HfScreen>
  );
}
