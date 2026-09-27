"use client";

import { useEffect, useRef, useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  BODY_MEASUREMENT_FIELDS,
  BODY_MEASUREMENT_UNIT,
  emptyBodyMeasurementValues,
  type BodyMeasurementField,
} from "@/lib/body-measurements";
import { emptyNutritionGoalValues, NUTRITION_GOAL_FIELDS, type NutritionGoalField } from "@/lib/goal-nutrition";

// Formularen til at oprette og redigere en målsætning (dato, vægt, kropsmål,
// ernæring).
// Selve gemningen (POST/PATCH) ligger hos siden, der bruger den.

export type GoalFormValues = {
  targetDate: string;
  weight: string;
  measurements: Record<BodyMeasurementField, string>;
  nutrition: Record<NutritionGoalField, string>;
};

export function emptyGoalFormValues(): GoalFormValues {
  return { targetDate: "", weight: "", measurements: emptyBodyMeasurementValues(), nutrition: emptyNutritionGoalValues() };
}

// "" = tomt felt (ignoreres), null = ugyldig værdi, ellers det parsede tal.
function parseValue(raw: string): number | "" | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Dags dato som lokal "YYYY-MM-DD" — tidligste valgbare målsætningsdato.
function localTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function GoalInput({
  label,
  unit,
  value,
  placeholder,
  autoFocus,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: "center" });
  }, [autoFocus]);

  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="hf-type-small hf-type-strong text-hf-black">{label}</span>
      <span className="flex items-end gap-2 border-b border-hf-black/30 pb-2">
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="hf-type-body-lg w-full min-w-0 bg-transparent text-hf-black outline-none"
          placeholder={placeholder}
        />
        <span className="text-text-secondary hf-type-small hf-type-strong pb-1">{unit}</span>
      </span>
    </label>
  );
}

export function GoalForm({
  title,
  initial,
  focus,
  onSubmit,
}: {
  title: string;
  initial: GoalFormValues;
  // Target-type ("weight", "waistCm", …), hvis feltet skal have fokus ved åbning.
  focus?: string | null;
  // Modtager datoen og de udfyldte targets; kaster ved fejl.
  onSubmit: (targetDate: string, targets: Record<string, number>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [weight, setWeight] = useState(initial.weight);
  const [measurements, setMeasurements] = useState(initial.measurements);
  const [nutrition, setNutrition] = useState(initial.nutrition);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const parsed = {
    weight: parseValue(weight),
    ...Object.fromEntries(BODY_MEASUREMENT_FIELDS.map(({ field }) => [field, parseValue(measurements[field])])),
    ...Object.fromEntries(NUTRITION_GOAL_FIELDS.map(({ field }) => [field, parseValue(nutrition[field])])),
  } as Record<string, number | "" | null>;
  const hasInvalid = Object.values(parsed).some((value) => value === null);
  const hasAny = Object.values(parsed).some((value) => typeof value === "number");
  const today = localTodayIso();
  const hasDate = targetDate !== "" && targetDate >= today;
  const canSave = hasDate && hasAny && !hasInvalid && !saving;

  async function save() {
    if (!canSave) return;
    const targets = Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number"),
    );

    setSaving(true);
    setSaveError(false);
    try {
      await onSubmit(targetDate, targets);
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  }

  return (
    <HfScreen
      title={title}
      footer={
        <div className="flex flex-col gap-2">
          {(!hasDate || !hasAny) && (
            <p className="text-text-secondary hf-type-small text-center">
              {!hasDate ? t("goals.dateRequired") : t("goals.atLeastOne")}
            </p>
          )}
          {saveError && <p className="hf-type-small text-center text-hf-red-dark">{t("goals.saveError")}</p>}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            aria-busy={saving}
            className="hf-control hf-btn-primary w-full disabled:opacity-40"
          >
            {saving ? t("goals.saving") : t("goals.save")}
          </button>
        </div>
      }
    >
      <div className="hf-page">
        {/* Dato-vælgeren står øverst på siden. */}
        <div className="hf-card">
          <label className="flex flex-col gap-1">
            <span className="hf-type-small hf-type-strong text-hf-black">{t("goals.targetDate")}</span>
            <span className="relative flex items-end gap-2 border-b border-hf-black/30 pb-2">
              <input
                type="date"
                value={targetDate}
                min={today}
                onChange={(event) => setTargetDate(event.target.value)}
                // Hele feltet åbner vælgeren (desktop viser ellers kun den via
                // browserens egen, her skjulte, kalenderknap).
                onClick={(event) => {
                  try {
                    event.currentTarget.showPicker?.();
                  } catch {
                    // Ældre browsere/iframes uden showPicker-tilladelse.
                  }
                }}
                // Tomt felt: skjul browserens "dd.mm.åååå"-maske bag pladsholderen.
                className={`hf-type-body-lg min-h-[26px] w-full appearance-none bg-transparent text-left outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left ${
                  targetDate === "" ? "text-transparent" : "text-hf-black"
                }`}
              />
              {targetDate === "" && (
                <span className="text-text-muted hf-type-body-lg pointer-events-none absolute left-0 top-0">
                  {t("goals.targetDatePlaceholder")}
                </span>
              )}
              <IconCalendar size={18} aria-hidden="true" className="mb-1 shrink-0 text-hf-black opacity-60" />
            </span>
          </label>
        </div>

        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="hf-type-small">{t("goals.intro")}</p>
        </div>

        <div className="hf-card">
          <GoalInput
            label={t("goals.targetWeight")}
            unit="kg"
            value={weight}
            placeholder={t("goals.weightPlaceholder")}
            autoFocus={focus === "weight"}
            onChange={setWeight}
          />
        </div>

        <div className="hf-card hf-card--form">
          <p className="hf-type-body hf-type-strong text-hf-black">{t("goals.bodyMeasurementsHeading")}</p>
          <div className="grid grid-cols-2 gap-4">
            {BODY_MEASUREMENT_FIELDS.map(({ field, nameKey }) => (
              <GoalInput
                key={field}
                label={t(nameKey)}
                unit={BODY_MEASUREMENT_UNIT}
                value={measurements[field]}
                placeholder={t("goals.measurementPlaceholder")}
                autoFocus={focus === field}
                onChange={(value) => setMeasurements((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-hf-tan p-4">
          <p className="hf-type-body hf-type-strong text-hf-black">{t("goals.nutritionHeading")}</p>
          <div className="grid grid-cols-2 gap-4">
            {NUTRITION_GOAL_FIELDS.map(({ field, unit, nameKey }) => (
              <GoalInput
                key={field}
                label={t(nameKey)}
                unit={unit}
                value={nutrition[field]}
                placeholder={t(`goals.nutritionPlaceholder.${field}`)}
                autoFocus={focus === field}
                onChange={(value) => setNutrition((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>
        </div>
      </div>
    </HfScreen>
  );
}
