"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n/LocaleProvider";
import { EnergyBreakdown } from "@/components/EnergyBreakdown";
import type { EnergySummary } from "@/lib/activity-profile";
import {
  ACTIVITY_LEVEL_KEYS,
  STEP_BANDS,
  TRAINING_INTENSITIES,
  TRANSPORT_TYPES,
  WALK_STAND_HOURS,
  WORK_TYPES,
  levelDistance,
  type ActivityAnswers,
  type ActivityLevelKey,
} from "@/lib/pal-model";

// Aktivitetsdelen af startguiden (docs/ACTIVITY-PAL.md): én side pr.
// spørgsmål inde i guidens trin, "Ved ikke" altid muligt, og til sidst
// regnestykket med forslag til niveau, som brugeren kan rette selv.

export const ACTIVITY_PAGES = ["intro", "work", "walkStand", "transport", "steps", "training", "intensity", "result"] as const;
export type ActivityPage = (typeof ACTIVITY_PAGES)[number];

export const EMPTY_ACTIVITY_ANSWERS: ActivityAnswers = {
  version: 1,
  work: null,
  walkStand: null,
  transport: null,
  steps: null,
  training: null,
};

const SESSIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
const MINUTES = [15, 30, 45, 60, 90] as const;

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`hf-type-body hf-type-strong hf-control w-full rounded-xl px-4 text-left transition-colors ${
        selected ? "hf-selected" : "bg-hf-tan text-hf-black"
      }`}
    >
      {label}
    </button>
  );
}

function Question({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 id={id} className="hf-type-body-lg hf-heading text-hf-black">
        {title}
      </h2>
      {hint && <p className="hf-type-body text-text-secondary">{hint}</p>}
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

export function ActivityStep({
  page,
  answers,
  onChange,
  summary,
  suggestedLevel,
  onPickLevel,
}: {
  page: ActivityPage;
  answers: ActivityAnswers;
  onChange: (answers: ActivityAnswers) => void;
  summary: EnergySummary | null;
  suggestedLevel: ActivityLevelKey | null;
  onPickLevel: (level: ActivityLevelKey) => void;
}) {
  const { t } = useTranslation();
  const training = answers.training ?? { sessionsPerWeek: 0, sessionMinutes: 45, intensity: null };
  const setTraining = (patch: Partial<typeof training>) => {
    const next = { ...training, ...patch };
    onChange({ ...answers, training: next.sessionsPerWeek > 0 ? next : null });
  };

  if (page === "intro") {
    return (
      <div className="flex flex-col gap-4">
        <h2 id="onboarding-title" className="hf-type-body-lg hf-heading text-hf-black">
          {t("onboarding.activity.introTitle")}
        </h2>
        <p className="hf-type-body text-text-secondary">{t("onboarding.activity.introBody")}</p>
        <p className="hf-type-body text-text-secondary">{t("onboarding.activity.introNoDouble")}</p>
      </div>
    );
  }

  if (page === "work") {
    return (
      <Question id="onboarding-title" title={t("onboarding.activity.workQuestion")}>
        {WORK_TYPES.map((key) => (
          <Choice key={key} label={t(`onboarding.activity.work.${key}`)} selected={answers.work === key} onClick={() => onChange({ ...answers, work: key })} />
        ))}
      </Question>
    );
  }

  if (page === "walkStand") {
    return (
      <Question id="onboarding-title" title={t("onboarding.activity.walkStandQuestion")} hint={t("onboarding.activity.walkStandHint")}>
        {WALK_STAND_HOURS.map((key) => (
          <Choice key={key} label={t(`onboarding.activity.walkStand.${key}`)} selected={answers.walkStand === key} onClick={() => onChange({ ...answers, walkStand: key })} />
        ))}
      </Question>
    );
  }

  if (page === "transport") {
    return (
      <Question id="onboarding-title" title={t("onboarding.activity.transportQuestion")}>
        {TRANSPORT_TYPES.map((key) => (
          <Choice key={key} label={t(`onboarding.activity.transport.${key}`)} selected={answers.transport === key} onClick={() => onChange({ ...answers, transport: key })} />
        ))}
      </Question>
    );
  }

  if (page === "steps") {
    return (
      <Question id="onboarding-title" title={t("onboarding.activity.stepsQuestion")} hint={t("onboarding.activity.stepsHint")}>
        {STEP_BANDS.map((key) => (
          <Choice key={key} label={t(`onboarding.activity.steps.${key}`)} selected={answers.steps === key} onClick={() => onChange({ ...answers, steps: key, stepsMeasured: false })} />
        ))}
        <Choice label={t("onboarding.activity.dontKnow")} selected={answers.steps === null} onClick={() => onChange({ ...answers, steps: null, stepsMeasured: false })} />
        <Link href="/settings/integrations" className="hf-btn-text self-center text-text-secondary">
          {t("onboarding.activity.viaIntegration")}
        </Link>
      </Question>
    );
  }

  if (page === "training") {
    return (
      <Question id="onboarding-title" title={t("onboarding.activity.trainingQuestion")} hint={t("onboarding.activity.trainingHint")}>
        <span className="hf-type-label text-text-secondary">{t("onboarding.activity.sessionsPerWeek")}</span>
        <div className="grid grid-cols-4 gap-2">
          {SESSIONS.map((n) => (
            <button key={n} type="button" className="hf-choice hf-control" aria-pressed={training.sessionsPerWeek === n} onClick={() => setTraining({ sessionsPerWeek: n })}>
              {n === 7 ? "7+" : n}
            </button>
          ))}
        </div>
        {training.sessionsPerWeek > 0 && (
          <>
            <span className="hf-type-label text-text-secondary">{t("onboarding.activity.sessionMinutes")}</span>
            <div className="grid grid-cols-5 gap-2">
              {MINUTES.map((m) => (
                <button key={m} type="button" className="hf-choice hf-control" aria-pressed={training.sessionMinutes === m} onClick={() => setTraining({ sessionMinutes: m })}>
                  {m === 90 ? "90+" : m}
                </button>
              ))}
            </div>
          </>
        )}
      </Question>
    );
  }

  if (page === "intensity") {
    return (
      <Question id="onboarding-title" title={t("onboarding.activity.intensityQuestion")} hint={t("onboarding.activity.intensityHint")}>
        {TRAINING_INTENSITIES.map((key) => (
          <Choice key={key} label={t(`onboarding.activity.intensity.${key}`)} selected={training.intensity === key} onClick={() => setTraining({ intensity: key })} />
        ))}
      </Question>
    );
  }

  // Resultat: foreslået niveau, regnestykke og mulighed for at rette selv.
  const chosen = summary?.level ?? null;
  const farFromSuggestion = chosen && suggestedLevel ? levelDistance(chosen, suggestedLevel) > 1 : false;
  return (
    <div className="flex flex-col gap-4">
      <h2 id="onboarding-title" className="hf-type-body-lg hf-heading text-hf-black">
        {t("onboarding.activity.resultTitle")}
      </h2>
      {suggestedLevel && (
        <p className="hf-type-body text-hf-black">
          {t("onboarding.activity.resultSuggested", { level: t(`profile.activityLevel.${suggestedLevel}.label`) })}
        </p>
      )}
      {summary ? <EnergyBreakdown summary={summary} /> : <p className="hf-type-body text-text-secondary">{t("onboarding.activity.calculating")}</p>}
      <div className="flex flex-col gap-2">
        <span className="hf-type-label text-text-secondary">{t("onboarding.activity.adjustLevel")}</span>
        <div className="grid grid-cols-5 gap-2">
          {ACTIVITY_LEVEL_KEYS.map((level) => (
            <button key={level} type="button" className="hf-choice hf-control" aria-pressed={chosen === level} onClick={() => onPickLevel(level)}>
              {t(`profile.activityLevel.${level}.short`)}
            </button>
          ))}
        </div>
        {chosen && <p className="hf-type-small text-text-secondary">{t(`profile.activityLevel.${chosen}.description`)}</p>}
        {farFromSuggestion && <p className="hf-type-small text-hf-warning">{t("onboarding.activity.farFromSuggestion")}</p>}
        <p className="hf-type-small text-text-secondary">{t("onboarding.activity.stepsAreExamples")}</p>
      </div>
    </div>
  );
}
