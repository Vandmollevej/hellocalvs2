"use client";

import { useEffect, useRef, useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  lengthToInputValue,
  lengthUnitLabel,
  parseLengthInput,
  parseWeightInput,
  useUnits,
  weightToInputValue,
  weightUnitLabel,
} from "@/lib/units";
import {
  BODY_MEASUREMENT_FIELDS,
  emptyBodyMeasurementValues,
  type BodyMeasurementField,
} from "@/lib/body-measurements";
import {
  COMPOSITION_GOAL_FIELDS,
  emptyCompositionGoalValues,
  type CompositionGoalField,
} from "@/lib/goal-composition";
import { emptyNutritionGoalValues, NUTRITION_GOAL_FIELDS, type NutritionGoalField } from "@/lib/goal-nutrition";

// Formularen til at oprette og redigere en målsætning (dato, vægt, kropsmål,
// ernæring).
// Selve gemningen (POST/PATCH) ligger hos siden, der bruger den.

export type GoalFormValues = {
  targetDate: string;
  weight: string;
  measurements: Record<BodyMeasurementField, string>;
  composition: Record<CompositionGoalField, string>;
  nutrition: Record<NutritionGoalField, string>;
};

export function emptyGoalFormValues(): GoalFormValues {
  return { targetDate: "", weight: "", measurements: emptyBodyMeasurementValues(), composition: emptyCompositionGoalValues(), nutrition: emptyNutritionGoalValues() };
}

// "" = tomt felt (ignoreres), null = ugyldig værdi, ellers det parsede tal.
function parseValue(raw: string): number | "" | null {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

// Som parseValue, men tallet oversættes først fra den valgte enhed til kg/cm
// (afrundet til 0,1) af `convert`.
function parseConverted(raw: string, convert: (raw: string) => number | null): number | "" | null {
  if (raw.trim() === "") return "";
  const value = convert(raw);
  return value === null ? null : Math.round(value * 10) / 10;
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
          inputMode={unit.includes(" ") ? "text" : "decimal"}
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
  const units = useUnits();
  // Startværdierne kommer i kg/cm; vis dem i den valgte enhed.
  const [weight, setWeight] = useState(() => {
    const kg = Number(initial.weight.replace(",", "."));
    return initial.weight.trim() !== "" && Number.isFinite(kg) ? weightToInputValue(kg, units.weight) : initial.weight;
  });
  const [measurements, setMeasurements] = useState(() =>
    Object.fromEntries(
      BODY_MEASUREMENT_FIELDS.map(({ field }) => {
        const raw = initial.measurements[field];
        const cm = Number(raw.replace(",", "."));
        return [field, raw.trim() !== "" && Number.isFinite(cm) ? lengthToInputValue(cm, units.height) : raw];
      }),
    ) as GoalFormValues["measurements"],
  );
  const [composition, setComposition] = useState(initial.composition);
  const [nutrition, setNutrition] = useState(initial.nutrition);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Vægt og kropsmål indtastes i den valgte enhed, men gemmes altid som kg/cm.
  const parsed = {
    weight: parseConverted(weight, (raw) => parseWeightInput(raw, units.weight)),
    ...Object.fromEntries(
      BODY_MEASUREMENT_FIELDS.map(({ field }) => [
        field,
        parseConverted(measurements[field], (raw) => parseLengthInput(raw, units.height)),
      ]),
    ),
    ...Object.fromEntries(COMPOSITION_GOAL_FIELDS.map(({ field }) => [field, parseValue(composition[field])])),
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
            className="hf-control hf-btn-primary w-full"
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

        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("goals.intro")}</p>
        </div>

        <div className="hf-card">
          <GoalInput
            label={t("goals.targetWeight")}
            unit={weightUnitLabel(units.weight)}
            value={weight}
            placeholder={weightToInputValue(72, units.weight)}
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
                unit={lengthUnitLabel(units.height)}
                value={measurements[field]}
                placeholder={lengthToInputValue(82, units.height)}
                autoFocus={focus === field}
                onChange={(value) => setMeasurements((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>
        </div>

        <div className="hf-card hf-card--form">
          <p className="hf-type-body hf-type-strong text-hf-black">{t("goals.compositionHeading")}</p>
          <div className="grid grid-cols-2 gap-4">
            {COMPOSITION_GOAL_FIELDS.map(({ field, unit, nameKey }) => (
              <GoalInput
                key={field}
                label={t(nameKey)}
                unit={unit}
                value={composition[field]}
                placeholder={t(`goals.compositionPlaceholder.${field}`)}
                autoFocus={focus === field}
                onChange={(value) => setComposition((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>
        </div>

        <div className="hf-card--form hf-card">
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
