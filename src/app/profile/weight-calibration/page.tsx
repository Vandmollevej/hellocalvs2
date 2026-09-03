"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { HfChevron } from "@/components/hf/HfChevron";
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

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${
            value === option.value
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

// Item 7 (2026-09-02): side-by-side "Morgen vs. Aften" valgrække frem for en
// vertikal liste med "Ved ikke/Andet". Klik venstre/højre halvdel for at
// vælge; midterste chevron er kun dekorativ (HfChevron, aldrig teksttegnet ">").
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
    <div className="grid grid-cols-[1fr_20px_1fr] items-center gap-1">
      <button
        type="button"
        onClick={() => onChange("MORNING")}
        className={`rounded-lg px-2 py-2 text-center text-[13px] font-semibold ${
          value === "MORNING" ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black opacity-70"
        }`}
      >
        {t("weightCalibration.timeOfDay.morning")}
      </button>
      <HfChevron compact className="mx-auto text-hf-black opacity-50" />
      <button
        type="button"
        onClick={() => onChange("EVENING")}
        className={`rounded-lg px-2 py-2 text-center text-[13px] font-semibold ${
          value === "EVENING" ? "bg-hf-green text-hf-white" : "bg-hf-tan text-hf-black opacity-70"
        }`}
      >
        {t("weightCalibration.timeOfDay.evening")}
      </button>
    </div>
  );
}

export default function WeightCalibrationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightKg, setWeightKg] = useState("");
  const [clothed, setClothed] = useState<"true" | "false">("true");
  const [shoes, setShoes] = useState<ShoesState>("UNKNOWN");
  const [toilet, setToilet] = useState<RelativeTime>("UNKNOWN");
  const [meal, setMeal] = useState<RelativeTime>("UNKNOWN");
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("UNKNOWN");
  const [saving, setSaving] = useState(false);

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

  async function submit() {
    const parsed = Number(weightKg.replace(",", "."));
    if (!parsed || parsed <= 0) return;

    setSaving(true);
    try {
      const response = await fetch("/api/weight-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: parsed,
          clothed: clothed === "true",
          shoes,
          toilet,
          meal,
          timeOfDay,
        }),
      });
      if (response.ok) {
        setWeightKg("");
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

  async function remove(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
    await fetch(`/api/weight-entries/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title={t("weightCalibration.title")} onBack={() => router.back()} />

      <div className="flex flex-col gap-4 p-4">
        <p className="text-[13px] text-hf-black opacity-60">
          {t("weightCalibration.intro")}
        </p>

        <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
              {t("weightCalibration.weightLabel")}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="rounded-xl bg-hf-cream px-4 py-3 text-[15px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
              placeholder={t("weightCalibration.weightPlaceholder")}
            />
          </label>

          <Segmented
            value={clothed}
            onChange={setClothed}
            options={[
              { value: "false", label: t("weightCalibration.clothed.false") },
              { value: "true", label: t("weightCalibration.clothed.true") },
            ]}
          />
          <Segmented
            value={shoes}
            onChange={setShoes}
            options={[
              { value: "OFF", label: t("weightCalibration.shoes.off") },
              { value: "ON", label: t("weightCalibration.shoes.on") },
              { value: "UNKNOWN", label: t("weightCalibration.shoes.unknown") },
            ]}
          />
          <MorningEveningRow value={timeOfDay} onChange={setTimeOfDay} t={t} />
          <Segmented
            value={toilet}
            onChange={setToilet}
            options={[
              { value: "BEFORE", label: t("weightCalibration.toilet.before") },
              { value: "AFTER", label: t("weightCalibration.toilet.after") },
              { value: "UNKNOWN", label: t("weightCalibration.toilet.unknown") },
            ]}
          />
          <Segmented
            value={meal}
            onChange={setMeal}
            options={[
              { value: "BEFORE", label: t("weightCalibration.meal.before") },
              { value: "AFTER", label: t("weightCalibration.meal.after") },
              { value: "UNKNOWN", label: t("weightCalibration.meal.unknown") },
            ]}
          />

          <button
            type="button"
            onClick={submit}
            disabled={saving || !weightKg}
            className="hf-btn-primary mt-1 w-full py-3 text-[15px] disabled:opacity-50"
          >
            {t("weightCalibration.submit")}
          </button>
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
    </div>
  );
}
