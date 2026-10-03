"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { SetupSelectCard } from "@/components/hf/SetupSelectCard";
import { REGIONS } from "@/lib/regions";
import { useTranslation } from "@/i18n/LocaleProvider";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";
import { HEIGHT_UNITS, WEIGHT_UNITS, saveUnits, setUnitsRegion, useUnits, type HeightUnit, type WeightUnit } from "@/lib/units";

// Language names are shown in their own language, so they are not translated.
const LANGUAGE_OPTIONS: Array<{ value: Locale; label: string }> = [
  { value: "da", label: "Dansk" },
  { value: "en", label: "English" },
];

// "Sprog og region" — én side, som både Opsætning og Indstillinger linker til.
export default function LanguageRegionPage() {
  const { t, locale, setLocale } = useTranslation();
  const [region, setRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const units = useUnits();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setRegion(data.user?.region ?? null);
        setUnitsRegion(data.user?.region);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function updateRegion(next: string) {
    setRegion(next);
    setUnitsRegion(next);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: next }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.languageAndRegion")}>
      {loading || region === null ? (
        loading ? (
          <SkeletonScreen className="flex flex-col gap-4 p-4">
            <SkeletonToggle count={2} />
          </SkeletonScreen>
        ) : (
          <p className="text-text-secondary hf-type-body p-6 text-center">{t("settings.loadError")}</p>
        )
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <SetupSelectCard
            label={t("settings.regionLabel")}
            description={t("settings.regionDescription")}
            value={region}
            options={REGIONS.map((item) => ({ value: item.code, label: item.label }))}
            onChange={updateRegion}
          />
          <SetupSelectCard
            label={t("settings.languageLabel")}
            description={t("settings.languageDescription")}
            value={locale}
            options={LANGUAGE_OPTIONS}
            onChange={(value) => setLocale(isLocale(value) ? value : DEFAULT_LOCALE)}
          />
          <SetupSelectCard
            label={t("settings.unitsWeightLabel")}
            description={t("settings.unitsWeightDescription")}
            value={units.weight}
            options={WEIGHT_UNITS.map((unit) => ({ value: unit, label: t(`settings.unit${unit[0].toUpperCase()}${unit[1]}`) }))}
            onChange={(value) => saveUnits({ weight: value as WeightUnit })}
          />
          <SetupSelectCard
            label={t("settings.unitsHeightLabel")}
            description={t("settings.unitsHeightDescription")}
            value={units.height}
            options={HEIGHT_UNITS.map((unit) => ({ value: unit, label: t(`settings.unit${unit[0].toUpperCase()}${unit[1]}`) }))}
            onChange={(value) => saveUnits({ height: value as HeightUnit })}
          />
        </div>
      )}
    </HfScreen>
  );
}
