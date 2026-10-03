"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { IconCheck, IconMeat, IconRulerMeasure } from "@tabler/icons-react";
import { HfChevron } from "@/components/hf/HfChevron";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  formatGoalDate,
  formatGoalValue,
  goalCategories,
  goalTargetNameKey,
  upcomingGoals,
  type GoalTargetCategory,
} from "@/lib/goal-format";
import type { GoalDTO } from "@/lib/user-goals";

function localTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function CategoryIcon({ category }: { category: GoalTargetCategory }) {
  const { t } = useTranslation();
  const label = t(`goals.category.${category}`);
  const icon =
    category === "weight" ? (
      <IconBathScale size={20} />
    ) : category === "body" ? (
      <IconRulerMeasure size={20} />
    ) : (
      <IconMeat size={20} />
    );
  return (
    <span role="img" aria-label={label} className="flex h-5 w-5 items-center justify-center text-hf-black">
      {icon}
    </span>
  );
}

// Én bjælke pr. målsætning — samme geometri som AccordionSection (tan
// overskriftsrække, creme indhold). Ikonerne til venstre viser, hvad
// målsætningen omfatter; hvert target i dropdownen åbner redigering.
function UpcomingGoalBar({ goal }: { goal: GoalDTO }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <section className="overflow-hidden rounded-2xl bg-hf-tan">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="hf-control-row flex w-full items-center gap-2 px-4 text-left focus-visible:outline-2 focus-visible:outline-hf-black"
      >
        <span className="flex shrink-0 items-center gap-1.5">
          {goalCategories(goal).map((category) => (
            <CategoryIcon key={category} category={category} />
          ))}
        </span>
        <span className="hf-type-body hf-type-strong ml-1 flex-1 text-hf-black">
          {formatGoalDate(goal.targetDate as string)}
        </span>
        <HfChevron direction={open ? "down" : "right"} className="text-hf-black" />
      </button>
      <div id={panelId} hidden={!open} className="bg-hf-cream px-4">
        <div className="flex flex-col divide-y divide-hf-tan-dark">
          {goal.targets.map((target) => (
            <Link
              key={target.id}
              href={`/profile/goals/${goal.id}/edit?focus=${encodeURIComponent(target.type)}`}
              aria-label={t("goals.editTargetAria", { name: t(goalTargetNameKey(target.type)) })}
              className="hf-control-row flex items-center gap-3 text-hf-black"
            >
              <span className="hf-type-body flex-1 truncate">{t(goalTargetNameKey(target.type))}</span>
              {target.completedAt && (
                <IconCheck size={16} stroke={3} className="shrink-0 text-hf-green" aria-label={t("goals.completedAria")} />
              )}
              <span className="text-text-secondary hf-type-body">
                {formatGoalValue(target.value)} {target.unit}
              </span>
              <HfChevron className="text-hf-black" />
            </Link>
          ))}
          <Link href={`/profile/goals/${goal.id}`} className="hf-type-small hf-type-strong flex h-12 items-center text-hf-black underline">
            {t("goals.openGoal")}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function UpcomingGoalsList() {
  const { t } = useTranslation();
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
        if (!cancelled) setGoals(upcomingGoals(data.goals, localTodayIso()));
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

  if (loading || error || goals.length === 0) {
    return (
      <p className="text-text-secondary hf-type-body mx-auto max-w-xs px-4 py-4 text-center">
        {loading ? t("goals.loading") : error ? t("goals.loadError") : t("goals.upcomingEmpty")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {goals.map((goal) => (
        <UpcomingGoalBar key={goal.id} goal={goal} />
      ))}
    </div>
  );
}
