"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { ALLERGEN_CATALOG } from "@/lib/allergens";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

type ResultsUser = {
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
  showExtendedNutrition: boolean;
};

function patchProfile(body: Record<string, unknown>) {
  fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// "Resultatvisning" — hvad der vises på madvarer: allergener og udvidet
// næringsindhold.
export default function ResultsDisplayPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<ResultsUser | null>(null);
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
    patchProfile({ showAllergens: value });
  }

  function toggleShowExtendedNutrition(value: boolean) {
    setUser((current) => (current ? { ...current, showExtendedNutrition: value } : current));
    patchProfile({ showExtendedNutrition: value });
  }

  function toggleAllergen(key: string, value: boolean) {
    setUser((current) => {
      if (!current) return current;
      const nextVisibility = { ...(current.allergenVisibility ?? {}), [key]: value };
      patchProfile({ allergenVisibility: nextVisibility });
      return { ...current, allergenVisibility: nextVisibility };
    });
  }

  return (
    <HfScreen title={t("settings.resultsDisplay")}>
      {loading || !user ? (
        <p className="hf-type-body p-6 text-center text-hf-black opacity-60">
          {loading ? t("settings.loading") : t("settings.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
            <div className="flex items-start gap-3 px-4 py-4">
              <span className="flex-1">
                <span className="hf-type-body hf-type-strong block text-hf-black">
                  {t("settings.showAllergens")}
                </span>
                <span className="hf-type-small mt-2 block border-t border-hf-gray-light pt-2 text-hf-black opacity-60">
                  {t("settings.showAllergensDescription")}
                </span>
              </span>
              <span className="flex items-center gap-2 pt-0.5">
                <span className="hf-type-small text-hf-black opacity-60">
                  {t("settings.showAllergensSelectAll")}
                </span>
                <Toggle
                  checked={user.showAllergens}
                  onChange={toggleShowAllergens}
                  ariaLabel={t("settings.showAllergens")}
                />
              </span>
            </div>

            {user.showAllergens && (
              <div className="flex flex-col gap-1 border-t border-hf-gray-light">
                {ALLERGEN_CATALOG.map((allergen, index) => (
                  <div
                    key={allergen.key}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      index < ALLERGEN_CATALOG.length - 1 ? "border-b border-hf-tan-dark" : ""
                    }`}
                  >
                    <span className="hf-type-body flex-1 text-hf-black">{allergen.label}</span>
                    <Toggle
                      checked={isAllergenVisible(allergen.key)}
                      onChange={(value) => toggleAllergen(allergen.key, value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Toggle
            label={t("settings.showExtendedNutrition")}
            description={t("settings.showExtendedNutritionDescription")}
            checked={user.showExtendedNutrition}
            onChange={toggleShowExtendedNutrition}
          />

          <p className="hf-type-small px-1 text-hf-black opacity-60">
            {t("settings.thirdPartyDisclaimer")}
          </p>
        </div>
      )}
    </HfScreen>
  );
}
