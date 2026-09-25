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
  note: string | null;
  weighedAt: string;
};

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

function formatKg(value: number) {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(value);
}

function parseKg(raw: string) {
  const parsed = Number(raw.trim().replace(",", "."));
  return raw.trim() !== "" && parsed > 0 ? parsed : null;
}

function todayAtHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

// Today's whole-hour entries (created by the day list), keyed by hour, so
// editing a slot updates that row instead of creating a duplicate.
function todaysSlotEntries(entries: WeightEntry[]) {
  const map: Record<number, WeightEntry> = {};
  const now = new Date();
  for (const entry of entries) {
    const weighedAt = new Date(entry.weighedAt);
    const isToday =
      weighedAt.getFullYear() === now.getFullYear() &&
      weighedAt.getMonth() === now.getMonth() &&
      weighedAt.getDate() === now.getDate();
    if (isToday && weighedAt.getMinutes() === 0 && weighedAt.getSeconds() === 0) {
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

// A real, visible number field with a "kg" suffix inside it.
function KgField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex h-12 items-center gap-2 rounded-lg border border-hf-gray-border bg-hf-white px-3 focus-within:border-hf-black">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[17px] font-medium text-hf-black outline-none placeholder:text-hf-black/35"
      />
      <span className="text-[15px] font-medium text-hf-black/60">kg</span>
    </div>
  );
}

// Two-way choice with an icon per option. Tapping the selected option again
// clears it, so "not specified" needs no separate button.
function IconChoice<V extends string>({
  value,
  onChange,
  options,
}: {
  value: V | "UNKNOWN";
  onChange: (value: V | "UNKNOWN") => void;
  options: { value: V; label: string; icon: ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? "UNKNOWN" : option.value)}
            className={`flex h-14 items-center gap-3 rounded-lg px-3 text-left text-[15px] font-semibold ${
              selected ? "bg-hf-green text-hf-white" : "bg-hf-white text-hf-black"
            }`}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function WeightCalibrationPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightWithoutClothes, setWeightWithoutClothes] = useState("");
  const [weightWithClothes, setWeightWithClothes] = useState("");
  const [shoes, setShoes] = useState<ShoesState>("UNKNOWN");
  const [toilet, setToilet] = useState<RelativeTime>("UNKNOWN");
  const [meal, setMeal] = useState<RelativeTime>("UNKNOWN");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("UNKNOWN");
  const [gridValues, setGridValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "nothing" | "error">("idle");

  const slotEntries = useMemo(() => todaysSlotEntries(entries), [entries]);

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
          if (slots[hour]) next[hour] = formatKg(slots[hour].weightKg);
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
  // saves the weigh-ins with the chosen conditions plus every changed slot in
  // the day list, instead of posting half-filled rows on blur.
  async function save() {
    const requests: Promise<Response>[] = [];
    const conditions = { shoes, toilet, meal, timeOfDay };

    for (const [clothed, raw] of [
      [false, weightWithoutClothes],
      [true, weightWithClothes],
    ] as const) {
      const weightKg = parseKg(raw);
      if (weightKg === null) continue;
      requests.push(
        fetch("/api/weight-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightKg, clothed, ...conditions }),
        }),
      );
    }

    for (const hour of TIME_GRID_HOURS) {
      const weightKg = parseKg(gridValues[hour] ?? "");
      const existing = slotEntries[hour];
      if (weightKg === null || existing?.weightKg === weightKg) continue;
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
        setWeightWithoutClothes("");
        setWeightWithClothes("");
        setShoes("UNKNOWN");
        setToilet("UNKNOWN");
        setMeal("UNKNOWN");
        setTimeOfDay("UNKNOWN");
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

  async function remove(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    await fetch(`/api/weight-entries/${id}`, { method: "DELETE" }).catch(() => {});
  }

  const recentEntries = entries.slice(0, RECENT_ENTRY_LIMIT);

  return (
    <HfScreen title={t("weightCalibration.title")}>
      <div className="hf-page hf-page--sections">
        <div className="rounded-2xl bg-hf-tan px-4 py-4">
          <p className="text-[15px] leading-6 text-hf-black">{t("weightCalibration.intro")}</p>
        </div>

        <section className="flex flex-col gap-4">
          <label htmlFor="weight-unclothed" className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[17px] font-semibold text-hf-black">
              <IconPersonUnclothed size={24} />
              {t("weightCalibration.clothed.false")}
            </span>
            <KgField
              id="weight-unclothed"
              value={weightWithoutClothes}
              onChange={setWeightWithoutClothes}
              placeholder={t("weightCalibration.weightPlaceholder")}
            />
          </label>
          <label htmlFor="weight-clothed" className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-[17px] font-semibold text-hf-black">
              <IconPersonClothed size={24} />
              {t("weightCalibration.clothed.true")}
            </span>
            <KgField
              id="weight-clothed"
              value={weightWithClothes}
              onChange={setWeightWithClothes}
              placeholder={t("weightCalibration.weightPlaceholder")}
            />
          </label>
        </section>

        <section className="flex flex-col gap-2 rounded-2xl bg-hf-tan p-4">
          <IconChoice
            value={shoes}
            onChange={setShoes}
            options={[
              { value: "OFF", label: t("weightCalibration.shoes.off"), icon: <IconShoeOff size={24} /> },
              { value: "ON", label: t("weightCalibration.shoes.on"), icon: <IconShoe size={24} /> },
            ]}
          />
          <IconChoice
            value={timeOfDay}
            onChange={setTimeOfDay}
            options={[
              { value: "MORNING", label: t("weightCalibration.timeOfDay.morning"), icon: <IconSun size={24} /> },
              { value: "EVENING", label: t("weightCalibration.timeOfDay.evening"), icon: <IconMoon size={24} /> },
            ]}
          />
          <IconChoice
            value={toilet}
            onChange={setToilet}
            options={[
              { value: "BEFORE", label: t("weightCalibration.toilet.before"), icon: <IconToiletOff size={24} /> },
              { value: "AFTER", label: t("weightCalibration.toilet.after"), icon: <IconToiletCheck size={24} /> },
            ]}
          />
          <IconChoice
            value={meal}
            onChange={setMeal}
            options={[
              { value: "BEFORE", label: t("weightCalibration.meal.before"), icon: <IconPlateFull size={24} /> },
              { value: "AFTER", label: t("weightCalibration.meal.after"), icon: <IconPlateEmpty size={24} /> },
            ]}
          />
        </section>

        <section className="flex flex-col">
          <h2 className="pb-2 text-left text-[17px] font-semibold text-hf-black">
            {t("weightCalibration.timeGrid.title")}
          </h2>
          <div className="border-t border-hf-tan-dark">
            {TIME_GRID_HOURS.map((hour) => (
              <label
                key={hour}
                htmlFor={`weight-slot-${hour}`}
                className="flex h-16 items-center gap-4 border-b border-hf-tan-dark"
              >
                <span className="w-12 shrink-0 text-[15px] font-medium text-hf-black/60">
                  {String(hour).padStart(2, "0")}:00
                </span>
                <input
                  id={`weight-slot-${hour}`}
                  type="text"
                  inputMode="decimal"
                  value={gridValues[hour] ?? ""}
                  onChange={(event) =>
                    setGridValues((current) => ({ ...current, [hour]: event.target.value }))
                  }
                  placeholder={t("weightCalibration.timeGrid.placeholder")}
                  className="h-full min-w-0 flex-1 bg-transparent text-[17px] font-medium text-hf-black outline-none placeholder:text-hf-black/30"
                />
                <span className="text-[15px] font-medium text-hf-black/60">kg</span>
              </label>
            ))}
          </div>
        </section>

        {(loading || recentEntries.length > 0) && (
          <section className="flex flex-col gap-2">
            <h2 className="text-left text-[17px] font-semibold text-hf-black">
              {t("weightCalibration.recentTitle")}
            </h2>
            {loading && <p className="text-[13px] text-hf-black opacity-60">{t("weightCalibration.loading")}</p>}
            {recentEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3">
                <div>
                  <p className="text-[16px] font-bold text-hf-black">
                    {formatKg(entry.weightKg)} kg
                    <span className="ml-2 text-[12px] font-normal opacity-60">
                      {formatDateTime(entry.weighedAt)}
                    </span>
                  </p>
                  <p className="text-[12px] text-hf-black opacity-60">{describeEntry(entry, t)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label={t("weightCalibration.deleteAria")}
                  className="px-2 text-[13px] font-semibold text-hf-black opacity-50"
                >
                  {t("weightCalibration.delete")}
                </button>
              </div>
            ))}
          </section>
        )}

        <div className="flex flex-col gap-2">
          {status !== "idle" && !saving && (
            <p role="status" className="text-center text-[13px] text-hf-black opacity-70">
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
    </HfScreen>
  );
}
