"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { EnergySummary } from "@/lib/activity-profile";
import { EnergyBreakdown } from "@/components/EnergyBreakdown";
import { GAIN_PACES_KG_PER_WEEK, GOAL_MODES, LOSS_PACES_KG_PER_WEEK, maxLossPace, type GoalMode } from "@/lib/energy-budget";

// Kaloriemål (docs/ACTIVITY-PAL.md "Kaloriemål"): målform, tempo og målvægt.
// Sundhedsgrænserne ligger i energy-budget.ts — her vises kun, hvad de
// betyder (tempo uden for grænsen kan ikke vælges, og budgettet forklarer
// hver justering). Gemmer straks (ingen Gem-knap, som resten af profilen).

export type EnergyGoalUser = {
  goalMode: GoalMode | null;
  goalPaceKgPerWeek: number | null;
  targetWeightKg: number | null;
  weightKg: number | null;
  heightCm: number | null;
};

function formatKg(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function EnergyGoalEditor({
  user,
  summary,
  onChange,
}: {
  user: EnergyGoalUser;
  summary: EnergySummary | null;
  onChange: (user: EnergyGoalUser, summary: EnergySummary | null) => void;
}) {
  const { t } = useTranslation();
  const [targetInput, setTargetInput] = useState(user.targetWeightKg?.toString() ?? "");
  const mode = user.goalMode ?? "MAINTAIN";
  const paceCap = maxLossPace({ weightKg: user.weightKg, heightCm: user.heightCm });

  async function save(patch: Partial<EnergyGoalUser>) {
    const next = { ...user, ...patch };
    onChange(next, summary);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const response = await fetch("/api/profile/activity");
      if (response.ok) {
        const data = (await response.json()) as { summary: EnergySummary };
        onChange(next, data.summary);
      }
    } catch {
      // Netværksfejl: valget står i UI'et og gemmes ved næste ændring.
    }
  }

  const budget = summary?.budget ?? null;
  const weeks = budget?.weeksToTarget ?? null;
  const dateRange =
    weeks !== null && weeks > 0
      ? (() => {
          const now = new Date();
          const early = new Date(now.getTime() + Math.round(weeks * 0.8) * 7 * 24 * 3600 * 1000);
          const late = new Date(now.getTime() + Math.ceil(weeks * 1.25) * 7 * 24 * 3600 * 1000);
          return { early, late };
        })()
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="hf-type-label text-text-secondary">{t("energyGoal.mode")}</span>
        <div className="grid grid-cols-3 gap-2">
          {GOAL_MODES.map((key) => (
            <button
              key={key}
              type="button"
              className="hf-choice hf-control"
              aria-pressed={mode === key}
              onClick={() => void save({ goalMode: key, goalPaceKgPerWeek: key === "MAINTAIN" ? null : user.goalPaceKgPerWeek })}
            >
              {t(`energyGoal.modes.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {mode !== "MAINTAIN" && (
        <>
          <div className="flex flex-col gap-2">
            <span className="hf-type-label text-text-secondary">{t("energyGoal.pace")}</span>
            <div className="grid grid-cols-3 gap-2">
              {(mode === "LOSE" ? LOSS_PACES_KG_PER_WEEK : GAIN_PACES_KG_PER_WEEK).map((pace) => {
                const blocked = mode === "LOSE" && pace > paceCap + 1e-9;
                return (
                  <button
                    key={pace}
                    type="button"
                    className="hf-choice hf-control"
                    aria-pressed={(user.goalPaceKgPerWeek ?? 0) === pace}
                    disabled={blocked}
                    onClick={() => void save({ goalPaceKgPerWeek: pace })}
                  >
                    {t("energyGoal.paceValue", { kg: formatKg(pace) })}
                  </button>
                );
              })}
            </div>
            <p className="hf-type-small text-text-secondary">
              {mode === "LOSE" ? t("energyGoal.paceHintLose", { kg: formatKg(paceCap) }) : t("energyGoal.paceHintGain")}
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span className="hf-type-label text-text-secondary">{t("energyGoal.targetWeight")}</span>
            <input
              className="hf-field"
              type="number"
              inputMode="decimal"
              min={20}
              step={0.5}
              value={targetInput}
              onChange={(event) => setTargetInput(event.target.value)}
              onBlur={() => {
                const value = Number(targetInput.replace(",", "."));
                void save({ targetWeightKg: value > 0 ? value : null });
              }}
            />
            {budget?.targetWeightKg !== null && budget?.targetWeightKg !== undefined && user.targetWeightKg !== null && budget.targetWeightKg !== user.targetWeightKg && (
              <span className="hf-type-small text-hf-warning">{t("energyGoal.targetRaised", { kg: formatKg(budget.targetWeightKg) })}</span>
            )}
          </label>

          {dateRange && (
            <p className="hf-type-body text-hf-black">
              {t("energyGoal.eta", { weeks: weeks ?? 0, from: formatDate(dateRange.early), to: formatDate(dateRange.late) })}
            </p>
          )}
        </>
      )}

      {summary && <EnergyBreakdown summary={summary} />}
      <p className="hf-type-small text-text-secondary">{t("energyGoal.disclaimer")}</p>
    </div>
  );
}
