"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { SetupSelectCard } from "@/components/hf/SetupSelectCard";
import { REGIONS } from "@/lib/regions";
import { useTranslation } from "@/i18n/LocaleProvider";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n";

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

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setRegion(data.user?.region ?? null);
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
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: next }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.languageAndRegion")}>
      {loading || region === null ? (
        <p className="hf-type-body p-6 text-center text-hf-black opacity-60">
          {loading ? t("settings.loading") : t("settings.loadError")}
        </p>
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
        </div>
      )}
    </HfScreen>
  );
}
