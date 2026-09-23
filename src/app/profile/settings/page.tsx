"use client";

import { useEffect, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { ALLERGEN_CATALOG } from "@/lib/allergens";
import { REGIONS } from "@/lib/regions";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n";
import { localApi } from "@/lib/vault/local-api";

type SettingsUser = {
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
  showExtendedNutrition: boolean;
  region: string;
};

type SetupProgressUser = {
  weightKg: number | null;
};

// Language names are shown in their own language, so they are not translated.
const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "da", label: "Dansk" },
  { value: "en", label: "English" },
];

// Shared card for the select-type settings (Region, Sprog) so they stay
// visually identical.
function SetupSelectCard({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-hf-tan px-4 py-4">
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-hf-black">{label}</span>
        <span className="block text-[12px] text-hf-black opacity-60">{description}</span>
      </span>
      <div className="relative shrink-0">
        <select
          className="appearance-none rounded-xl border border-hf-tan-dark bg-white py-2 pl-3 pr-8 text-[14px] text-hf-black"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
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
  );
}

// Reuses the same "Step X of Y" + progress bar pattern as
// OnboardingWizard.tsx, per design.md §12 (reuse instead of inventing new style).
// Setup is considered complete once weight calibration has been done (at least
// one weigh-in) — see the weight-calibration page.
function SetupProgressBar({ weightSet }: { weightSet: boolean }) {
  const { t } = useTranslation();
  const steps = [
    t("settings.setupProgressStepRegion"),
    t("settings.setupProgressStepAllergens"),
    t("settings.setupProgressStepWeight"),
  ];
  const doneCount = weightSet ? steps.length : steps.length - 1;
  return (
    <div className="px-1 pb-1">
      <p className="text-center text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
        {t("settings.setupProgress", { done: doneCount, total: steps.length })}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hf-tan">
        <div
          className="h-full rounded-full bg-hf-green transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      {!weightSet && (
        <p className="mt-1 text-[12px] text-hf-black opacity-60">{t("settings.setupProgressHint")}</p>
      )}
    </div>
  );
}

export default function ProfileSettingsPage() {
  const { t, locale, setLocale } = useTranslation();
  const [user, setUser] = useState<SettingsUser | null>(null);
  const [weightSet, setWeightSet] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localApi("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setUser(data.user);
          setWeightSet(Boolean((data.user as SetupProgressUser | undefined)?.weightKg));
        }
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
    localApi("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showAllergens: value }),
    }).catch(() => {});
  }

  function toggleShowExtendedNutrition(value: boolean) {
    setUser((current) => (current ? { ...current, showExtendedNutrition: value } : current));
    localApi("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showExtendedNutrition: value }),
    }).catch(() => {});
  }

  function updateRegion(region: string) {
    setUser((current) => (current ? { ...current, region } : current));
    localApi("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region }),
    }).catch(() => {});
  }

  function toggleAllergen(key: string, value: boolean) {
    setUser((current) => {
      if (!current) return current;
      const nextVisibility = { ...(current.allergenVisibility ?? {}), [key]: value };
      localApi("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allergenVisibility: nextVisibility }),
      }).catch(() => {});
      return { ...current, allergenVisibility: nextVisibility };
    });
  }

  return (
    <HfScreen
      title={t("settings.setupTitle")}
    >
      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("settings.loading") : t("settings.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <SetupProgressBar weightSet={weightSet} />

          <SetupSelectCard
            label={t("settings.regionLabel")}
            description={t("settings.regionDescription")}
            value={user.region}
            options={REGIONS.map((region) => ({ value: region.code, label: region.label }))}
            onChange={updateRegion}
          />

          <SetupSelectCard
            label={t("settings.languageLabel")}
            description={t("settings.languageDescription")}
            value={locale}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => setLocale(isLocale(value) ? value : DEFAULT_LOCALE)}
          />

          <Toggle
            label={t("settings.showAllergens")}
            description={t("settings.showAllergensDescription")}
            checked={user.showAllergens}
            onChange={toggleShowAllergens}
          />

          {user.showAllergens && (
            <div className="-mt-2 flex flex-col gap-1 overflow-hidden rounded-b-2xl border-t border-hf-gray-light bg-hf-tan">
              {ALLERGEN_CATALOG.map((allergen, index) => (
                <div
                  key={allergen.key}
                  className={`flex items-center gap-3 px-4 py-2.5 ${
                    index < ALLERGEN_CATALOG.length - 1 ? "border-b border-hf-tan-dark" : ""
                  }`}
                >
                  <span className="flex-1 text-[14px] text-hf-black">{allergen.label}</span>
                  <Toggle
                    checked={isAllergenVisible(allergen.key)}
                    onChange={(value) => toggleAllergen(allergen.key, value)}
                  />
                </div>
              ))}
            </div>
          )}

          <Toggle
            label={t("settings.showExtendedNutrition")}
            description={t("settings.showExtendedNutritionDescription")}
            checked={user.showExtendedNutrition}
            onChange={toggleShowExtendedNutrition}
          />

          <p className="px-1 text-[12px] leading-relaxed text-hf-black opacity-60">
            {t("settings.thirdPartyDisclaimer")}
          </p>
        </div>
      )}
    </HfScreen>
  );
}
