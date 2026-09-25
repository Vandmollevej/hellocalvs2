"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { DateSeparator } from "@/components/hf/DateSeparator";
import { useTranslation } from "@/i18n/LocaleProvider";
import { BODY_MEASUREMENT_FIELDS } from "@/lib/body-measurements";
import type { GoalDTO, GoalTargetDTO } from "@/lib/user-goals";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", { day: "2-digit", month: "2-digit", year: "numeric" })
    .format(new Date(value))
    .replace(/[/-]/g, ".");
}

function formatValue(value: number) {
  return new Intl.NumberFormat("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
}

function targetNameKey(type: GoalTargetDTO["type"]) {
  if (type === "weight") return "goals.weight";
  return BODY_MEASUREMENT_FIELDS.find(({ field }) => field === type)?.nameKey ?? type;
}

function GoalTargetRow({ target }: { target: GoalTargetDTO }) {
  const { t } = useTranslation();
  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 text-[15px] font-semibold text-hf-black">{t(targetNameKey(target.type))}</p>
        {target.completedAt && (
          <span
            role="img"
            aria-label={t("goals.completedAria")}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-hf-green text-hf-white"
          >
            <IconCheck size={16} stroke={3} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[15px] text-hf-black opacity-60">
        {formatValue(target.value)} {target.unit}
      </p>
    </div>
  );
}

export default function GoalsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [goals, setGoals] = useState<GoalDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/goals")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente målsætninger");
        return (await response.json()) as { goals: GoalDTO[] };
      })
      .then((data) => {
        if (!cancelled) setGoals(data.goals);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HfScreen
      title={t("goals.title")}
      footer={
        <button
          type="button"
          onClick={() => router.push("/profile/goals/new")}
          className="hf-btn-primary hf-type-button h-12 w-full"
        >
          {t("goals.create")}
        </button>
      }
    >
      {loading || error || goals.length === 0 ? (
        <div className="flex h-full items-center justify-center px-8">
          <p className="max-w-xs text-center text-[15px] font-normal leading-6 text-hf-black opacity-60">
            {loading ? t("goals.loading") : error ? t("goals.loadError") : t("goals.empty")}
          </p>
        </div>
      ) : (
        <div className="hf-page">
          {goals.map((goal) => (
            <section key={goal.id} className="flex flex-col">
              <DateSeparator label={formatDate(goal.createdAt)} />
              {goal.targetDate && (
                <p className="pt-2 text-[13px] font-semibold text-hf-black opacity-60">
                  {t("goals.targetDateLabel", { date: formatDate(goal.targetDate) })}
                </p>
              )}
              <div className="flex flex-col divide-y divide-hf-gray-border pt-1">
                {goal.targets.map((target) => (
                  <GoalTargetRow key={target.id} target={target} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </HfScreen>
  );
}
