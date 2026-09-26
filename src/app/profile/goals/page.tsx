"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconChevronRight, IconPlus } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { GoalDateSquare } from "@/components/hf/GoalDateSquare";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  formatGoalDate,
  formatGoalValue,
  goalDisplayDate,
  goalTargetNameKey,
  isGoalCompleted,
} from "@/lib/goal-format";
import type { GoalDTO } from "@/lib/user-goals";

function GoalRow({ goal, onOpen }: { goal: GoalDTO; onOpen: () => void }) {
  const { t } = useTranslation();
  const completed = isGoalCompleted(goal);
  const summary = goal.targets
    .map((target) => `${t(goalTargetNameKey(target.type))} ${formatGoalValue(target.value)} ${target.unit}`)
    .join(" · ");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[66px] w-full items-center gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 py-3 text-left text-hf-black focus-visible:outline-2 focus-visible:outline-hf-black"
    >
      <GoalDateSquare date={goalDisplayDate(goal)} completed={completed} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="hf-type-body hf-type-strong line-clamp-2">{summary}</span>
        <span className="hf-type-small flex items-center gap-1 opacity-60">
          {completed && <IconCheck size={14} stroke={3} className="shrink-0 text-hf-green" aria-hidden="true" />}
          {completed
            ? t("goals.completedAria")
            : goal.targetDate
              ? t("goals.targetDateLabel", { date: formatGoalDate(goal.targetDate) })
              : t("goals.createdLabel", { date: formatGoalDate(goal.createdAt) })}
        </span>
      </span>
      <IconChevronRight size={19} className="shrink-0" aria-hidden="true" />
    </button>
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
    <HfScreen title={t("goals.title")}>
      <div className="hf-page">
        {/* Kun omkreds — baggrunden er sidens egen cremefarve. */}
        <button
          type="button"
          onClick={() => router.push("/profile/goals/new")}
          className="hf-btn-secondary hf-type-button h-12 w-full gap-2"
        >
          <IconPlus size={18} stroke={2.5} aria-hidden="true" />
          {t("goals.createSubGoal")}
        </button>

        {loading || error || goals.length === 0 ? (
          <p className="hf-type-body mx-auto max-w-xs px-4 pt-8 text-center text-hf-black opacity-60">
            {loading ? t("goals.loading") : error ? t("goals.loadError") : t("goals.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {goals.map((goal) => (
              <GoalRow key={goal.id} goal={goal} onOpen={() => router.push(`/profile/goals/${goal.id}`)} />
            ))}
          </div>
        )}
      </div>
    </HfScreen>
  );
}
