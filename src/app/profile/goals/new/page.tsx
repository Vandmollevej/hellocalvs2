"use client";

import { useRouter } from "next/navigation";
import { GoalForm, emptyGoalFormValues } from "@/components/hf/GoalForm";
import { useTranslation } from "@/i18n/LocaleProvider";

export default function NewGoalPage() {
  const { t } = useTranslation();
  const router = useRouter();

  async function create(targetDate: string, targets: Record<string, number>) {
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDate, targets }),
    });
    if (!response.ok) throw new Error("Kunne ikke gemme målsætning");
    // Tilbage til oversigten (som åbnede formularen), så der ikke opstår et
    // navigationsloop; oversigten henter listen igen ved mount.
    router.back();
  }

  return <GoalForm title={t("goals.createSubGoal")} initial={emptyGoalFormValues()} onSubmit={create} />;
}
