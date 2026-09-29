"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { EnergySummary } from "@/lib/activity-profile";

// Regnestykket "hvile + hverdag + motion = energibehov − mål = budget"
// (docs/ACTIVITY-PAL.md). Hver linje kan foldes ud med et "Hvorfor?", og
// alle tal er "ca." med interval — aldrig laboratorietal.

function formatKcal(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(Math.round(value / 10) * 10);
}

function formatPal(value: number) {
  return new Intl.NumberFormat("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

type LineKey = "rest" | "everyday" | "training" | "goal";

function Line({
  label,
  value,
  sign,
  why,
  strong,
}: {
  label: string;
  value: string;
  sign?: "+" | "−" | "=";
  why?: string;
  strong?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className={`w-4 text-text-secondary ${strong ? "hf-type-body hf-type-strong" : "hf-type-body"}`}>{sign ?? ""}</span>
        <span className={`flex-1 ${strong ? "hf-type-body hf-type-strong text-hf-black" : "hf-type-body text-hf-black"}`}>{label}</span>
        <span className={`tabular-nums ${strong ? "hf-type-body hf-type-strong text-hf-black" : "hf-type-body text-hf-black"}`}>{value}</span>
      </div>
      {why && (
        <div className="pl-6">
          <button type="button" className="hf-btn-text text-text-secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {t("energy.why")}
          </button>
          {open && <p className="hf-type-small text-text-secondary">{why}</p>}
        </div>
      )}
    </div>
  );
}

export function EnergyBreakdown({ summary }: { summary: EnergySummary }) {
  const { t } = useTranslation();
  const { bmr, pal, daily, budget, trainingAllowanceKcal, level } = summary;

  if (!daily || bmr === null || pal === null) {
    return (
      <div className="hf-card flex flex-col gap-2 rounded-xl bg-hf-tan p-4">
        <span className="hf-type-title text-hf-black">{t("energy.title")}</span>
        <p className="hf-type-body text-text-secondary">{t("energy.missingData")}</p>
        <ul className="hf-type-small text-text-secondary">
          {summary.missing.map((field) => (
            <li key={field}>· {t(`energy.missing.${field}`)}</li>
          ))}
        </ul>
      </div>
    );
  }

  const everydayKcal = daily.baselineKcal - bmr;
  const goalDelta = budget?.deltaKcal ?? 0;
  const lines: Record<LineKey, string> = {
    rest: t("energy.whyRest"),
    everyday: t("energy.whyEveryday", { pal: formatPal(pal), level: level ? t(`profile.activityLevel.${level}.label`) : "" }),
    training: t("energy.whyTraining"),
    goal: t("energy.whyGoal"),
  };

  return (
    <div className="hf-card flex flex-col gap-3 rounded-xl bg-hf-tan p-4">
      <span className="hf-type-title text-hf-black">{t("energy.title")}</span>
      <Line label={t("energy.rest")} value={`${t("energy.approx")} ${formatKcal(bmr)}`} why={lines.rest} />
      <Line label={t("energy.everyday")} value={formatKcal(everydayKcal)} sign="+" why={lines.everyday} />
      {trainingAllowanceKcal > 0 && (
        <Line label={t("energy.training")} value={formatKcal(trainingAllowanceKcal)} sign="+" why={lines.training} />
      )}
      <Line
        label={t("energy.need")}
        value={`${t("energy.approx")} ${formatKcal(daily.kcal)}`}
        sign="="
        strong
      />
      <p className="hf-type-small text-text-secondary">
        {t("energy.range", { low: formatKcal(daily.low), high: formatKcal(daily.high) })}
      </p>
      {budget && goalDelta !== 0 && (
        <>
          <Line label={t("energy.goal")} value={formatKcal(Math.abs(goalDelta))} sign={goalDelta < 0 ? "−" : "+"} why={lines.goal} />
          <Line label={t("energy.budget")} value={`${t("energy.approx")} ${formatKcal(budget.budgetKcal)}`} sign="=" strong />
        </>
      )}
      {budget && budget.adjustments.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg bg-hf-warning-bg p-3">
          {budget.adjustments.map((code) => (
            <p key={code} className="hf-type-small text-hf-warning">
              {t(`energy.adjustment.${code}`)}
            </p>
          ))}
        </div>
      )}
      <p className="hf-type-small text-text-secondary">{t("energy.disclaimer")}</p>
    </div>
  );
}
