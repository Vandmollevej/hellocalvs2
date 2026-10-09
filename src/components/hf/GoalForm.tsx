"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { IconCalendar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionSection } from "@/components/hf/AccordionSection";
import { HfSlider } from "@/components/hf/HfSlider";
import {
  compositionSliderRange,
  lengthSliderRange,
  nutritionSliderRange,
  activitySliderRange,
  weightSliderRange,
  type GoalSliderRange,
} from "@/lib/goal-slider-ranges";
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
  isBodyMeasurementField,
  emptyBodyMeasurementValues,
  type BodyMeasurementField,
  type BodyMeasurementSex,
} from "@/lib/body-measurements";
import {
  COMPOSITION_GOAL_FIELDS,
  isCompositionGoalField,
  emptyCompositionGoalValues,
  type CompositionGoalField,
} from "@/lib/goal-composition";
import { emptyNutritionGoalValues, isNutritionGoalField, NUTRITION_GOAL_FIELDS, type NutritionGoalField } from "@/lib/goal-nutrition";
import {
  ACTIVITY_GOAL_FIELDS,
  emptyActivityGoalValues,
  isActivityGoalField,
  WHO_ACTIVITY_SUGGESTION,
  type ActivityGoalField,
} from "@/lib/goal-activity";

// Formularen til at oprette og redigere en målsætning (dato, vægt, kropsmål,
// ernæring).
// Selve gemningen (POST/PATCH) ligger hos siden, der bruger den.

export type GoalFormValues = {
  targetDate: string;
  weight: string;
  measurements: Record<BodyMeasurementField, string>;
  composition: Record<CompositionGoalField, string>;
  nutrition: Record<NutritionGoalField, string>;
  activity: Record<ActivityGoalField, string>;
};

export function emptyGoalFormValues(): GoalFormValues {
  return { targetDate: "", weight: "", measurements: emptyBodyMeasurementValues(), composition: emptyCompositionGoalValues(), nutrition: emptyNutritionGoalValues(), activity: emptyActivityGoalValues() };
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
  onActivate,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  // Kaldes når feltet får fokus, så formularen kan vise slideren under det.
  onActivate?: () => void;
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
          onFocus={onActivate}
          className="hf-type-body-lg w-full min-w-0 bg-transparent text-hf-black outline-none"
          placeholder={placeholder}
        />
        <span className="text-text-secondary hf-type-small hf-type-strong pb-1">{unit}</span>
      </span>
    </label>
  );
}

// Slider i fuld bredde, fastgjort nederst og løftet op over tastaturet, så man
// både kan taste og trække. pointerdown på panelet stjæler ikke fokus fra
// feltet, så tastaturet bliver oppe.
function GoalSliderBar({
  label,
  unit,
  value,
  range,
  onChange,
  onClose,
}: {
  label: string;
  unit: string;
  value: string;
  range: GoalSliderRange;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  const parsed = Number(value.trim().replace(",", "."));
  const current = Number.isFinite(parsed) && value.trim() !== "" ? Math.min(range.max, Math.max(range.min, parsed)) : range.min;
  const decimals = range.step < 1 ? 1 : 0;

  return (
    <div
      onPointerDown={(event) => event.preventDefault()}
      style={{ bottom: offset }}
      className="fixed inset-x-0 z-40 flex flex-col gap-2 border-t border-hf-black/10 bg-hf-white px-4 pb-3 pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center justify-between">
        <span className="hf-type-small hf-type-strong text-hf-black">
          {label}: {current.toFixed(decimals).replace(".", ",")} {unit}
        </span>
        <button type="button" onClick={onClose} className="hf-type-small hf-type-strong text-hf-green">
          OK
        </button>
      </div>
      <HfSlider
        value={current}
        min={range.min}
        max={range.max}
        step={range.step}
        aria-label={label}
        onChange={(next) => onChange(next.toFixed(decimals).replace(".", ","))}
      />
    </div>
  );
}

type ActiveSlider = {
  id: string;
  label: string;
  unit: string;
  range: GoalSliderRange;
  value: string;
  set: (value: string) => void;
};

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
  const [activity, setActivity] = useState(initial.activity);
  // Kropsmålenes tegninger følger profilens køn (aldrig gætte: uden køn vises ingen).
  const [sex, setSex] = useState<BodyMeasurementSex | null>(null);
  useEffect(() => {
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("profile");
        return (await response.json()) as { user: { sex: BodyMeasurementSex | null } };
      })
      .then((data) => setSex(data.user.sex ?? null))
      .catch(() => {});
  }, []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

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
    ...Object.fromEntries(ACTIVITY_GOAL_FIELDS.map(({ field }) => [field, parseValue(activity[field])])),
  } as Record<string, number | "" | null>;
  const hasInvalid = Object.values(parsed).some((value) => value === null);
  const hasAny = Object.values(parsed).some((value) => typeof value === "number");
  const today = localTodayIso();
  const hasDate = targetDate !== "" && targetDate >= today;
  const canSave = hasDate && hasAny && !hasInvalid && !saving;

  // Slideren findes ikke til stone/pund-formatet ("10 4"), der ikke er ét tal.
  const weightRange = units.weight === "st" ? null : weightSliderRange(units.weight === "lb" ? "lb" : "kg");
  const lengthRange = lengthSliderRange(units.height === "in" ? "in" : "cm");
  const sliders: ActiveSlider[] = [
    ...(weightRange
      ? [{ id: "weight", label: t("goals.targetWeight"), unit: weightUnitLabel(units.weight), range: weightRange, value: weight, set: setWeight }]
      : []),
    ...BODY_MEASUREMENT_FIELDS.map(({ field, nameKey }) => ({
      id: field,
      label: t(nameKey),
      unit: lengthUnitLabel(units.height),
      range: lengthRange,
      value: measurements[field],
      set: (value: string) => setMeasurements((current) => ({ ...current, [field]: value })),
    })),
    ...COMPOSITION_GOAL_FIELDS.map(({ field, unit, nameKey }) => ({
      id: field,
      label: t(nameKey),
      unit,
      range: compositionSliderRange(field),
      value: composition[field],
      set: (value: string) => setComposition((current) => ({ ...current, [field]: value })),
    })),
    ...NUTRITION_GOAL_FIELDS.map(({ field, unit, nameKey }) => ({
      id: field,
      label: t(nameKey),
      unit,
      range: nutritionSliderRange(field),
      value: nutrition[field],
      set: (value: string) => setNutrition((current) => ({ ...current, [field]: value })),
    })),
    ...ACTIVITY_GOAL_FIELDS.map(({ field, unit, nameKey }) => ({
      id: field,
      label: t(nameKey),
      unit,
      range: activitySliderRange(field),
      value: activity[field],
      set: (value: string) => setActivity((current) => ({ ...current, [field]: value })),
    })),
  ];
  const activeSlider = sliders.find((slider) => slider.id === activeId) ?? null;

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
      <div className={`hf-page ${activeSlider ? "pb-28" : ""}`}>
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

        <AccordionSection
          title={t("goals.weightCompositionHeading")}
          defaultOpen={focus === null || focus === undefined || focus === "weight" || (typeof focus === "string" && isCompositionGoalField(focus))}
          bodyClassName="p-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <GoalInput
              label={t("goals.targetWeight")}
              unit={weightUnitLabel(units.weight)}
              value={weight}
              placeholder={weightToInputValue(72, units.weight)}
              autoFocus={focus === "weight"}
              onChange={setWeight}
              onActivate={() => setActiveId("weight")}
            />
            {COMPOSITION_GOAL_FIELDS.map(({ field, unit, nameKey }) => (
              <GoalInput
                key={field}
                label={t(nameKey)}
                unit={unit}
                value={composition[field]}
                placeholder={t(`goals.compositionPlaceholder.${field}`)}
                autoFocus={focus === field}
                onChange={(value) => setComposition((current) => ({ ...current, [field]: value }))}
                onActivate={() => setActiveId(field)}
              />
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title={t("goals.bodyMeasurementsHeading")}
          defaultOpen={typeof focus === "string" && isBodyMeasurementField(focus)}
          bodyClassName="p-4"
        >
          <div className="flex flex-col gap-4">
            {BODY_MEASUREMENT_FIELDS.map(({ field, nameKey, image }) => (
              <div key={field} className="flex items-center gap-4">
                <span className="flex h-[76px] w-14 shrink-0 items-center justify-center">
                  {image && sex && (
                    <Image src={image[sex]} alt="" width={56} height={76} className="h-full w-full object-contain" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <GoalInput
                    label={t(nameKey)}
                    unit={lengthUnitLabel(units.height)}
                    value={measurements[field]}
                    placeholder={lengthToInputValue(82, units.height)}
                    autoFocus={focus === field}
                    onChange={(value) => setMeasurements((current) => ({ ...current, [field]: value }))}
                    onActivate={() => setActiveId(field)}
                  />
                </div>
              </div>
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title={t("goals.nutritionHeading")}
          defaultOpen={typeof focus === "string" && isNutritionGoalField(focus)}
          bodyClassName="p-4"
        >
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
                onActivate={() => setActiveId(field)}
              />
            ))}
          </div>
        </AccordionSection>

        <AccordionSection
          title={t("goals.activityHeading")}
          defaultOpen={typeof focus === "string" && isActivityGoalField(focus)}
          bodyClassName="flex flex-col gap-3 p-4"
        >
          <p className="text-text-secondary hf-type-small">{t("goals.activityIntro")}</p>
          <button
            type="button"
            onClick={() => setActivity((current) => ({ ...current, ...WHO_ACTIVITY_SUGGESTION }))}
            className="hf-type-small hf-type-strong self-start text-hf-black underline"
          >
            {t("goals.activityUseWho")}
          </button>
          <div className="grid grid-cols-2 gap-4">
            {ACTIVITY_GOAL_FIELDS.map(({ field, unit, nameKey }) => (
              <GoalInput
                key={field}
                label={t(nameKey)}
                unit={unit}
                value={activity[field]}
                placeholder={t(`goals.activityPlaceholder.${field}`)}
                autoFocus={focus === field}
                onChange={(value) => setActivity((current) => ({ ...current, [field]: value }))}
                onActivate={() => setActiveId(field)}
              />
            ))}
          </div>
          <p className="text-text-secondary hf-type-small">{t("goals.activityHeartRateHint")}</p>
        </AccordionSection>
      </div>
      {activeSlider && (        <GoalSliderBar
          key={activeSlider.id}
          label={activeSlider.label}
          unit={activeSlider.unit}
          value={activeSlider.value}
          range={activeSlider.range}
          onChange={activeSlider.set}
          onClose={() => {
            setActiveId(null);
            (document.activeElement as HTMLElement | null)?.blur();
          }}
        />
      )}
    </HfScreen>
  );
}
