"use client";

import { IconCheck, IconFlame } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

export type GoalStatusKind = "met" | "missed" | "none";

/**
 * Fælles statusblok under kalenderen (dag- og månedsvisning):
 * venstre: cirkel + kort status ("Inden for målet" / "Målet ikke opnået"),
 * højre, højrestillet: "Mål: X kcal", "Indtag: Y kcal" og — når der er
 * dyrket motion — en rød flamme med de kalorier, der kan lægges oven i
 * dagens mål. Blokken er bundjusteret, så statusteksten står ud for den
 * nederste linje i højre side (brugerkrav 2026-10-02).
 */
export function GoalStatusSummary({
  status,
  goalKcal,
  intakeKcal,
  bonusKcal = 0,
  className = "",
}: {
  /** `null` skjuler statuslinjen (fx fremtidige dage). */
  status: GoalStatusKind | null;
  goalKcal: number;
  intakeKcal: number;
  /** Forbrændte kalorier fra registreret motion (lægges oven i målet). */
  bonusKcal?: number;
  className?: string;
}) {
  const { t } = useTranslation();
  const bonus = Math.round(bonusKcal);

  return (
    <div className={`flex items-end justify-between gap-3 ${className}`.trim()}>
      {status !== null ? (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-full ${
              status === "met" ? "bg-hf-green" : status === "missed" ? "bg-hf-red-dark" : "bg-hf-gray"
            }`}
          >
            {status === "met" ? (
              <IconCheck size={13} stroke={3} className="text-hf-white" aria-hidden="true" />
            ) : (
              <span className="size-2 rounded-full bg-hf-white" aria-hidden="true" />
            )}
          </span>
          <p className="hf-type-body hf-type-strong min-w-0 text-hf-black">
            {status === "met"
              ? t("calendar.statusWithinGoal")
              : status === "missed"
                ? t("calendar.statusGoalNotMet")
                : t("calendar.statusNothingLogged")}
          </p>
        </div>
      ) : (
        <span aria-hidden="true" />
      )}

      <div className="shrink-0 space-y-0.5 text-right tabular-nums">
        <p className="hf-type-body whitespace-nowrap text-text-muted">
          {t("calendar.goalLabel", { goal: Math.round(goalKcal) })}
        </p>
        <p className="hf-type-body whitespace-nowrap text-hf-black">
          {t("calendar.intakeLabel", { amount: Math.round(intakeKcal) })}
        </p>
        {bonus > 0 && (
          <p className="hf-type-body flex items-center justify-end gap-1 whitespace-nowrap text-hf-black">
            <IconFlame size={16} className="shrink-0 text-hf-red-dark" aria-hidden="true" />
            <span>{t("calendar.exerciseBonus", { amount: bonus })}</span>
          </p>
        )}
      </div>
    </div>
  );
}
