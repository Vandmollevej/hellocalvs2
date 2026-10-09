"use client";

import { useMemo, useState } from "react";
import { IconChevronDown, IconPlus, IconRuler2, IconSearch } from "@tabler/icons-react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import {
  CUSTOM_MEASURE_MAX_LINES,
  CUSTOM_MEASURE_MAX_LINE_LENGTH,
  clampMeasureText,
  suggestMeasureText,
} from "@/lib/custom-measure-text";
import {
  MEASURE_PARAMS,
  MEASURE_PARAM_BY_KEY,
  MEASURE_PERIOD_KEYS,
  newMeasurementId,
  saveCustomMeasurements,
  useCustomMeasurements,
  type CustomMeasurement,
  type MeasureGroup,
  type MeasurePeriodKey,
} from "@/lib/custom-measurements";
import { useTranslation } from "@/i18n/LocaleProvider";

const GROUP_ORDER: MeasureGroup[] = ["food", "activity", "sleep", "heart", "body"];

// Settings → Visning → Forside, øverst: "Tilføj egen måling". Navn og
// beskrivelse, parameter (søgbar liste), periode og en kort tekst (højst 2
// linjer á 15 tegn) under tallet i tal-hjulet på forsiden.
export function CustomMeasureSection() {
  const { t } = useTranslation();
  const measurements = useCustomMeasurements();
  const [editing, setEditing] = useState<CustomMeasurement | "new" | null>(null);

  function save(measurement: CustomMeasurement) {
    const exists = measurements.some((m) => m.id === measurement.id);
    saveCustomMeasurements(
      exists ? measurements.map((m) => (m.id === measurement.id ? measurement : m)) : [...measurements, measurement],
    );
  }

  function remove(id: string) {
    saveCustomMeasurements(measurements.filter((m) => m.id !== id));
  }

  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="hf-control hf-btn-primary flex w-full items-center justify-center gap-2"
      >
        <IconPlus size={18} stroke={2.2} aria-hidden="true" />
        {t("customMeasure.add")}
      </button>
      {measurements.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
          {measurements.map((m, index) => (
            <div
              key={m.id}
              className={`flex items-center gap-3 px-4 py-2 ${index < measurements.length - 1 ? "border-b border-hf-tan-dark" : ""}`}
            >
              <IconRuler2 size={20} className="shrink-0 text-hf-black" aria-hidden="true" />
              <button type="button" onClick={() => setEditing(m)} className="min-w-0 flex-1 text-left">
                <span className="hf-type-body block truncate text-hf-black">{m.name}</span>
                <span className="hf-type-small block truncate text-text-secondary">
                  {t(MEASURE_PARAM_BY_KEY[m.param].labelKey)} · {t(`customMeasure.period.${m.period}`)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(m.id)}
                className="hf-type-small hf-type-strong text-text-secondary"
              >
                {t("customMeasure.delete")}
              </button>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <MeasureSheet
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(measurement) => {
            save(measurement);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function MeasureSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: CustomMeasurement | null;
  onClose: () => void;
  onSave: (measurement: CustomMeasurement) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [param, setParam] = useState(initial?.param ?? "");
  const [period, setPeriod] = useState<MeasurePeriodKey>(initial?.period ?? "today");
  const [text, setText] = useState(initial?.text ?? "");
  // Teksten følger forslaget, indtil brugeren selv har rettet i den.
  const [textEdited, setTextEdited] = useState(Boolean(initial?.text));
  const [pickerOpen, setPickerOpen] = useState(!initial);
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MEASURE_PARAMS.map((def) => ({ def, label: t(def.labelKey) })).filter(
      ({ label }) => !needle || label.toLowerCase().includes(needle),
    );
  }, [query, t]);

  function choose(key: string) {
    setParam(key);
    setPickerOpen(false);
    setQuery("");
    if (!textEdited) setText(suggestMeasureText(t(MEASURE_PARAM_BY_KEY[key].labelKey)));
    if (!name.trim()) setName(t(MEASURE_PARAM_BY_KEY[key].labelKey));
  }

  const lines = text.split("\n");
  const valid = name.trim().length > 0 && param in MEASURE_PARAM_BY_KEY;

  return (
    <BottomSheet
      onClose={onClose}
      title={t("customMeasure.add")}
      size="full"
      footer={
        <div className="flex gap-3">
          <BottomSheetCloseButton className="hf-control hf-btn-secondary flex-1">
            {t("customMeasure.cancel")}
          </BottomSheetCloseButton>
          <BottomSheetCloseButton
            className="hf-control hf-btn-primary flex-1 disabled:opacity-40"
            onClick={() =>
              valid &&
              onSave({
                id: initial?.id ?? newMeasurementId(),
                name: name.trim(),
                description: description.trim(),
                param,
                period,
                text: clampMeasureText(text),
              })
            }
          >
            {t("customMeasure.save")}
          </BottomSheetCloseButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 px-4 pb-4">
        <label className="flex flex-col gap-1">
          <span className="hf-type-small hf-type-strong text-hf-black">{t("customMeasure.nameLabel")}</span>
          <input
            type="text"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            className="hf-field hf-type-input w-full border border-hf-field-border bg-hf-cream px-4 outline-none rounded-card"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="hf-type-small hf-type-strong text-hf-black">{t("customMeasure.descriptionLabel")}</span>
          <textarea
            value={description}
            maxLength={200}
            rows={2}
            onChange={(event) => setDescription(event.target.value)}
            className="hf-type-input w-full resize-none border border-hf-field-border bg-hf-cream px-4 py-3 outline-none rounded-card"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="hf-type-small hf-type-strong text-hf-black">{t("customMeasure.paramLabel")}</span>
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            aria-expanded={pickerOpen}
            className="hf-field hf-type-input flex w-full items-center justify-between border border-hf-field-border bg-hf-cream px-4 text-left rounded-card"
          >
            <span className={param ? "text-hf-black" : "text-text-secondary"}>
              {param ? t(MEASURE_PARAM_BY_KEY[param].labelKey) : t("customMeasure.paramPlaceholder")}
            </span>
            <IconChevronDown size={18} aria-hidden="true" />
          </button>
          {pickerOpen && (
            <div className="overflow-hidden rounded-card border border-hf-field-border bg-hf-cream">
              <label className="flex items-center gap-2 border-b border-hf-field-border px-3">
                <IconSearch size={16} className="text-text-secondary" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  autoFocus
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("customMeasure.search")}
                  className="hf-type-input w-full bg-transparent py-3 outline-none"
                />
              </label>
              <div className="max-h-64 overflow-y-auto">
                {options.length === 0 && (
                  <p className="hf-type-small px-4 py-3 text-text-secondary">{t("customMeasure.noMatch")}</p>
                )}
                {GROUP_ORDER.map((group) => {
                  const inGroup = options.filter(({ def }) => def.group === group);
                  if (inGroup.length === 0) return null;
                  return (
                    <div key={group}>
                      <p className="hf-type-small hf-type-strong bg-hf-tan px-4 py-1 text-text-secondary">
                        {t(`customMeasure.group.${group}`)}
                      </p>
                      {inGroup.map(({ def, label }) => (
                        <button
                          key={def.key}
                          type="button"
                          onClick={() => choose(def.key)}
                          className={`hf-type-body block w-full px-4 py-2 text-left ${def.key === param ? "hf-type-strong" : ""}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <label className="flex flex-col gap-1">
          <span className="hf-type-small hf-type-strong text-hf-black">{t("customMeasure.periodLabel")}</span>
          <span className="relative block">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as MeasurePeriodKey)}
              className="hf-field hf-type-input w-full appearance-none border bg-hf-cream pl-4 pr-10 outline-none border-hf-field-border rounded-card"
            >
              {MEASURE_PERIOD_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`customMeasure.period.${key}`)}
                </option>
              ))}
            </select>
            <IconChevronDown
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
            />
          </span>
          <span className="hf-type-small text-text-secondary">{t("customMeasure.periodHint")}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="hf-type-small hf-type-strong text-hf-black">{t("customMeasure.textLabel")}</span>
          <textarea
            value={text}
            rows={CUSTOM_MEASURE_MAX_LINES}
            onChange={(event) => {
              setTextEdited(true);
              setText(clampMeasureText(event.target.value));
            }}
            className="hf-type-input w-full resize-none border border-hf-field-border bg-hf-cream px-4 py-3 outline-none rounded-card"
          />
          <span className="hf-type-small text-text-secondary">
            {t("customMeasure.textHint", { lines: CUSTOM_MEASURE_MAX_LINES, chars: CUSTOM_MEASURE_MAX_LINE_LENGTH })}
            {" · "}
            {lines.map((line) => line.length).join(" / ")}
          </span>
        </label>
      </div>
    </BottomSheet>
  );
}
