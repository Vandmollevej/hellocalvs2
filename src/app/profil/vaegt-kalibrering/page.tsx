"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScreenHeader } from "@/components/hf/ScreenHeader";

type RelativeTime = "BEFORE" | "AFTER" | "UNKNOWN";
type TimeOfDay = "MORNING" | "EVENING" | "UNKNOWN";

type WeightEntry = {
  id: string;
  weightKg: number;
  clothed: boolean;
  toilet: RelativeTime;
  meal: RelativeTime;
  timeOfDay: TimeOfDay;
  note: string | null;
  weighedAt: string;
};

const TOILET_LABELS: Record<RelativeTime, string> = {
  BEFORE: "Før toilet",
  AFTER: "Efter toilet",
  UNKNOWN: "Toilet ikke angivet",
};

const MEAL_LABELS: Record<RelativeTime, string> = {
  BEFORE: "Før mad",
  AFTER: "Efter mad",
  UNKNOWN: "Mad ikke angivet",
};

const TIME_LABELS: Record<TimeOfDay, string> = {
  MORNING: "Morgen",
  EVENING: "Aften",
  UNKNOWN: "",
};

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

export default function WeightCalibrationPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightKg, setWeightKg] = useState("");
  const [clothed, setClothed] = useState<"true" | "false">("true");
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
          toilet,
          meal,
          timeOfDay,
        }),
      });
      if (response.ok) {
        setWeightKg("");
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
      <ScreenHeader title="Vægt kalibrering" onBack={() => router.back()} />

      <div className="flex flex-col gap-4 p-4">
        <p className="text-[13px] text-hf-black opacity-60">
          Vej dig på forskellige tidspunkter og under forskellige forhold — så får du en fornemmelse
          af dit udsving i løbet af dagen, uden at skulle veje dig nøgen hver gang.
        </p>

        <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
              Vægt (kg)
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={weightKg}
              onChange={(event) => setWeightKg(event.target.value)}
              className="rounded-xl bg-hf-cream px-4 py-3 text-[15px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
              placeholder="fx 78,4"
            />
          </label>

          <Segmented
            value={clothed}
            onChange={setClothed}
            options={[
              { value: "false", label: "Uden tøj" },
              { value: "true", label: "Med tøj" },
            ]}
          />
          <Segmented
            value={timeOfDay}
            onChange={setTimeOfDay}
            options={[
              { value: "MORNING", label: "Morgen" },
              { value: "EVENING", label: "Aften" },
              { value: "UNKNOWN", label: "Andet" },
            ]}
          />
          <Segmented
            value={toilet}
            onChange={setToilet}
            options={[
              { value: "BEFORE", label: "Før toilet" },
              { value: "AFTER", label: "Efter toilet" },
              { value: "UNKNOWN", label: "Ved ikke" },
            ]}
          />
          <Segmented
            value={meal}
            onChange={setMeal}
            options={[
              { value: "BEFORE", label: "Før mad" },
              { value: "AFTER", label: "Efter mad" },
              { value: "UNKNOWN", label: "Ved ikke" },
            ]}
          />

          <button
            type="button"
            onClick={submit}
            disabled={saving || !weightKg}
            className="hf-btn-primary mt-1 w-full py-3 text-[15px] disabled:opacity-50"
          >
            Registrér vejning
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {loading && <p className="text-center text-[13px] text-hf-black opacity-60">Henter…</p>}
          {!loading && entries.length === 0 && (
            <p className="text-center text-[13px] text-hf-black opacity-60">
              Ingen vejninger registreret endnu.
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
                    entry.clothed ? "Med tøj" : "Uden tøj",
                    TIME_LABELS[entry.timeOfDay] || null,
                    entry.toilet !== "UNKNOWN" ? TOILET_LABELS[entry.toilet] : null,
                    entry.meal !== "UNKNOWN" ? MEAL_LABELS[entry.meal] : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label="Slet vejning"
                className="px-2 text-[13px] font-semibold text-hf-black opacity-50"
              >
                Slet
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
