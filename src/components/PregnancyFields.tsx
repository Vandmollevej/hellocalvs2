"use client";

import { FieldSlider } from "@/components/hf/FieldSlider";
import { useTranslation } from "@/i18n/LocaleProvider";
import { TextField } from "@/components/hf/TextField";
import {
  MAX_BREASTFEEDING_WEEKS,
  MAX_PREGNANCY_WEEK,
  MIN_PREGNANCY_WEEK,
  PREGNANCY_STATUSES,
  pregnancyExtraKcal,
  trimesterForWeek,
  type PregnancyStatus,
} from "@/lib/pregnancy";

// Graviditet og amning (docs/DECISIONS.md 2026-10-14): samme felter i
// oprettelsesguiden (OnboardingWizard) og under Indstillinger → Visning →
// Graviditet og amning. Valget gemmes straks (ingen Gem-knap); ugen/ugerne
// gælder fra i dag og regnes frem i tid på serveren (src/lib/pregnancy.ts).

export type PregnancyValue = {
  pregnancyStatus: PregnancyStatus | null;
  pregnancyWeek: number | null;
  breastfeedingWeeks: number | null;
};

export type PregnancyPatch = Partial<PregnancyValue>;

function parseWeeks(raw: string, min: number, max: number): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function Choice({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`hf-type-body hf-type-strong hf-control flex-1 rounded-xl px-4 transition-colors ${
        selected ? "hf-selected" : "bg-hf-tan text-hf-black"
      }`}
    >
      {label}
    </button>
  );
}

export function PregnancyFields({
  value,
  onChange,
  question,
  headingId,
}: {
  value: PregnancyValue;
  onChange: (patch: PregnancyPatch) => void;
  /** Overskriften (guiden spørger; indstillingssiden forklarer). */
  question: string;
  headingId?: string;
}) {
  const { t } = useTranslation();
  const status = value.pregnancyStatus;
  const week = value.pregnancyWeek;
  const trimester = week !== null ? trimesterForWeek(week) : null;
  const extraKcal =
    status === null ? 0 : pregnancyExtraKcal({ status, trimester, breastfeedingWeeks: value.breastfeedingWeeks ?? 0 });

  function pick(next: PregnancyStatus | null) {
    if (next === status) return;
    onChange({ pregnancyStatus: next, pregnancyWeek: null, breastfeedingWeeks: null });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 id={headingId} className="hf-type-body-lg hf-heading text-hf-black">
        {question}
      </h2>
      <div className="flex gap-3">
        <Choice label={t("pregnancy.none")} selected={status === null} onClick={() => pick(null)} />
        {PREGNANCY_STATUSES.map((option) => (
          <Choice key={option} label={t(`pregnancy.status.${option}`)} selected={status === option} onClick={() => pick(option)} />
        ))}
      </div>

      {status === "PREGNANT" && (
        <div className="flex flex-col gap-2">
          <TextField
            variant="standard"
            label={t("pregnancy.weekLabel")}
            type="number"
            inputMode="numeric"
            min={MIN_PREGNANCY_WEEK}
            max={MAX_PREGNANCY_WEEK}
            value={week ?? ""}
            onChange={(event) => onChange({ pregnancyWeek: parseWeeks(event.target.value, MIN_PREGNANCY_WEEK, MAX_PREGNANCY_WEEK) })}
            placeholder={t("pregnancy.weekPlaceholder")}
          />
          <FieldSlider
            value={week}
            min={MIN_PREGNANCY_WEEK}
            max={MAX_PREGNANCY_WEEK}
            onChange={(raw) => onChange({ pregnancyWeek: parseWeeks(raw, MIN_PREGNANCY_WEEK, MAX_PREGNANCY_WEEK) })}
            aria-label={t("pregnancy.weekLabel")}
          />
          {trimester !== null && (
            <p className="hf-type-small text-hf-black">
              {t("pregnancy.trimester", { trimester })} · {t("pregnancy.extraKcal", { kcal: extraKcal })}
            </p>
          )}
          <p className="hf-type-caption text-text-secondary">{t("pregnancy.weekHint")}</p>
        </div>
      )}

      {status === "BREASTFEEDING" && (
        <div className="flex flex-col gap-2">
          <TextField
            variant="standard"
            label={t("pregnancy.breastfeedingWeeksLabel")}
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_BREASTFEEDING_WEEKS}
            value={value.breastfeedingWeeks ?? ""}
            onChange={(event) => onChange({ breastfeedingWeeks: parseWeeks(event.target.value, 0, MAX_BREASTFEEDING_WEEKS) })}
            placeholder={t("pregnancy.breastfeedingWeeksPlaceholder")}
          />
          <FieldSlider
            value={value.breastfeedingWeeks}
            min={0}
            max={MAX_BREASTFEEDING_WEEKS}
            onChange={(raw) => onChange({ breastfeedingWeeks: parseWeeks(raw, 0, MAX_BREASTFEEDING_WEEKS) })}
            aria-label={t("pregnancy.breastfeedingWeeksLabel")}
          />
          <p className="hf-type-small text-hf-black">{t("pregnancy.extraKcal", { kcal: extraKcal })}</p>
          <p className="hf-type-caption text-text-secondary">{t("pregnancy.breastfeedingHint")}</p>
        </div>
      )}

      {status !== null && <p className="hf-type-caption text-text-secondary">{t("pregnancy.noDeficit")}</p>}
    </div>
  );
}
