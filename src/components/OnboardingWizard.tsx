"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";

type DailyLogPreference = "WORK_HOURS" | "SLEEP_TIMES";

type OnboardingUser = {
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  onboardingRemindLaterAt: string | null;
  onboardingDismissed: boolean;
  shiftWorkEnabled: boolean;
  dailyLogPreference: DailyLogPreference | null;
  healthImportRequested: boolean;
};

// The order of steps the user can actually encounter. "Shift work" and
// "daily logging" are automatically skipped if the user answers that they
// have a regular sleep pattern. See docs/UI.md "Onboarding og hjælp" — only
// these steps are specified today; more can be added to the wizard later.
type StepId =
  | "sleep-pattern"
  | "shift-work"
  | "daily-log-preference"
  | "health-import";

const ALL_STEPS: StepId[] = [
  "sleep-pattern",
  "shift-work",
  "daily-log-preference",
  "health-import",
];

function visibleSteps(hasRegularSleep: boolean | null, shiftWork: boolean | null): StepId[] {
  return ALL_STEPS.filter((step) => {
    if (step === "shift-work") return hasRegularSleep === false;
    if (step === "daily-log-preference") return hasRegularSleep === false && shiftWork === true;
    return true;
  });
}

export function OnboardingWizard({
  forceVisible = false,
  onClose,
}: { forceVisible?: boolean; onClose?: () => void } = {}) {
  const { t } = useTranslation();
  const [user, setUser] = useState<OnboardingUser | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasRegularSleep, setHasRegularSleep] = useState<boolean | null>(null);
  const [shiftWork, setShiftWork] = useState<boolean | null>(null);
  const [dailyLogPreference, setDailyLogPreference] = useState<DailyLogPreference | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [canDismissPermanently, setCanDismissPermanently] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: OnboardingUser } | null) => {
        if (cancelled || !data) return;
        const { user } = data;
        setUser(user);
        setShiftWork(user.shiftWorkEnabled || null);
        setDailyLogPreference(user.dailyLogPreference);
        setCanDismissPermanently(Boolean(user.onboardingRemindLaterAt));

        const alreadyDone = Boolean(user.onboardingCompletedAt) || user.onboardingDismissed;
        if (!alreadyDone || forceVisible) setVisible(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [forceVisible]);

  if (!visible || !user) return null;

  const steps = visibleSteps(hasRegularSleep, shiftWork);
  const currentStep = steps[stepIndex];
  const totalSteps = steps.length;

  function save(data: Record<string, unknown>) {
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
  }

  function goNext() {
    if (stepIndex + 1 < steps.length) {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      save({ onboardingStep: nextIndex });
    } else {
      save({ onboardingCompletedAt: new Date().toISOString() });
      setVisible(false);
      onClose?.();
    }
  }

  function remindLater() {
    save({ onboardingRemindLaterAt: new Date().toISOString() });
    setVisible(false);
    onClose?.();
  }

  function dontShowAgain() {
    save({ onboardingDismissed: true });
    setVisible(false);
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-hf-cream"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="px-4 pb-4 pt-9">
        <p className="hf-type-small hf-type-strong text-text-secondary text-center uppercase tracking-[0.06em]">
          {t("onboarding.stepProgress", { current: stepIndex + 1, total: totalSteps })}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hf-tan">
          <div
            className="h-full rounded-full bg-hf-green transition-all"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-8 px-4">
        {currentStep === "sleep-pattern" && (
          <YesNoStep
            id="onboarding-title"
            question={t("onboarding.sleepPatternQuestion")}
            value={hasRegularSleep}
            onChange={(value) => {
              setHasRegularSleep(value);
              if (value) save({ shiftWorkEnabled: false, dailyLogPreference: null });
            }}
          />
        )}

        {currentStep === "shift-work" && (
          <YesNoStep
            id="onboarding-title"
            question={t("onboarding.shiftWorkQuestion")}
            value={shiftWork}
            onChange={(value) => {
              setShiftWork(value);
              save({ shiftWorkEnabled: value });
            }}
          />
        )}

        {currentStep === "daily-log-preference" && (
          <div className="flex flex-col gap-4">
            <h2 id="onboarding-title" className="hf-type-body-lg hf-heading text-hf-black">
              {t("onboarding.dailyLogQuestion")}
            </h2>
            <div className="flex flex-col gap-4">
              <ChoiceButton
                label={t("onboarding.workHours")}
                selected={dailyLogPreference === "WORK_HOURS"}
                onClick={() => {
                  setDailyLogPreference("WORK_HOURS");
                  save({ dailyLogPreference: "WORK_HOURS" });
                }}
              />
              <ChoiceButton
                label={t("onboarding.sleepTimes")}
                selected={dailyLogPreference === "SLEEP_TIMES"}
                onClick={() => {
                  setDailyLogPreference("SLEEP_TIMES");
                  save({ dailyLogPreference: "SLEEP_TIMES" });
                }}
              />
            </div>
          </div>
        )}

        {currentStep === "health-import" && (
          <div className="flex flex-col gap-4">
            <h2 id="onboarding-title" className="hf-type-body-lg hf-heading text-hf-black">
              {t("onboarding.healthImportQuestion")}
            </h2>
            <p className="hf-type-body text-text-secondary">
              {t("onboarding.healthImportHint")}
            </p>
            <button
              onClick={() => {
                save({ healthImportRequested: true });
                goNext();
              }}
              className="hf-btn-primary w-full py-3.5"
            >
              {t("onboarding.setUpNow")}
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 px-4 pb-8">
        <button onClick={goNext} className="hf-btn-primary w-full py-3.5">
          {t("onboarding.next")}
        </button>
        <div className="flex justify-center gap-4 pt-1">
          <button
            onClick={remindLater}
            className="hf-type-small hf-type-strong text-text-secondary"
          >
            {t("onboarding.remindLater")}
          </button>
          {canDismissPermanently && (
            <button
              onClick={dontShowAgain}
              className="hf-type-small hf-type-strong text-text-secondary"
            >
              {t("onboarding.doNotShowAgain")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function YesNoStep({
  id,
  question,
  value,
  onChange,
}: {
  id: string;
  question: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4">
      <h2 id={id} className="hf-type-body-lg hf-heading text-hf-black">
        {question}
      </h2>
      <div className="flex gap-3">
        <ChoiceButton label={t("onboarding.yes")} selected={value === true} onClick={() => onChange(true)} />
        <ChoiceButton label={t("onboarding.no")} selected={value === false} onClick={() => onChange(false)} />
      </div>
    </div>
  );
}

function ChoiceButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="hf-choice min-h-12 flex-1"
    >
      {label}
    </button>
  );
}
