"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet, BottomSheetCloseButton, BottomSheetDots, useBottomSheetClose } from "@/components/hf/BottomSheet";
import { TermsSheet } from "@/components/hf/TermsSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import { ONBOARDING_TERMS } from "@/lib/terms-hints";

// Hvordan arket blev lukket — bestemmer hvad der gemmes, når glid-ud-
// animationen er færdig. Træk ned/scrim/Escape tæller som "Påmind mig senere".
type ExitReason = "remind" | "dismiss" | "complete";

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
  const exitRef = useRef<ExitReason>("remind");

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

  // Guiden vises i bundarket (KRAV.md "Bundark"): kaldes når arket er gledet ud.
  function handleSheetClosed() {
    const reason = exitRef.current;
    if (reason === "complete") save({ onboardingCompletedAt: new Date().toISOString() });
    else if (reason === "dismiss") save({ onboardingDismissed: true });
    else save({ onboardingRemindLaterAt: new Date().toISOString() });
    setVisible(false);
    onClose?.();
  }

  function goNext() {
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    save({ onboardingStep: nextIndex });
  }

  const isLastStep = stepIndex + 1 >= totalSteps;
  const progressLabel = t("onboarding.stepProgress", { current: stepIndex + 1, total: totalSteps });

  return (
    <BottomSheet
      size="full"
      ariaLabel={progressLabel}
      onClose={handleSheetClosed}
      footer={
        <>
          {currentStep && <TermsSheet key={currentStep} hint={ONBOARDING_TERMS[currentStep]} />}
          <div className="pb-4">
            <BottomSheetDots count={totalSteps} active={stepIndex} label={progressLabel} />
          </div>
          {isLastStep ? (
            <BottomSheetCloseButton
              onClick={() => (exitRef.current = "complete")}
              className="hf-control hf-btn-primary w-full"
            >
              {t("onboarding.next")}
            </BottomSheetCloseButton>
          ) : (
            <button type="button" onClick={goNext} className="hf-control hf-btn-primary w-full">
              {t("onboarding.next")}
            </button>
          )}
          <BottomSheetCloseButton onClick={() => (exitRef.current = "remind")} className="hf-bottom-sheet__skip">
            {t("onboarding.remindLater")}
          </BottomSheetCloseButton>
          {canDismissPermanently && (
            <BottomSheetCloseButton
              onClick={() => (exitRef.current = "dismiss")}
              className="hf-type-small hf-type-strong text-text-secondary h-10 w-full"
            >
              {t("onboarding.doNotShowAgain")}
            </BottomSheetCloseButton>
          )}
        </>
      }
    >
      <div className="flex min-h-full flex-col justify-center gap-8 px-4">
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
            <SetUpNowButton
              isLastStep={isLastStep}
              onSetUp={() => {
                save({ healthImportRequested: true });
                if (isLastStep) exitRef.current = "complete";
                else goNext();
              }}
            />
          </div>
        )}
      </div>

    </BottomSheet>
  );
}

// "Opsæt nu" på sidste trin fuldfører guiden og lukker arket med animation.
function SetUpNowButton({ isLastStep, onSetUp }: { isLastStep: boolean; onSetUp: () => void }) {
  const { t } = useTranslation();
  const close = useBottomSheetClose();
  return (
    <button
      type="button"
      onClick={() => {
        onSetUp();
        if (isLastStep) close();
      }}
      className="hf-control hf-btn-secondary w-full"
    >
      {t("onboarding.setUpNow")}
    </button>
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
      className={`hf-type-body hf-type-strong hf-control flex-1 rounded-xl px-4 transition-colors ${
        selected ? "hf-selected" : "bg-hf-tan text-hf-black"
      }`}
    >
      {label}
    </button>
  );
}
