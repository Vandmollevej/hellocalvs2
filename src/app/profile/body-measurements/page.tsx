"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  BODY_MEASUREMENT_FIELDS,
  emptyBodyMeasurementValues,
  isBodyMeasurementVisible,
  type BodyMeasurementVisibility,
  type BodyMeasurementField,
  type BodyMeasurementSex,
} from "@/lib/body-measurements";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { addChartsToLayout, BODY_MEASUREMENT_CHART_KEYS } from "@/lib/stat-charts";
import { cmToIn, formatLength, inToCm, lengthUnitLabel, useUnits, type HeightUnit } from "@/lib/units";

type BodyMeasurementEntry = {
  id: string;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  thighCm: number | null;
  upperArmCm: number | null;
  neckCm: number | null;
  buttockCm: number | null;
  ankleCm: number | null;
  calfCm: number | null;
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

function formatEntrySummary(
  entry: BodyMeasurementEntry,
  t: (key: string, params?: Record<string, string | number>) => string,
  unit: HeightUnit,
) {
  return BODY_MEASUREMENT_FIELDS.filter(({ field }) => entry[field] != null)
    .map(({ field, labelKey }) => `${t(labelKey)}: ${formatLength(entry[field] as number, unit)}`)
    .join(" · ");
}

// Samme mønster som vægt-kalibreringens dagliste: titel til venstre, tallet
// på samme linje til højre med enheden efter — aldrig under overskriften
// (brugerkrav 2026-09-30). Tomt felt viser blot "–", intet forslag til tal.
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
      className="hf-type-title w-20 min-w-0 border-b border-transparent bg-transparent px-0 py-0.5 text-right text-hf-black outline-none placeholder:text-hf-black/30 focus:border-hf-black/30"
    />
  );
}

export default function BodyMeasurementsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { height: lengthUnit } = useUnits();
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
  // Køn læses fra profilen og styrer kun, hvilke tegninger der vises: mand →
  // mandlige tegninger, kvinde → kvindelige. Uden valgt køn (eller før
  // profilen er hentet) gættes der ikke — kortene vises da uden tegning
  // (brugerkrav 2026-09-30: en mand må aldrig få vist de kvindelige figurer).
  const [sex, setSex] = useState<BodyMeasurementSex | null>(null);
  const [sexLoaded, setSexLoaded] = useState(false);
  // Hvilke mål brugeren har valgt at vise (Indstillinger → Visning → Kropsmål).
  const [visibility, setVisibility] = useState<BodyMeasurementVisibility | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as {
          user: { sex: BodyMeasurementSex | null; bodyMeasurementVisibility: BodyMeasurementVisibility | null };
        };
      })
      .then((data) => {
        setSex(data.user.sex ?? null);
        setVisibility(data.user.bodyMeasurementVisibility ?? null);
        setSexLoaded(true);
      })
      .catch(() => {});
  }, []);

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
        const next = emptyBodyMeasurementValues();
        for (const { field } of BODY_MEASUREMENT_FIELDS) {
          const cm = today?.[field];
          if (cm != null) next[field] = String(lengthUnit === "in" ? Math.round(cmToIn(cm) * 10) / 10 : cm);
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
    const typed = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (typed !== null && (!typed || typed <= 0)) return;
    // Indtastet i den valgte enhed, gemmes altid i cm.
    const parsed = typed === null ? null : lengthUnit === "in" ? Math.round(inToCm(typed) * 10) / 10 : typed;

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
    <HfScreen title={t("bodyMeasurements.title")}>
      <div className="hf-page">
        <div className="hf-card hf-card--brand">
          <p className="hf-type-small">{t("bodyMeasurements.intro")}</p>
        </div>

        {sexLoaded && sex === null && (
          <p className="hf-type-small text-text-secondary text-center">
            {t("bodyMeasurements.chooseSexHint")}
          </p>
        )}

        {/* Ét kort pr. mål i Statistik-kortenes stil: tegning til venstre i fast
            bredde (så titlerne flugter), titel og felt på samme linje til højre. */}
        <div className="flex flex-col gap-3">
          {BODY_MEASUREMENT_FIELDS.filter(({ field }) => isBodyMeasurementVisible(visibility, field)).map(({ field, labelKey, image }) => (
            <label key={field} className="items-center text-left hf-card--row hf-card--form hf-card">
              <span className="flex h-[108px] w-20 shrink-0 items-center justify-center">
                {image && sex && (
                  <Image
                    src={image[sex]}
                    alt=""
                    width={80}
                    height={108}
                    className="h-full w-full object-contain"
                  />
                )}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="hf-type-body hf-type-strong text-hf-black">{t(labelKey)}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <InlineMeasurementInput
                    value={values[field]}
                    onChange={(value) => setValues((current) => ({ ...current, [field]: value }))}
                    onCommit={() => commitField(field)}
                    placeholder={t("bodyMeasurements.placeholder")}
                  />
                  <span className="hf-type-body text-text-secondary shrink-0">{lengthUnitLabel(lengthUnit)}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
        {/* Lægger kropsmål-graferne (tegning til venstre, forløb til højre)
            nederst i Statistik-sidens grafer og åbner den. */}
        <button
          type="button"
          onClick={() => {
            addChartsToLayout(BODY_MEASUREMENT_CHART_KEYS);
            router.push("/statistics");
          }}
          className="hf-type-small hf-type-strong text-hf-black underline text-center"
        >
          {t("bodyMeasurementChart.showInStats")}
        </button>
        {saving && (
          <p className="hf-type-micro text-text-secondary text-center">
            {t("bodyMeasurements.saving")}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {loading && (
            <SkeletonScreen className="flex flex-col gap-2">
              <SkeletonCards count={3} height={48} radius={16} />
            </SkeletonScreen>
          )}
          {!loading && entries.length === 0 && (
            <p className="hf-type-small text-text-secondary text-center">
              {t("bodyMeasurements.noEntriesYet")}
            </p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="hf-control-row flex items-center justify-between rounded-2xl bg-hf-tan px-4">
              <div>
                <p className="hf-type-small hf-type-strong text-hf-black">
                  {formatEntrySummary(entry, t, lengthUnit)}
                  <span className="hf-type-small text-text-secondary ml-2">
                    {formatDateTime(entry.measuredAt)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label={t("bodyMeasurements.deleteAria")}
                className="hf-type-small hf-type-strong text-text-secondary px-2"
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
