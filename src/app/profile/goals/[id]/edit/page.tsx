"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { GoalForm, emptyGoalFormValues, type GoalFormValues } from "@/components/hf/GoalForm";
import { useTranslation } from "@/i18n/LocaleProvider";
import { isBodyMeasurementField } from "@/lib/body-measurements";
import type { GoalDTO } from "@/lib/user-goals";

// Tal → formularens tekstformat (dansk decimalkomma).
function toInput(value: number) {
  return String(value).replace(".", ",");
}

function toFormValues(goal: GoalDTO): GoalFormValues {
  const values = emptyGoalFormValues();
  values.targetDate = goal.targetDate ?? "";
  for (const target of goal.targets) {
    if (target.type === "weight") values.weight = toInput(target.value);
    else if (isBodyMeasurementField(target.type)) values.measurements[target.type] = toInput(target.value);
  }
  return values;
}

export default function EditGoalPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  // ?focus=weight|waistCm|… — feltet, brugeren klikkede på i oversigten.
  const focus = useSearchParams().get("focus");
  const [initial, setInitial] = useState<GoalFormValues | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "notFound" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/goals/${encodeURIComponent(id)}`)
      .then(async (response) => {
        if (response.status === 404) {
          if (!cancelled) setStatus("notFound");
          return;
        }
        if (!response.ok) throw new Error("Kunne ikke hente målsætningen");
        const data = (await response.json()) as { goal: GoalDTO };
        if (!cancelled) {
          setInitial(toFormValues(data.goal));
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function update(targetDate: string, targets: Record<string, number>) {
    const response = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDate, targets }),
    });
    if (!response.ok) throw new Error("Kunne ikke gemme målsætning");
    // Tilbage til siden, der åbnede redigeringen; den henter igen ved mount.
    router.back();
  }

  if (status !== "ready" || !initial) {
    return (
      <HfScreen title={t("goals.editTitle")}>
        <p className="text-text-secondary hf-type-body mx-auto max-w-xs px-8 pt-12 text-center">
          {status === "loading" ? t("goals.loading") : status === "notFound" ? t("goals.notFound") : t("goals.loadError")}
        </p>
      </HfScreen>
    );
  }

  return <GoalForm title={t("goals.editTitle")} initial={initial} focus={focus} onSubmit={update} />;
}
