"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCalendar } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  BODY_MEASUREMENT_FIELDS,
  BODY_MEASUREMENT_UNIT,
  emptyBodyMeasurementValues,
  type BodyMeasurementField,
} from "@/lib/body-measurements";

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
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[13px] font-semibold text-hf-black">{label}</span>
      <span className="flex items-end gap-2 border-b border-hf-black/30 pb-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full min-w-0 bg-transparent text-[17px] text-hf-black outline-none"
          placeholder={placeholder}
        />
        <span className="pb-0.5 text-[13px] font-semibold text-hf-black opacity-60">{unit}</span>
      </span>
    </label>
  );
}

export default function NewGoalPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [targetDate, setTargetDate] = useState("");
  const [weight, setWeight] = useState("");
  const [measurements, setMeasurements] = useState<Record<BodyMeasurementField, string>>(
    emptyBodyMeasurementValues,
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const parsed = {
    weight: parseValue(weight),
    ...Object.fromEntries(BODY_MEASUREMENT_FIELDS.map(({ field }) => [field, parseValue(measurements[field])])),
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
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetDate, targets }),
      });
      if (!response.ok) throw new Error("Kunne ikke gemme målsætning");
      // Tilbage til oversigten (som åbnede formularen), så der ikke opstår et
      // navigationsloop; oversigten henter listen igen ved mount.
      router.back();
    } catch {
      setSaveError(true);
      setSaving(false);
    }
  }

  return (
    <HfScreen
      title={t("goals.createSubGoal")}
      footer={
        <div className="flex flex-col gap-2">
          {(!hasDate || !hasAny) && (
            <p className="text-center text-[13px] text-hf-black opacity-60">
              {!hasDate ? t("goals.dateRequired") : t("goals.atLeastOne")}
            </p>
          )}
          {saveError && <p className="text-center text-[13px] text-hf-red-dark">{t("goals.saveError")}</p>}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            aria-busy={saving}
            className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
          >
            {saving ? t("goals.saving") : t("goals.save")}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        {/* Dato-vælgeren står øverst på siden. */}

        <div className="rounded-2xl bg-hf-tan p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-hf-black">{t("goals.targetDate")}</span>
            <span className="relative flex items-end gap-2 border-b border-hf-black/30 pb-1.5">
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
                className={`min-h-[26px] w-full appearance-none bg-transparent text-left text-[17px] outline-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-left ${
                  targetDate === "" ? "text-transparent" : "text-hf-black"
                }`}
              />
              {targetDate === "" && (
                <span className="pointer-events-none absolute left-0 top-0 text-[17px] text-hf-black opacity-40">
                  {t("goals.targetDatePlaceholder")}
                </span>
              )}
              <IconCalendar size={18} aria-hidden="true" className="mb-0.5 shrink-0 text-hf-black opacity-60" />
            </span>
          </label>
        </div>

        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("goals.intro")}</p>
        </div>

        <div className="rounded-2xl bg-hf-tan p-4">
          <GoalInput
            label={t("goals.targetWeight")}
            unit="kg"
            value={weight}
            placeholder={t("goals.weightPlaceholder")}
            onChange={setWeight}
          />
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-hf-tan p-4">
          <p className="text-[15px] font-bold text-hf-black">{t("goals.bodyMeasurementsHeading")}</p>
          <div className="grid grid-cols-2 gap-4">
            {BODY_MEASUREMENT_FIELDS.map(({ field, nameKey }) => (
              <GoalInput
                key={field}
                label={t(nameKey)}
                unit={BODY_MEASUREMENT_UNIT}
                value={measurements[field]}
                placeholder={t("goals.measurementPlaceholder")}
                onChange={(value) => setMeasurements((current) => ({ ...current, [field]: value }))}
              />
            ))}
          </div>
        </div>
      </div>
    </HfScreen>
  );
}
