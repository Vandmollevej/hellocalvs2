"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type BodyMeasurementEntry = {
  id: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  upperArmCm: number | null;
  measuredAt: string;
};

type MeasurementField = "waistCm" | "hipCm" | "chestCm" | "thighCm" | "upperArmCm";

const FIELDS: { field: MeasurementField; labelKey: string }[] = [
  { field: "waistCm", labelKey: "bodyMeasurements.waist" },
  { field: "hipCm", labelKey: "bodyMeasurements.hip" },
  { field: "chestCm", labelKey: "bodyMeasurements.chest" },
  { field: "thighCm", labelKey: "bodyMeasurements.thigh" },
  { field: "upperArmCm", labelKey: "bodyMeasurements.upperArm" },
];

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
  const parts: string[] = [];
  if (entry.waistCm != null) parts.push(`${t("bodyMeasurements.waist")}: ${entry.waistCm} cm`);
  if (entry.hipCm != null) parts.push(`${t("bodyMeasurements.hip")}: ${entry.hipCm} cm`);
  if (entry.chestCm != null) parts.push(`${t("bodyMeasurements.chest")}: ${entry.chestCm} cm`);
  if (entry.thighCm != null) parts.push(`${t("bodyMeasurements.thigh")}: ${entry.thighCm} cm`);
  if (entry.upperArmCm != null) parts.push(`${t("bodyMeasurements.upperArm")}: ${entry.upperArmCm} cm`);
  return parts.join(" · ");
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
  const router = useRouter();
  const [entries, setEntries] = useState<BodyMeasurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<MeasurementField, string>>({
    waistCm: "",
    hipCm: "",
    chestCm: "",
    thighCm: "",
    upperArmCm: "",
  });
  // Dagens række (hvis en findes) — flere feltredigeringer samme dag samles i
  // denne ene række i stedet for at oprette en ny måling pr. felt, så
  // billede-dagbogens "Aktuelle mål" kan vise dem samlet.
  const todaysEntryId = useRef<string | null>(null);

  function load() {
    fetch("/api/body-measurements")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente kropsmål");
        return (await response.json()) as { entries: BodyMeasurementEntry[] };
      })
      .then((data) => {
        setEntries(data.entries);
        const now = new Date().toISOString();
        const today = data.entries.find((entry) => isSameLocalDay(entry.measuredAt, now));
        todaysEntryId.current = today?.id ?? null;
        setValues({
          waistCm: today?.waistCm != null ? String(today.waistCm) : "",
          hipCm: today?.hipCm != null ? String(today.hipCm) : "",
          chestCm: today?.chestCm != null ? String(today.chestCm) : "",
          thighCm: today?.thighCm != null ? String(today.thighCm) : "",
          upperArmCm: today?.upperArmCm != null ? String(today.upperArmCm) : "",
        });
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
        const response = await fetch(`/api/body-measurements/${todaysEntryId.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: parsed }),
        });
        if (response.ok) load();
        return;
      }

      if (parsed === null) return;
      const response = await fetch("/api/body-measurements", {
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
    await fetch(`/api/body-measurements/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <HfScreen title={t("bodyMeasurements.title")} onBack={() => router.back()}>
      <div className="flex flex-col gap-4 p-4">
        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("bodyMeasurements.intro")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-hf-tan p-4">
          {FIELDS.map(({ field, labelKey }) => (
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
