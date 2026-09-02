"use client";

import { useEffect, useState } from "react";

type DailyLogPreference = "WORK_HOURS" | "SLEEP_TIMES";

type OnboardingUser = {
  onboardingStep: number;
  onboardingCompletedAt: string | null;
  onboardingRemindLaterAt: string | null;
  onboardingDismissed: boolean;
  shiftWorkEnabled: boolean;
  dailyLogPreference: DailyLogPreference | null;
  healthImportRequested: boolean;
  workHoursInCalendarEnabled: boolean;
};

// The order of steps the user can actually encounter. "Shift work" and
// "daily logging" are automatically skipped if the user answers that they
// have a regular sleep pattern. See docs/UI.md "Onboarding og hjælp" — only
// these steps are specified today; more can be added to the wizard later.
type StepId =
  | "sleep-pattern"
  | "shift-work"
  | "daily-log-preference"
  | "health-import"
  | "work-hours-calendar";

const ALL_STEPS: StepId[] = [
  "sleep-pattern",
  "shift-work",
  "daily-log-preference",
  "health-import",
  "work-hours-calendar",
];

function visibleSteps(hasRegularSleep: boolean | null, shiftWork: boolean | null): StepId[] {
  return ALL_STEPS.filter((step) => {
    if (step === "shift-work") return hasRegularSleep === false;
    if (step === "daily-log-preference") return hasRegularSleep === false && shiftWork === true;
    return true;
  });
}

export function OnboardingWizard() {
  const [user, setUser] = useState<OnboardingUser | null>(null);
  const [visible, setVisible] = useState(false);
  const [hasRegularSleep, setHasRegularSleep] = useState<boolean | null>(null);
  const [shiftWork, setShiftWork] = useState<boolean | null>(null);
  const [dailyLogPreference, setDailyLogPreference] = useState<DailyLogPreference | null>(null);
  const [workHoursInCalendar, setWorkHoursInCalendar] = useState<boolean | null>(null);
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
        setWorkHoursInCalendar(user.workHoursInCalendarEnabled || null);
        setCanDismissPermanently(Boolean(user.onboardingRemindLaterAt));

        const alreadyDone = Boolean(user.onboardingCompletedAt) || user.onboardingDismissed;
        if (!alreadyDone) setVisible(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

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
    }
  }

  function remindLater() {
    save({ onboardingRemindLaterAt: new Date().toISOString() });
    setVisible(false);
  }

  function dontShowAgain() {
    save({ onboardingDismissed: true });
    setVisible(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-hf-cream"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="px-5 pb-3 pt-9">
        <p className="text-center text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
          Trin {stepIndex + 1} af {totalSteps} gennemført
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hf-tan">
          <div
            className="h-full rounded-full bg-hf-green transition-all"
            style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-6 px-6">
        {currentStep === "sleep-pattern" && (
          <YesNoStep
            id="onboarding-title"
            question="Har du et fast søvnmønster?"
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
            question="Skyldes det varierende arbejdstider eller natarbejde?"
            value={shiftWork}
            onChange={(value) => {
              setShiftWork(value);
              save({ shiftWorkEnabled: value });
            }}
          />
        )}

        {currentStep === "daily-log-preference" && (
          <div className="flex flex-col gap-4">
            <h2 id="onboarding-title" className="hf-heading text-xl text-hf-black">
              Vil du registrere arbejdstider eller søvntider dagligt?
            </h2>
            <div className="flex flex-col gap-3">
              <ChoiceButton
                label="Arbejdstider"
                selected={dailyLogPreference === "WORK_HOURS"}
                onClick={() => {
                  setDailyLogPreference("WORK_HOURS");
                  save({ dailyLogPreference: "WORK_HOURS" });
                }}
              />
              <ChoiceButton
                label="Søvntider"
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
            <h2 id="onboarding-title" className="hf-heading text-xl text-hf-black">
              Vil du importere data fra din smartwatch eller sundhedsapp?
            </h2>
            <p className="text-[14px] text-hf-black opacity-70">
              Kan altid sættes op senere under personlige oplysninger.
            </p>
            <button
              onClick={() => {
                save({ healthImportRequested: true });
                goNext();
              }}
              className="hf-btn-primary w-full py-3.5 text-[15px]"
            >
              Opsæt nu
            </button>
          </div>
        )}

        {currentStep === "work-hours-calendar" && (
          <YesNoStep
            id="onboarding-title"
            question="Vil du kunne registrere arbejdstider direkte i kalenderen?"
            value={workHoursInCalendar}
            onChange={(value) => {
              setWorkHoursInCalendar(value);
              save({ workHoursInCalendarEnabled: value });
            }}
          />
        )}
      </div>

      <div className="flex flex-col gap-2 px-6 pb-8">
        <button onClick={goNext} className="hf-btn-primary w-full py-3.5 text-[15px]">
          Næste
        </button>
        <div className="flex justify-center gap-4 pt-1">
          <button
            onClick={remindLater}
            className="text-[13px] font-medium text-hf-black opacity-60"
          >
            Påmind mig senere
          </button>
          {canDismissPermanently && (
            <button
              onClick={dontShowAgain}
              className="text-[13px] font-medium text-hf-black opacity-60"
            >
              Vis ikke igen
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
  return (
    <div className="flex flex-col gap-4">
      <h2 id={id} className="hf-heading text-xl text-hf-black">
        {question}
      </h2>
      <div className="flex gap-3">
        <ChoiceButton label="Ja" selected={value === true} onClick={() => onChange(true)} />
        <ChoiceButton label="Nej" selected={value === false} onClick={() => onChange(false)} />
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
      className={`flex-1 rounded-xl px-4 py-3.5 text-[15px] font-semibold transition-colors ${
        selected ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black"
      }`}
    >
      {label}
    </button>
  );
}
