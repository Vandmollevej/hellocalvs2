"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconMoon,
  IconScale,
  IconHeartbeat,
  IconSettings,
  IconChevronUp,
  IconChevronDown,
} from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { BottomNav } from "@/components/BottomNav";
import { latestTrendWeight, type MealSample, type WeightSample } from "@/lib/weight-trend";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  healthImportRequested: boolean;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-xl bg-hf-tan px-4 py-3 text-[15px] text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green";

function NumberField({
  value,
  onChange,
  step = 1,
  inputMode = "decimal",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  inputMode?: "decimal" | "numeric";
}) {
  function nudge(delta: number) {
    const next = Math.round(((value ?? 0) + delta) * 100) / 100;
    onChange(next);
  }

  return (
    <div className="flex items-stretch rounded-xl bg-hf-tan pr-2">
      <input
        type="number"
        inputMode={inputMode}
        className="w-full min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-hf-black outline-none"
        value={value ?? ""}
        onChange={(event) =>
          onChange(event.target.value === "" ? null : Number(event.target.value))
        }
      />
      <div className="flex flex-col justify-center gap-0.5">
        <button
          type="button"
          aria-label="Øg"
          onClick={() => nudge(step)}
          className="flex h-3.5 w-4 items-center justify-center text-hf-black"
        >
          <IconChevronUp size={14} stroke={2.5} />
        </button>
        <button
          type="button"
          aria-label="Reducér"
          onClick={() => nudge(-step)}
          className="flex h-3.5 w-4 items-center justify-center text-hf-black"
        >
          <IconChevronDown size={14} stroke={2.5} />
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendWeightKg, setTrendWeightKg] = useState<number | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as { user: ProfileUser };
      })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/weight-entries").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente vejninger");
        return (await response.json()) as { entries: WeightSample[] };
      }),
      fetch("/api/registrations").then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente registreringer");
        return (await response.json()) as { registrations: MealSample[] };
      }),
    ])
      .then(([weightData, registrationData]) => {
        if (cancelled) return;
        setTrendWeightKg(latestTrendWeight(weightData.entries, registrationData.registrations));
      })
      .catch(() => {
        if (!cancelled) setTrendWeightKg(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof ProfileUser>(key: K, value: ProfileUser[K]) {
    setUser((current) => (current ? { ...current, [key]: value } : current));

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }).catch(() => {});
    }, 500);
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Mine oplysninger" onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? "Henter…" : "Kunne ikke hente profil."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <Field label="Navn">
            <input
              className={inputClass}
              value={user.displayName}
              onChange={(event) => update("displayName", event.target.value)}
            />
          </Field>

          <Field label="E-mail">
            <input className={`${inputClass} opacity-60`} value={user.email} disabled />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vægt (kg)">
              <NumberField
                value={user.weightKg}
                onChange={(value) => update("weightKg", value)}
              />
              {trendWeightKg !== null && (
                <span className="text-[11px] text-hf-black opacity-60">
                  Trendvægt (AI-estimat): {trendWeightKg.toFixed(1)} kg
                </span>
              )}
            </Field>

            <Field label="Højde (cm)">
              <NumberField
                value={user.heightCm}
                onChange={(value) => update("heightCm", value)}
              />
            </Field>

            <Field label="Fødselsår">
              <NumberField
                value={user.birthYear}
                inputMode="numeric"
                onChange={(value) => update("birthYear", value)}
              />
            </Field>

            <Field label="Køn">
              <div className="relative">
                <select
                  className={`${inputClass} w-full appearance-none pr-9`}
                  value={user.sex ?? ""}
                  onChange={(event) =>
                    update("sex", event.target.value === "" ? null : (event.target.value as Sex))
                  }
                >
                  <option value="">Ikke angivet</option>
                  <option value="FEMALE">Kvinde</option>
                  <option value="MALE">Mand</option>
                </select>
                <IconChevronDown
                  size={16}
                  stroke={2.5}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-hf-black"
                />
              </div>
            </Field>
          </div>

          <AccordionCard>
            <ChevronRow
              icon={<IconScale size={20} />}
              label="Vægt kalibrering"
              href="/profile/weight-calibration"
            />
            <ChevronRow
              icon={<IconMoon size={20} />}
              label="Søvnmønster"
              href="/profile/sleep"
            />
            <ChevronRow
              icon={<IconHeartbeat size={20} />}
              label={user.healthImportRequested ? "Sundhedsdata (smartwatch) — opsat" : "Sundhedsdata (smartwatch)"}
              onClick={() => update("healthImportRequested", !user.healthImportRequested)}
            />
            <ChevronRow
              icon={<IconSettings size={20} />}
              label="Indstillinger"
              href="/profile/settings"
              divider={false}
            />
          </AccordionCard>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
