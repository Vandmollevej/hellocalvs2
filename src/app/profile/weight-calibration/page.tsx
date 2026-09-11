"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
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

// Item 7 (2026-09-02): fields whose value is a placeholder/default rather
// than an active choice ("Ved ikke") never get the affirmative green
// selected treatment — otherwise the default state looks like the user
// already made a choice.
type SegmentOption<V extends string> = { value: V; label: string; neutral?: boolean };

const TIME_GRID_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];

function toiletLabels(t: T): Record<RelativeTime, string> {
  return {
    BEFORE: t("weightCalibration.toilet.before"),
    AFTER: t("weightCalibration.toilet.after"),
    UNKNOWN: t("weightCalibration.toilet.unknownLabel"),
  };
}

function mealLabels(t: T): Record<RelativeTime, string> {
  return {
    BEFORE: t("weightCalibration.meal.before"),
    AFTER: t("weightCalibration.meal.after"),
    UNKNOWN: t("weightCalibration.meal.unknownLabel"),
  };
}

function shoesLabels(t: T): Record<ShoesState, string> {
  return {
    ON: t("weightCalibration.shoes.on"),
    OFF: t("weightCalibration.shoes.off"),
    UNKNOWN: t("weightCalibration.shoes.unknownLabel"),
  };
}

function timeLabels(t: T): Record<TimeOfDay, string> {
  return {
    MORNING: t("weightCalibration.timeOfDay.morning"),
    EVENING: t("weightCalibration.timeOfDay.evening"),
    UNKNOWN: "",
  };
}

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

function todayAtHour(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
}

function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${
            !option.neutral && value === option.value
              ? "bg-hf-green text-hf-white"
              : "bg-hf-tan text-hf-black opacity-70"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Item 7 (2026-09-02): "Morgen"/"Aften" side by side, no decorative arrow or
// third "Ved ikke" slot between them — it was read as a navigation control
// rather than a plain two-way choice.
function MorningEveningRow({
  value,
  onChange,
  t,
}: {
  value: TimeOfDay;
  onChange: (value: TimeOfDay) => void;
  t: T;
}) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange("MORNING")}
        className={`flex-1 rounded-lg px-2 py-2 text-center text-[13px] font-semibold ${
          value === "MORNING" ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black opacity-70"
        }`}
      >
        {t("weightCalibration.timeOfDay.morning")}
      </button>
      <button
        type="button"
        onClick={() => onChange("EVENING")}
        className={`flex-1 rounded-lg px-2 py-2 text-center text-[13px] font-semibold ${
          value === "EVENING" ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black opacity-70"
        }`}
      >
        {t("weightCalibration.timeOfDay.evening")}
      </button>
    </div>
  );
}

// Item 7 (2026-09-02): a plain, borderless number input that only reveals an
// edit affordance (bottom border) once focused — the resting value should
// read as text, not as a filled form field.
function InlineWeightInput({
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

export default function WeightCalibrationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightWithoutClothes, setWeightWithoutClothes] = useState("");
  const [weightWithClothes, setWeightWithClothes] = useState("");
  const [shoes, setShoes] = useState<ShoesState>("UNKNOWN");
  const [toilet, setToilet] = useState<RelativeTime>("UNKNOWN");
  const [meal, setMeal] = useState<RelativeTime>("UNKNOWN");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("UNKNOWN");
  const [saving, setSaving] = useState(false);

  const [gridValues, setGridValues] = useState<Record<number, string>>({});

  function load() {
    fetch("/api/weight-entries")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente vejninger");
        return (await response.json()) as { entries: WeightEntry[] };
      })
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  // Existing today-at-the-hour entries, so re-editing a grid slot updates the
  // same row instead of creating a duplicate for that hour.
  const gridEntryIdByHour = useMemo(() => {
    const map: Record<number, string> = {};
    const now = new Date();
    for (const entry of entries) {
      const weighedAt = new Date(entry.weighedAt);
      const isToday =
        weighedAt.getFullYear() === now.getFullYear() &&
        weighedAt.getMonth() === now.getMonth() &&
        weighedAt.getDate() === now.getDate();
      if (isToday && weighedAt.getMinutes() === 0 && weighedAt.getSeconds() === 0) {
        map[weighedAt.getHours()] = entry.id;
      }
    }
    return map;
  }, [entries]);

  // Gemmer i realtid, uden en synlig "Gem"-knap: udløses når brugeren forlader
  // vægtfeltet (onBlur), og tager de segmenterede valg med, som allerede er
  // sat på det tidspunkt. Kaldes bevidst IKKE fra hvert segment-valgs onChange
  // — det ville poste en ny, ufuldstændig vejningsrække pr. tryk (og tømme
  // vægtfeltet undervejs), i stedet for én samlet række pr. vejning.
  async function submitClothed(clothed: boolean, rawValue: string, clear: () => void) {
    const parsed = Number(rawValue.replace(",", "."));
    if (!parsed || parsed <= 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/weight-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: parsed,
          clothed,
          shoes,
          toilet,
          meal,
          timeOfDay,
        }),
      });
      if (response.ok) {
        clear();
        setShoes("UNKNOWN");
        setToilet("UNKNOWN");
        setMeal("UNKNOWN");
        setTimeOfDay("UNKNOWN");
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function submitGridSlot(hour: number) {
    const rawValue = gridValues[hour] ?? "";
    const parsed = Number(rawValue.replace(",", "."));
    if (!parsed || parsed <= 0) return;

    const existingId = gridEntryIdByHour[hour];
    setSaving(true);
    try {
      const response = existingId
        ? await fetch(`/api/weight-entries/${existingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weightKg: parsed }),
          })
        : await fetch("/api/weight-entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              weightKg: parsed,
              weighedAt: todayAtHour(hour).toISOString(),
            }),
          });
      if (response.ok) load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    await fetch(`/api/weight-entries/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <HfScreen
      title={t("weightCalibration.title")}
      onBack={() => router.back()}
    >

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-left text-[17px] font-semibold text-hf-black">
            {t("weightCalibration.timeGrid.title")}
          </h2>
          <div className="grid grid-cols-4 gap-x-3 gap-y-3">
            {TIME_GRID_HOURS.map((hour) => (
              <div key={hour} className="flex flex-col gap-0.5 text-left">
                <span className="text-[13px] font-medium text-hf-black opacity-60">
                  {String(hour).padStart(2, "0")}
                </span>
                <InlineWeightInput
                  value={gridValues[hour] ?? ""}
                  onChange={(value) => setGridValues((current) => ({ ...current, [hour]: value }))}
                  onCommit={() => submitGridSlot(hour)}
                  placeholder={t("weightCalibration.timeGrid.placeholder")}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-hf-green px-4 py-4 text-hf-white">
          <p className="text-[13px] leading-5">{t("weightCalibration.intro")}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[15px] font-semibold text-hf-black">
              {t("weightCalibration.clothed.false")}
            </span>
            <div className="flex items-baseline gap-1">
              <InlineWeightInput
                value={weightWithoutClothes}
                onChange={setWeightWithoutClothes}
                onCommit={() =>
                  submitClothed(false, weightWithoutClothes, () => setWeightWithoutClothes(""))
                }
                placeholder={t("weightCalibration.weightPlaceholder")}
              />
              <span className="text-[13px] font-medium text-hf-black opacity-60">kg</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-left">
            <span className="text-[15px] font-semibold text-hf-black">
              {t("weightCalibration.clothed.true")}
            </span>
            <div className="flex items-baseline gap-1">
              <InlineWeightInput
                value={weightWithClothes}
                onChange={setWeightWithClothes}
                onCommit={() =>
                  submitClothed(true, weightWithClothes, () => setWeightWithClothes(""))
                }
                placeholder={t("weightCalibration.weightPlaceholder")}
              />
              <span className="text-[13px] font-medium text-hf-black opacity-60">kg</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
          <Segmented
            value={shoes}
            onChange={setShoes}
            options={[
              { value: "OFF", label: t("weightCalibration.shoes.off") },
              { value: "ON", label: t("weightCalibration.shoes.on") },
              { value: "UNKNOWN", label: t("weightCalibration.shoes.unknown"), neutral: true },
            ]}
          />
          <MorningEveningRow value={timeOfDay} onChange={setTimeOfDay} t={t} />
          <Segmented
            value={toilet}
            onChange={setToilet}
            options={[
              { value: "BEFORE", label: t("weightCalibration.toilet.before") },
              { value: "AFTER", label: t("weightCalibration.toilet.after") },
              { value: "UNKNOWN", label: t("weightCalibration.toilet.unknown"), neutral: true },
            ]}
          />
          <Segmented
            value={meal}
            onChange={setMeal}
            options={[
              { value: "BEFORE", label: t("weightCalibration.meal.before") },
              { value: "AFTER", label: t("weightCalibration.meal.after") },
              { value: "UNKNOWN", label: t("weightCalibration.meal.unknown"), neutral: true },
            ]}
          />
          {saving && <p className="text-center text-[11px] text-hf-black opacity-50">{t("weightCalibration.saving")}</p>}
        </div>

        <div className="flex flex-col gap-2">
          {loading && <p className="text-center text-[13px] text-hf-black opacity-60">{t("weightCalibration.loading")}</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-[13px] text-hf-black opacity-60">
              {t("weightCalibration.noEntriesYet")}
            </p>
          )}
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-2xl bg-hf-tan px-4 py-3"
            >
              <div>
                <p className="text-[16px] font-bold text-hf-black">
                  {formatKg(entry.weightKg)} kg
                  <span className="ml-2 text-[12px] font-normal opacity-60">
                    {formatDateTime(entry.weighedAt)}
                  </span>
                </p>
                <p className="text-[12px] text-hf-black opacity-60">
                  {[
                    entry.clothed ? t("weightCalibration.clothed.true") : t("weightCalibration.clothed.false"),
                    entry.shoes !== "UNKNOWN" ? shoesLabels(t)[entry.shoes] : null,
                    timeLabels(t)[entry.timeOfDay] || null,
                    entry.toilet !== "UNKNOWN" ? toiletLabels(t)[entry.toilet] : null,
                    entry.meal !== "UNKNOWN" ? mealLabels(t)[entry.meal] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
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
        </div>
      </div>
    </HfScreen>
  );
}
