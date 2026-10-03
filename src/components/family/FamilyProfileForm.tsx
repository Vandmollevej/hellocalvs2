"use client";

import { useState } from "react";
import { TextField } from "@/components/hf/TextField";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

export type FamilyProfileInput = {
  displayName: string;
  birthDate: string;
  sex: string;
  isChild: boolean;
  heightCm: string;
  weightKg: string;
};

const EMPTY: FamilyProfileInput = { displayName: "", birthDate: "", sex: "", isChild: true, heightCm: "", weightKg: "" };

// Ny profil i familien (docs/FAMILY.md). Bruges på Familie-siden og i
// "Inviter familiemedlem"-arket ("Tilføj barn under 18", childOnly).
export function FamilyProfileForm({
  busy,
  childOnly = false,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  /** Kun børn under 18: "Er det et barn?" er altid slået til og skjult. */
  childOnly?: boolean;
  /** Returnerer true, når profilen er oprettet (formularen tømmes). */
  onSubmit: (input: FamilyProfileInput) => Promise<boolean>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FamilyProfileInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (childOnly && form.birthDate && !isUnder18(form.birthDate)) {
      setError(t("family.add.childTooOld"));
      return;
    }
    if (await onSubmit({ ...form, isChild: childOnly ? true : form.isChild })) setForm(EMPTY);
  }

  return (
    <div className="hf-stack">
      <TextField
        variant="standard"
        label={t("family.add.name")}
        value={form.displayName}
        className="userback-ignore"
        onChange={(event) => setForm({ ...form, displayName: event.target.value })}
      />
      <TextField
        variant="standard"
        type="date"
        label={t("family.add.birthDate")}
        value={form.birthDate}
        onChange={(event) => setForm({ ...form, birthDate: event.target.value })}
      />
      <label className="hf-type-body flex flex-col gap-2">
        {t("family.add.sex")}
        <select
          value={form.sex}
          onChange={(event) => setForm({ ...form, sex: event.target.value })}
          className="hf-type-input h-12 rounded-[8px] border border-hf-gray-border bg-hf-cream px-4"
        >
          <option value="">{t("family.add.sexUnknown")}</option>
          <option value="FEMALE">{t("family.add.sexFemale")}</option>
          <option value="MALE">{t("family.add.sexMale")}</option>
        </select>
      </label>
      <TextField
        variant="standard"
        inputMode="decimal"
        label={t("family.add.heightCm")}
        value={form.heightCm}
        onChange={(event) => setForm({ ...form, heightCm: event.target.value })}
      />
      <TextField
        variant="standard"
        inputMode="decimal"
        label={t("family.add.weightKg")}
        value={form.weightKg}
        onChange={(event) => setForm({ ...form, weightKg: event.target.value })}
      />
      {!childOnly && (
        <Toggle
          label={t("family.add.isChild")}
          description={t("family.add.isChildHelp")}
          checked={form.isChild}
          onChange={(value) => setForm({ ...form, isChild: value })}
        />
      )}
      {error && (
        <p role="alert" className="hf-type-body text-hf-red-dark">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !form.displayName.trim()}
        onClick={submit}
        className="hf-control hf-btn-primary w-full px-4"
      >
        {t(childOnly ? "family.add.submitChild" : "family.add.submit")}
      </button>
      <button type="button" onClick={onCancel} className="hf-btn-text">
        {t("common.cancel")}
      </button>
    </div>
  );
}

function isUnder18(birthDate: string) {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return true;
  const eighteenth = new Date(date);
  eighteenth.setFullYear(date.getFullYear() + 18);
  return eighteenth.getTime() > Date.now();
}
