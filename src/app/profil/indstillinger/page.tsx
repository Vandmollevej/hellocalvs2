"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { ALLERGEN_CATALOG } from "@/lib/allergens";
import { REGIONS } from "@/lib/regions";

type SettingsUser = {
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
  region: string;
};

export default function IndstillingerPage() {
  const router = useRouter();
  const [user, setUser] = useState<SettingsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
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

  function isAllergenVisible(key: string) {
    if (!user?.allergenVisibility) return true;
    return user.allergenVisibility[key] !== false;
  }

  function toggleShowAllergens(value: boolean) {
    setUser((current) => (current ? { ...current, showAllergens: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showAllergens: value }),
    }).catch(() => {});
  }

  function updateRegion(region: string) {
    setUser((current) => (current ? { ...current, region } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region }),
    }).catch(() => {});
  }

  function toggleAllergen(key: string, value: boolean) {
    setUser((current) => {
      if (!current) return current;
      const nextVisibility = { ...(current.allergenVisibility ?? {}), [key]: value };
      fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allergenVisibility: nextVisibility }),
      }).catch(() => {});
      return { ...current, allergenVisibility: nextVisibility };
    });
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Indstillinger" onBack={() => router.back()} />

      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? "Henter…" : "Kunne ikke hente indstillinger."}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-hf-tan px-4 py-4">
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-hf-black">Region</span>
              <span className="block text-[12px] text-hf-black opacity-60">
                Prioriterer produktsøgning efter dit lands stregkoder.
              </span>
            </span>
            <div className="relative">
              <select
                className="appearance-none rounded-xl border border-hf-tan-dark bg-white py-2 pl-3 pr-8 text-[14px] text-hf-black"
                value={user.region}
                onChange={(event) => updateRegion(event.target.value)}
              >
                {REGIONS.map((region) => (
                  <option key={region.code} value={region.code}>
                    {region.label}
                  </option>
                ))}
              </select>
              <IconChevronDown
                size={14}
                stroke={2.5}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-hf-black"
              />
            </div>
          </label>

          <label className="flex items-center gap-3 rounded-2xl bg-hf-tan px-4 py-4">
            <input
              type="checkbox"
              className="size-5 accent-hf-green"
              checked={user.showAllergens}
              onChange={(event) => toggleShowAllergens(event.target.checked)}
            />
            <span className="flex-1">
              <span className="block text-[15px] font-medium text-hf-black">Vis allergener</span>
              <span className="block text-[12px] text-hf-black opacity-60">
                Vis en allergen-linje på madvarer, når data findes.
              </span>
            </span>
          </label>

          {user.showAllergens && (
            <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-hf-tan">
              {ALLERGEN_CATALOG.map((allergen, index) => (
                <label
                  key={allergen.key}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    index < ALLERGEN_CATALOG.length - 1 ? "border-b border-hf-tan-dark" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-hf-green"
                    checked={isAllergenVisible(allergen.key)}
                    onChange={(event) => toggleAllergen(allergen.key, event.target.checked)}
                  />
                  <span className="flex-1 text-[14px] text-hf-black">{allergen.label}</span>
                </label>
              ))}
            </div>
          )}

          <p className="px-1 text-[12px] leading-relaxed text-hf-black opacity-60">
            Vi henter data fra 3. part og fraskriver os ansvar for manglende data.
          </p>
        </div>
      )}
    </div>
  );
}
