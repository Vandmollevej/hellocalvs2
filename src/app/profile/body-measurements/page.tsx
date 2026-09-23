"use client";

import { useEffect, useRef, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  BODY_MEASUREMENT_FIELDS,
  emptyBodyMeasurementValues,
  type BodyMeasurementField,
} from "@/lib/body-measurements";
import { localApi } from "@/lib/vault/local-api";

type BodyMeasurementEntry = {
  id: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  upperArmCm: number | null;
  measuredAt: string;
};

type MeasurementField = BodyMeasurementField;

function isSameLocalDay(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatEntrySummary(entry: BodyMeasurementEntry, t: (key: string, params?: Record<string, string | number>) => string) {
  return BODY_MEASUREMENT_FIELDS.filter(({ field }) => entry[field] != null)
    .map(({ field, labelKey }) => `${t(labelKey)}: ${entry[field]} cm`)
    .join(" · ");
}

// Samme mønster som vægt-kalibrerings hvilende, kantløse talfelt — kun en
// bundkant ved fokus, så hvileværdien læses som tekst, ikke et udfyldt felt.
function InlineMeasurementInput({
  value,
  onChange,
  onCommit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onCommit}
      placeholder={placeholder}
      className="w-full border-b border-transparent bg-transparent px-0 py-0.5 text-left text-[17px] font-medium text-black outline-none focus:border-hf-black/30"
    />
  );
}

export default function BodyMeasurementsPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<MeasurementField, string>>(
    emptyBodyMeasurementValues,
  );
  // Dagens række (hvis en findes) — flere feltredigeringer samme dag samles i
  // denne ene række i stedet for at oprette en ny måling pr. felt, så
  // billede-dagbogens "Aktuelle mål" kan vise dem samlet.
  const todaysEntryId = useRef<string | null>(null);

  function load() {
    localApi("/api/body-measurements")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente kropsmål");
        return (await response.json()) as { entries: BodyMeasurementEntry[] };
      })
      .then((data) => {
        setEntries(data.entries);
        const now = new Date().toISOString();
        const today = data.entries.find((entry) => isSameLocalDay(entry.measuredAt, now));
        todaysEntryId.current = today?.id ?? null;
        const next = emptyBodyMeasurementValues();
        for (const { field } of BODY_MEASUREMENT_FIELDS) {
          if (today?.[field] != null) next[field] = String(today[field]);
        }
        setValues(next);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function commitField(field: MeasurementField) {
    const raw = values[field];
    const parsed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (parsed !== null && (!parsed || parsed <= 0)) return;

    setSaving(true);
    try {
      if (todaysEntryId.current) {
        const response = await localApi(`/api/body-measurements/${todaysEntryId.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: parsed }),
        });
        if (response.ok) load();
        return;
      }

      if (parsed === null) return;
      const response = await localApi("/api/body-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: parsed }),
      });
      if (response.ok) {
        const data = (await response.json()) as { entry: BodyMeasurementEntry };
        todaysEntryId.current = data.entry.id;
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (todaysEntryId.current === id) todaysEntryId.current = null;
    await localApi(`/api/body-measurements/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <HfScreen title={t("bodyMeasurements.title")}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("bodyMeasurements.intro")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-hf-tan p-4">
          {BODY_MEASUREMENT_FIELDS.map(({ field, labelKey }) => (
            <label key={field} className="flex flex-col gap-1 text-left">
              <span className="text-[13px] font-semibold text-hf-black">{t(labelKey)}</span>
              <InlineMeasurementInput
                value={values[field]}
                onChange={(value) => setValues((current) => ({ ...current, [field]: value }))}
                onCommit={() => commitField(field)}
                placeholder={t("bodyMeasurements.placeholder")}
              />
            </label>
          ))}
          {saving && (
            <p className="col-span-2 text-center text-[11px] text-hf-black opacity-50">
              {t("bodyMeasurements.saving")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {loading && (
            <p className="text-center text-[13px] text-hf-black opacity-60">{t("bodyMeasurements.loading")}</p>
          )}
          {!loading && entries.length === 0 && (
            <p className="text-center text-[13px] text-hf-black opacity-60">
              {t("bodyMeasurements.noEntriesYet")}
            </p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
              <div>
                <p className="text-[13px] font-bold text-hf-black">
                  {formatEntrySummary(entry, t)}
                  <span className="ml-2 text-[12px] font-normal opacity-60">
                    {formatDateTime(entry.measuredAt)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label={t("bodyMeasurements.deleteAria")}
                className="px-2 text-[13px] font-semibold text-hf-black opacity-50"
              >
                {t("bodyMeasurements.delete")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </HfScreen>
  );
}
