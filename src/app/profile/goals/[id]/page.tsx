"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { IconCheck } from "@tabler/icons-react";
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
import type { GoalDTO, GoalTargetDTO } from "@/lib/user-goals";
import { SkeletonCards, SkeletonScreen, SkeletonText } from "@/components/hf/Skeleton";

function GoalTargetRow({ target }: { target: GoalTargetDTO }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="hf-type-body hf-type-strong text-hf-black">{t(goalTargetNameKey(target.type))}</p>
        <p className="text-text-secondary hf-type-body">
          {formatGoalValue(target.value)} {target.unit}
        </p>
      </div>
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
  );
}

export default function GoalDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [goal, setGoal] = useState<GoalDTO | null>(null);
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
          setGoal(data.goal);
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

  return (
    <HfScreen title={t("goals.detailTitle")}>
      {status === "loading" ? (
        <SkeletonScreen>
          <SkeletonCards count={1} height={68} radius={16} />
          <SkeletonText lines={2} />
          <SkeletonCards count={2} height={120} gap={16} radius={16} />
        </SkeletonScreen>
      ) : status !== "ready" || !goal ? (
        <p className="text-text-secondary hf-type-body mx-auto max-w-xs px-8 pt-12 text-center">
          {status === "notFound" ? t("goals.notFound") : t("goals.loadError")}
        </p>
      ) : (
        <div className="hf-page">
          <div className="flex items-center gap-3 rounded-2xl border border-hf-tan-dark bg-hf-tan px-4 py-3 text-hf-black">
            <GoalDateSquare date={goalDisplayDate(goal)} completed={isGoalCompleted(goal)} />
            <div className="min-w-0">
              <p className="hf-type-body hf-type-strong">
                {isGoalCompleted(goal)
                  ? t("goals.completedAria")
                  : goal.targetDate
                    ? t("goals.targetDateLabel", { date: formatGoalDate(goal.targetDate) })
                    : t("goals.title")}
              </p>
              <p className="text-text-secondary hf-type-small">{t("goals.createdLabel", { date: formatGoalDate(goal.createdAt) })}</p>
            </div>
          </div>

          <div className="flex flex-col divide-y divide-hf-gray-border rounded-2xl bg-hf-tan px-4">
            {goal.targets.map((target) => (
              <GoalTargetRow key={target.id} target={target} />
            ))}
          </div>
        </div>
      )}
    </HfScreen>
  );
}
