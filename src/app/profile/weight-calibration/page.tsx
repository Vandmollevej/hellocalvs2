"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { IconMoon, IconShoe, IconShoeOff, IconSun } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ActionButton } from "@/components/hf/ActionButton";
import {
  IconPersonClothed,
  IconPersonUnclothed,
  IconPlateEmpty,
  IconPlateFull,
  IconToiletCheck,
  IconToiletOff,
} from "@/components/icons/WeighConditions";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatWeight, parseWeightInput, useUnits, weightToInputValue, weightUnitLabel, type WeightUnit } from "@/lib/units";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { EntryDetailsSheet, type EntrySource } from "@/components/hf/EntryDetailsSheet";
import { formatBodyMetric, orderBodyMetrics } from "@/lib/body-metrics";

type RelativeTime = "BEFORE" | "AFTER" | "UNKNOWN";
type TimeOfDay = "MORNING" | "EVENING" | "UNKNOWN";
type ShoesState = "ON" | "OFF" | "UNKNOWN";

type WeightEntry = {
  id: string;
  weightKg: number;
  clothed: boolean;
  shoes: ShoesState;
  toilet: RelativeTime;
  meal: RelativeTime;
  timeOfDay: TimeOfDay;
  // MANUAL = indtastet; alt andet er synkroniseret fra en integration og kan
  // ikke slettes (brugerkrav 2026-10-03).
  source: string;
  note: string | null;
  weighedAt: string;
};

type EntryDetails = {
  source: { label: string; icon: string | null } | null;
  metrics: { type: string; value: number }[];
};

const isSynced = (entry: WeightEntry) => entry.source !== "MANUAL";

type T = (key: string) => string;

const TIME_GRID_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];
const RECENT_ENTRY_LIMIT = 5;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}


function todayAtHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

// Today's whole-hour entries (created by the day list), keyed by hour, so
// editing a slot updates that row instead of creating a duplicate. Synced
// weigh-ins are never edited here.
function todaysSlotEntries(entries: WeightEntry[]) {
  const map: Record<number, WeightEntry> = {};
  const now = new Date();
  for (const entry of entries) {
    const weighedAt = new Date(entry.weighedAt);
    const isToday =
      weighedAt.getFullYear() === now.getFullYear() &&
      weighedAt.getMonth() === now.getMonth() &&
      weighedAt.getDate() === now.getDate();
    if (isToday && !isSynced(entry) && weighedAt.getMinutes() === 0 && weighedAt.getSeconds() === 0) {
      map[weighedAt.getHours()] ??= entry;
    }
  }
  return map;
}

function describeEntry(entry: WeightEntry, t: T) {
  return [
    entry.clothed ? t("weightCalibration.clothed.true") : t("weightCalibration.clothed.false"),
    entry.shoes === "ON" ? t("weightCalibration.shoes.on") : entry.shoes === "OFF" ? t("weightCalibration.shoes.off") : null,
    entry.timeOfDay === "MORNING"
      ? t("weightCalibration.timeOfDay.morning")
      : entry.timeOfDay === "EVENING"
        ? t("weightCalibration.timeOfDay.evening")
        : null,
    entry.toilet === "BEFORE" ? t("weightCalibration.toilet.before") : entry.toilet === "AFTER" ? t("weightCalibration.toilet.after") : null,
    entry.meal === "BEFORE" ? t("weightCalibration.meal.before") : entry.meal === "AFTER" ? t("weightCalibration.meal.after") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// A real, visible number field with the weight unit as suffix inside it.
function KgField({
  id,
  value,
  onChange,
  placeholder,
  unit,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  unit: WeightUnit;
}) {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border border-hf-gray-border bg-hf-white px-3 focus-within:border-hf-black">
      <input
        id={id}
        type="text"
        inputMode={unit === "st" ? "text" : "decimal"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={unit === "st" ? "11 5" : placeholder}
        className="hf-type-title min-w-0 flex-1 bg-transparent text-hf-black outline-none placeholder:text-hf-black/35"
      />
      <span className="hf-type-body hf-type-strong text-hf-black/60">{weightUnitLabel(unit)}</span>
    </div>
  );
}

// Every condition is a pair of opposites shown side by side, each with its
// own weight field (user feedback 2026-09-26: on/off toggles meant nothing
// without a number, and clothes vs. shoes are the same kind of condition).
// A filled field becomes one weigh-in with exactly that condition set.
type Condition = {
  key: string;
  label: string;
  icon: ReactNode;
  fields: Partial<Pick<WeightEntry, "clothed" | "shoes" | "toilet" | "meal" | "timeOfDay">>;
};

function conditionPairs(t: T): [Condition, Condition][] {
  return [
    [
      { key: "unclothed", label: t("weightCalibration.clothed.false"), icon: <IconPersonUnclothed size={24} />, fields: { clothed: false } },
      { key: "clothed", label: t("weightCalibration.clothed.true"), icon: <IconPersonClothed size={24} />, fields: { clothed: true } },
    ],
    [
      { key: "shoesOff", label: t("weightCalibration.shoes.off"), icon: <IconShoeOff size={24} />, fields: { shoes: "OFF" } },
      { key: "shoesOn", label: t("weightCalibration.shoes.on"), icon: <IconShoe size={24} />, fields: { shoes: "ON" } },
    ],
    [
      { key: "morning", label: t("weightCalibration.timeOfDay.morning"), icon: <IconSun size={24} />, fields: { timeOfDay: "MORNING" } },
      { key: "evening", label: t("weightCalibration.timeOfDay.evening"), icon: <IconMoon size={24} />, fields: { timeOfDay: "EVENING" } },
    ],
    [
      { key: "toiletBefore", label: t("weightCalibration.toilet.before"), icon: <IconToiletOff size={24} />, fields: { toilet: "BEFORE" } },
      { key: "toiletAfter", label: t("weightCalibration.toilet.after"), icon: <IconToiletCheck size={24} />, fields: { toilet: "AFTER" } },
    ],
    [
      { key: "mealBefore", label: t("weightCalibration.meal.before"), icon: <IconPlateFull size={24} />, fields: { meal: "BEFORE" } },
      { key: "mealAfter", label: t("weightCalibration.meal.after"), icon: <IconPlateEmpty size={24} />, fields: { meal: "AFTER" } },
    ],
  ];
}

export default function WeightCalibrationPage() {
  const { t } = useTranslation();
  const { weight: weightUnit } = useUnits();
  const parseKg = (raw: string) => parseWeightInput(raw, weightUnit);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [conditionValues, setConditionValues] = useState<Record<string, string>>({});
  const [gridValues, setGridValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "nothing" | "error">("idle");
  // Info-vinduet: synkroniseret vejning (kun info) eller indtastet (slette-advarsel).
  const [openEntry, setOpenEntry] = useState<WeightEntry | null>(null);
  const [details, setDetails] = useState<EntryDetails | null>(null);

  const slotEntries = useMemo(() => todaysSlotEntries(entries), [entries]);
  const pairs = conditionPairs(t);

  function load() {
    return fetch("/api/weight-entries")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente vejninger");
        return (await response.json()) as { entries: WeightEntry[] };
      })
      .then((data) => {
        setEntries(data.entries);
        const slots = todaysSlotEntries(data.entries);
        const next: Record<number, string> = {};
        for (const hour of TIME_GRID_HOURS) {
          if (slots[hour]) next[hour] = weightToInputValue(slots[hour].weightKg, weightUnit);
        }
        setGridValues(next);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Explicit save (user decision 2026-09-25): one "Opdatér oplysninger" button
  // saves one weigh-in per filled condition field plus every changed slot in
  // the day list, instead of posting half-filled rows on blur.
  async function save() {
    const requests: Promise<Response>[] = [];

    for (const condition of pairs.flat()) {
      const weightKg = parseKg(conditionValues[condition.key] ?? "");
      if (weightKg === null) continue;
      requests.push(
        fetch("/api/weight-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightKg, ...condition.fields }),
        }),
      );
    }

    for (const hour of TIME_GRID_HOURS) {
      const weightKg = parseKg(gridValues[hour] ?? "");
      const existing = slotEntries[hour];
      if (weightKg === null || (existing && Math.abs(existing.weightKg - weightKg) < 0.05)) continue;
      requests.push(
        existing
          ? fetch(`/api/weight-entries/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weightKg }),
            })
          : fetch("/api/weight-entries", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weightKg, weighedAt: todayAtHour(hour).toISOString() }),
            }),
      );
    }

    if (requests.length === 0) {
      setStatus("nothing");
      return;
    }

    setSaving(true);
    try {
      const responses = await Promise.all(requests);
      if (responses.every((response) => response.ok)) {
        setConditionValues({});
        setStatus("saved");
      } else {
        setStatus("error");
      }
      await load();
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  function openDetails(entry: WeightEntry) {
    setOpenEntry(entry);
    setDetails(null);
    if (!isSynced(entry)) return;
    fetch(`/api/weight-entries/${entry.id}`)
      .then(async (response) => (response.ok ? ((await response.json()) as EntryDetails) : null))
      .then((data) => setDetails(data ?? { source: null, metrics: [] }))
      .catch(() => setDetails({ source: null, metrics: [] }));
  }

  async function remove(id: string) {
    const previous = entries;
    setEntries((current) => current.filter((entry) => entry.id !== id));
    const response = await fetch(`/api/weight-entries/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setEntries(previous);
      setStatus("error");
    }
  }

  function sheetRows(entry: WeightEntry) {
    const rows: { label: string; value: string }[] = [];
    if (!isSynced(entry)) {
      const described = describeEntry(entry, t);
      if (described) rows.push({ label: t("entrySheet.conditions"), value: described });
      return rows;
    }
    for (const metric of orderBodyMetrics(details?.metrics ?? [])) {
      const unit = metric.display.unit === "years" ? t("entrySheet.years") : metric.display.unit;
      rows.push({ label: t(`entrySheet.metrics.${metric.type}`), value: formatBodyMetric(metric.value, metric.display, unit) });
    }
    return rows;
  }

  const openSource: EntrySource | undefined = openEntry
    ? isSynced(openEntry)
      ? { kind: "synced", label: details?.source?.label ?? t(`entrySheet.sources.${openEntry.source}`), icon: details?.source?.icon ?? null }
      : { kind: "manual" }
    : undefined;

  const recentEntries = entries.slice(0, RECENT_ENTRY_LIMIT);

  return (
    <HfScreen title={t("weightCalibration.title")}>
      <div className="hf-page hf-page--sections">
        <div className="rounded-2xl bg-hf-tan px-4 py-4">
          <p className="hf-type-body text-hf-black">{t("weightCalibration.intro")}</p>
        </div>

        <section className="flex flex-col gap-4">
          {pairs.map((pair) => (
            <div key={pair[0].key} className="grid grid-cols-2 gap-3">
              {pair.map((condition) => (
                <label key={condition.key} htmlFor={`weight-${condition.key}`} className="flex min-w-0 flex-col gap-2">
                  <span className="hf-type-body hf-type-strong flex items-center gap-2 text-hf-black">
                    <span className="shrink-0">{condition.icon}</span>
                    <span className="truncate">{condition.label}</span>
                  </span>
                  <KgField
                    id={`weight-${condition.key}`}
                    value={conditionValues[condition.key] ?? ""}
                    onChange={(value) => setConditionValues((current) => ({ ...current, [condition.key]: value }))}
                    placeholder={t("weightCalibration.weightPlaceholder")}
                    unit={weightUnit}
                  />
                </label>
              ))}
            </div>
          ))}
        </section>

        <section className="flex flex-col">
          <h2 className="hf-type-title pb-2 text-left text-hf-black">
            {t("weightCalibration.timeGrid.title")}
          </h2>
          <div className="border-t border-hf-tan-dark">
            {TIME_GRID_HOURS.map((hour) => (
              <label
                key={hour}
                htmlFor={`weight-slot-${hour}`}
                className="flex h-16 items-center gap-4 border-b border-hf-tan-dark"
              >
                <span className="hf-type-body hf-type-strong w-12 shrink-0 text-hf-black/60">
                  {String(hour).padStart(2, "0")}:00
                </span>
                <input
                  id={`weight-slot-${hour}`}
                  type="text"
                  inputMode={weightUnit === "st" ? "text" : "decimal"}
                  value={gridValues[hour] ?? ""}
                  onChange={(event) =>
                    setGridValues((current) => ({ ...current, [hour]: event.target.value }))
                  }
                  placeholder={t("weightCalibration.timeGrid.placeholder")}
                  className="hf-type-title h-full min-w-0 flex-1 bg-transparent text-hf-black outline-none placeholder:text-hf-black/30"
                />
                <span className="hf-type-body hf-type-strong text-hf-black/60">{weightUnitLabel(weightUnit)}</span>
              </label>
            ))}
          </div>
        </section>

        {(loading || recentEntries.length > 0) && (
          <section className="flex flex-col gap-2">
            <h2 className="hf-type-title text-left text-hf-black">
              {t("weightCalibration.recentTitle")}
            </h2>
            {loading && (
              <SkeletonScreen className="">
                <SkeletonCards count={3} height={48} radius={16} />
              </SkeletonScreen>
            )}
            {recentEntries.map((entry) => (
              <div key={entry.id} className="hf-control-row flex items-center justify-between rounded-2xl bg-hf-tan px-4">
                <div>
                  <p className="hf-type-body hf-type-strong text-hf-black">
                    {formatWeight(entry.weightKg, weightUnit)}
                    <span className="hf-type-small text-text-secondary ml-2">
                      {formatDateTime(entry.weighedAt)}
                    </span>
                  </p>
                  <p className="hf-type-small text-text-secondary">{describeEntry(entry, t)}</p>
                </div>
                {isSynced(entry) ? (
                  <button
                    type="button"
                    onClick={() => openDetails(entry)}
                    aria-label={t("weightCalibration.syncedAria")}
                    className="hf-type-small hf-type-strong text-text-secondary px-2"
                  >
                    {t("weightCalibration.synced")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDetails(entry)}
                    aria-label={t("weightCalibration.deleteAria")}
                    className="hf-type-small hf-type-strong text-text-secondary px-2"
                  >
                    {t("weightCalibration.delete")}
                  </button>
                )}
              </div>
            ))}
          </section>
        )}

        <div className="flex flex-col gap-2">
          {status !== "idle" && !saving && (
            <p role="status" className="hf-type-small text-text-secondary text-center">
              {t(`weightCalibration.status.${status}`)}
            </p>
          )}
          <ActionButton
            onClick={save}
            disabled={saving}
            aria-busy={saving}
            className="hf-type-button h-14 disabled:opacity-40"
          >
            {saving ? t("weightCalibration.saving") : t("weightCalibration.submit")}
          </ActionButton>
        </div>
      </div>
      {openEntry && (
        <EntryDetailsSheet
          title={formatWeight(openEntry.weightKg, weightUnit)}
          subtitle={formatDateTime(openEntry.weighedAt)}
          source={openSource}
          rows={sheetRows(openEntry)}
          loading={isSynced(openEntry) && details === null}
          onDelete={isSynced(openEntry) ? undefined : () => void remove(openEntry.id)}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </HfScreen>
  );
}
