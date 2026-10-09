"use client";

import { IconCheck, IconFlame } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

export type GoalStatusKind = "met" | "missed" | "none";

/**
 * Fælles statusblok under kalenderen (dag- og månedsvisning), oppefra og ned
 * (brugerkrav 2026-10-02, rettet 2026-10-03):
 *   1. Højrestillet: rød flamme + grøn "+ N kcal" (kun når der er registreret
 *      motion — kalorierne lægges oven i målet).
 *   2. Én række: statusbjælken til venstre (cirkel + "Inden for målet" /
 *      "Målet ikke opnået" / "Intet registreret") og "Mål: X kcal" til højre.
 *      De to SKAL stå i samme flex-række — aldrig som separate blokke under
 *      hinanden, så status forskydes en linje ned (brugerkrav 2026-10-03).
 *   3. Højrestillet under rækken: "Tilbage for i dag: N kcal" eller, ved
 *      overskridelse, "Overskredet med N kcal" i rødt.
 * "Tilbage"/"overskredet" regnes mod mål + motion.
 */
export function GoalStatusSummary({
  status,
  goalKcal,
  intakeKcal,
  bonusKcal = 0,
  period = "day",
  showTotals = true,
  className = "",
}: {
  /** `null` skjuler statusbjælken (fx fremtidige dage). */
  status: GoalStatusKind | null;
  /** Dagens/periodens kaloriemål uden motion. */
  goalKcal: number;
  intakeKcal: number;
  /** Forbrændte kalorier fra registreret motion (lægges oven i målet). */
  bonusKcal?: number;
  period?: "day" | "month";
  /** `false`: kun statusbjælken — ingen mål, motion eller "tilbage" (periodevisning). */
  showTotals?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const bonus = Math.round(bonusKcal);
  const remaining = Math.round(goalKcal + bonusKcal - intakeKcal);

  return (
    <div className={`space-y-1 ${className}`.trim()}>
      {showTotals && bonus > 0 && (
        <p className="hf-type-body flex items-center justify-end gap-1 whitespace-nowrap text-right tabular-nums text-hf-green">
          <IconFlame size={16} className="shrink-0 text-hf-red-dark" aria-hidden="true" />
          <span>{t("calendar.exerciseBonus", { amount: bonus })}</span>
        </p>
      )}

      {/* Status og "Mål" deler bevidst én række — se kommentaren øverst. */}
      <div className="flex items-center justify-between gap-3">
        {status !== null ? (
          <div className="flex min-w-0 items-center gap-2 text-left">
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
        {showTotals && (
          <p className="hf-type-body shrink-0 whitespace-nowrap text-right tabular-nums text-text-muted">
            {t("calendar.goalLabel", { goal: Math.round(goalKcal) })}
          </p>
        )}
      </div>

      {!showTotals ? null : remaining >= 0 ? (
        <p className="hf-type-body whitespace-nowrap text-right tabular-nums text-hf-black">
          {t(period === "month" ? "calendar.remainingMonth" : "calendar.remainingToday", { amount: remaining })}
        </p>
      ) : (
        <p className="hf-type-body hf-type-strong whitespace-nowrap text-right tabular-nums text-hf-red-dark">
          {t("calendar.exceededCalories", { amount: Math.abs(remaining) })}
        </p>
      )}
    </div>
  );
}
