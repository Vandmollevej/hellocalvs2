"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActionButton } from "@/components/hf/ActionButton";
import { HfProgressStepper } from "@/components/hf/HfProgressStepper";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { ScreeningInput } from "@/components/screenings/ScreeningInput";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  SCREENING_FREQUENCIES,
  SCREENING_INPUT_TYPES,
  SCREENING_MAX_QUESTIONS,
  SCREENING_SCALES,
  type ScreeningDto,
  type ScreeningFrequency,
  type ScreeningInputType,
  type ScreeningScale,
} from "@/lib/screenings";

// "Opret ny screening" er et flow (docs/DECISIONS.md 2026-10-09): navn og
// formål → frekvens → spørgsmål → notifikationer → måling (skala, felt, note,
// laveste/højeste værdi) → kalender. Samme flow redigerer en eksisterende.
const STEPS = ["stepName", "stepFrequency", "stepQuestions", "stepNotifications", "stepMeasure", "stepCalendar"] as const;

type Draft = Omit<ScreeningDto, "id" | "presetKey" | "sortOrder" | "active">;

function newQuestionId() {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function emptyDraft(): Draft {
  return {
    name: "",
    purpose: "",
    frequency: "DAILY",
    questions: [{ id: newQuestionId(), text: "" }],
    notificationsEnabled: false,
    notificationTime: "20:00",
    scale: "TEN",
    inputType: "SLIDER",
    notesEnabled: true,
    minLabel: "",
    maxLabel: "",
    showInCalendar: false,
  };
}

export function ScreeningFlow({ existing }: { existing?: ScreeningDto }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? { ...existing, notificationTime: existing.notificationTime ?? "20:00" } : emptyDraft(),
  );
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const questionTexts = draft.questions.map((q) => q.text.trim());
  const canContinue =
    step === 0 ? draft.name.trim().length > 0 : step === 2 ? questionTexts.some((text) => text.length > 0) : true;
  const last = step === STEPS.length - 1;

  async function save() {
    setSaving(true);
    setError(false);
    const body = {
      ...draft,
      name: draft.name.trim(),
      notificationTime: draft.notificationsEnabled ? draft.notificationTime : null,
      questions: draft.questions.filter((q) => q.text.trim()),
    };
    const response = await fetch(existing ? `/api/screenings/${existing.id}` : "/api/screenings", {
      method: existing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (response?.ok) router.replace("/profile/screenings");
    else setError(true);
  }

  function back() {
    if (step === 0) router.back();
    else setStep(step - 1);
  }

  return (
    <HfScreen
      title={existing ? t("screenings.editTitle") : t("screenings.newTitle")}
      onBack={back}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="hf-type-small text-center text-hf-red-dark">{t("screenings.saveError")}</p>}
          <ActionButton
            className="h-12 px-4"
            disabled={!canContinue || saving}
            onClick={() => (last ? save() : setStep(step + 1))}
          >
            {last ? (saving ? t("screenings.saving") : t("screenings.save")) : t("screenings.next")}
          </ActionButton>
        </div>
      }
    >
      <div className="hf-page">
        <HfProgressStepper
          steps={STEPS.map((key) => t(`screenings.${key}`))}
          current={step}
          progress={0}
          label={t("screenings.stepAria")}
        />

        {step === 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="hf-type-section-title">{t("screenings.nameTitle")}</h2>
            <TextField
              variant="standard"
              label={t("screenings.nameLabel")}
              placeholder={t("screenings.namePlaceholder")}
              value={draft.name}
              maxLength={60}
              onChange={(event) => update({ name: event.target.value })}
            />
            <label className="flex flex-col gap-1">
              <span className="hf-type-label">{t("screenings.purposeLabel")}</span>
              <textarea
                value={draft.purpose}
                maxLength={300}
                rows={3}
                placeholder={t("screenings.purposePlaceholder")}
                onChange={(event) => update({ purpose: event.target.value })}
                className="hf-type-input w-full rounded-card border border-hf-field-border bg-hf-page p-3 outline-none"
              />
            </label>
          </section>
        )}

        {step === 1 && (
          <section className="flex flex-col gap-3">
            <h2 className="hf-type-section-title">{t("screenings.frequencyTitle")}</h2>
            {SCREENING_FREQUENCIES.map((key: ScreeningFrequency) => (
              <button
                key={key}
                type="button"
                className="hf-chip"
                aria-pressed={draft.frequency === key}
                onClick={() => update({ frequency: key })}
              >
                {t(`screenings.frequency.${key}`)}
              </button>
            ))}
          </section>
        )}

        {step === 2 && (
          <section className="flex flex-col gap-4">
            <h2 className="hf-type-section-title">{t("screenings.questionsTitle")}</h2>
            {draft.questions.map((question, index) => (
              <div key={question.id} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextField
                    variant="standard"
                    label={t("screenings.questionLabel").replace("{n}", String(index + 1))}
                    placeholder={t("screenings.questionPlaceholder")}
                    value={question.text}
                    maxLength={200}
                    onChange={(event) =>
                      update({
                        questions: draft.questions.map((q) =>
                          q.id === question.id ? { ...q, text: event.target.value } : q,
                        ),
                      })
                    }
                  />
                </div>
                {draft.questions.length > 1 && (
                  <button
                    type="button"
                    aria-label={t("screenings.removeQuestion")}
                    onClick={() => update({ questions: draft.questions.filter((q) => q.id !== question.id) })}
                    className="hf-btn-icon h-12 w-10 text-hf-red-dark"
                  >
                    <IconTrash size={20} />
                  </button>
                )}
              </div>
            ))}
            {draft.questions.length < SCREENING_MAX_QUESTIONS && (
              <button
                type="button"
                onClick={() => update({ questions: [...draft.questions, { id: newQuestionId(), text: "" }] })}
                className="hf-btn-secondary h-12 w-full px-4"
              >
                <IconPlus size={20} />
                {t("screenings.addQuestion")}
              </button>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="flex flex-col gap-4">
            <h2 className="hf-type-section-title">{t("screenings.notifTitle")}</h2>
            <Toggle
              checked={draft.notificationsEnabled}
              onChange={(value) => update({ notificationsEnabled: value })}
              label={t("screenings.notifLabel")}
              description={t("screenings.notifDesc")}
            />
            {draft.notificationsEnabled && (
              <TextField
                variant="standard"
                type="time"
                label={t("screenings.notifTime")}
                className="min-w-0 max-w-full appearance-none text-left"
                value={draft.notificationTime ?? "20:00"}
                onChange={(event) => update({ notificationTime: event.target.value })}
              />
            )}
          </section>
        )}

        {step === 4 && (
          <section className="flex flex-col gap-5">
            <h2 className="hf-type-section-title">{t("screenings.measureTitle")}</h2>
            <div className="flex flex-col gap-2">
              <span className="hf-type-label">{t("screenings.scaleTitle")}</span>
              <div className="grid grid-cols-3 gap-2">
                {SCREENING_SCALES.map((key: ScreeningScale) => (
                  <button
                    key={key}
                    type="button"
                    className="hf-choice w-full"
                    aria-pressed={draft.scale === key}
                    onClick={() => {
                      update({ scale: key });
                      setPreviewValue(null);
                    }}
                  >
                    {t(`screenings.scale.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="hf-type-label">{t("screenings.inputTitle")}</span>
              {/* Hvert valg vises, som det kommer til at se ud — tryk for at vælge. */}
              <div className="flex flex-col gap-3">
                {SCREENING_INPUT_TYPES.map((key: ScreeningInputType) => (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    aria-pressed={draft.inputType === key}
                    onClick={() => update({ inputType: key })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") update({ inputType: key });
                    }}
                    className={`hf-chip flex flex-col gap-3 ${draft.inputType === key ? "is-selected" : ""}`}
                  >
                    <span className="hf-type-small">{t(`screenings.input.${key}`)}</span>
                    <div className="pointer-events-none">
                      <ScreeningInput
                        inputType={key}
                        scale={draft.scale}
                        minLabel={draft.minLabel}
                        maxLabel={draft.maxLabel}
                        value={previewValue}
                        onChange={setPreviewValue}
                        readOnly
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField
                variant="standard"
                label={t("screenings.minLabel")}
                placeholder={t("screenings.minPlaceholder")}
                value={draft.minLabel}
                maxLength={30}
                onChange={(event) => update({ minLabel: event.target.value })}
              />
              <TextField
                variant="standard"
                label={t("screenings.maxLabel")}
                placeholder={t("screenings.maxPlaceholder")}
                value={draft.maxLabel}
                maxLength={30}
                onChange={(event) => update({ maxLabel: event.target.value })}
              />
            </div>

            <Toggle
              checked={draft.notesEnabled}
              onChange={(value) => update({ notesEnabled: value })}
              label={t("screenings.notesLabel")}
              description={t("screenings.notesDesc")}
            />
          </section>
        )}

        {step === 5 && (
          <section className="flex flex-col gap-4">
            <h2 className="hf-type-section-title">{t("screenings.calendarTitle")}</h2>
            <Toggle
              checked={draft.showInCalendar}
              onChange={(value) => update({ showInCalendar: value })}
              label={t("screenings.calendarLabel")}
              description={t("screenings.calendarDesc")}
            />
          </section>
        )}
      </div>
    </HfScreen>
  );
}
