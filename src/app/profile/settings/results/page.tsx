"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { ALLERGEN_CATALOG } from "@/lib/allergens";
import Link from "next/link";
import { Toggle } from "@/components/ui/Toggle";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { normalizeDisplayPrefs, type AllergenDisplayMode, type DisplayPrefs } from "@/lib/circle-badges";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";

type ResultsUser = {
  showAllergens: boolean;
  allergenVisibility: Record<string, boolean> | null;
  displayPrefs?: unknown;
  showExtendedNutrition: boolean;
  showAdditives: boolean;
  showToxins: boolean;
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
  const [sheetAllergen, setSheetAllergen] = useState<string | null>(null);

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

  function toggleProductFlag(key: "showAdditives" | "showToxins", value: boolean) {
    setUser((current) => (current ? { ...current, [key]: value } : current));
    patchProfile({ [key]: value });
  }

  const prefs = normalizeDisplayPrefs(user?.displayPrefs);

  function savePrefs(next: DisplayPrefs) {
    setUser((current) => (current ? { ...current, displayPrefs: next } : current));
    patchProfile({ displayPrefs: next });
  }

  function setAllergenMode(key: string, mode: AllergenDisplayMode) {
    savePrefs({ ...prefs, allergenMode: { ...prefs.allergenMode, [key]: mode } });
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
        loading ? (
          <SkeletonScreen>
            <SkeletonToggle count={3} />
          </SkeletonScreen>
        ) : (
          <p className="text-text-secondary hf-type-body p-6 text-center">{t("settings.loadError")}</p>
        )
      ) : (
        <div className="hf-page">
          <div className="flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
            <div className="flex items-start gap-3 px-4 py-4">
              <span className="flex-1">
                <span className="hf-type-body hf-type-strong block text-hf-black">
                  {t("settings.showAllergens")}
                </span>
                <span className="text-text-secondary hf-type-small mt-2 block border-t border-hf-tan-dark pt-2">
                  {t("settings.showAllergensDescription")}
                </span>
              </span>
              <span className="flex items-center gap-2 pt-0.5">
                <span className="text-text-secondary hf-type-small">
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
              <div className="flex flex-col gap-1 border-t border-hf-tan-dark">
                {ALLERGEN_CATALOG.map((allergen, index) => (
                  <div
                    key={allergen.key}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      index < ALLERGEN_CATALOG.length - 1 ? "border-b border-hf-tan-dark" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSheetAllergen(allergen.key)}
                      className="flex flex-1 items-center justify-between gap-3 text-left"
                    >
                      <span className="hf-type-body text-hf-black">{allergen.label}</span>
                      <span className="text-text-secondary hf-type-small">
                        {isAllergenVisible(allergen.key)
                          ? t(`circleBadges.mode.${prefs.allergenMode[allergen.key] ?? "contains"}`)
                          : t("circleBadges.mode.off")}
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {(["sugar", "diets", "flags", "vegan"] as const).map((block) => (
            <Toggle
              key={block}
              label={t(`circleBadges.blocks.${block}`)}
              description={t(`circleBadges.blockDescription.${block}`)}
              checked={prefs[block]}
              onChange={(value) => savePrefs({ ...prefs, [block]: value })}
            />
          ))}

          <Link href="/settings/display/priority" className="hf-type-body hf-type-strong px-1 text-hf-green underline">
            {t("circleBadges.priorityTitle")}
          </Link>

          <Toggle
            label={t("settings.showExtendedNutrition")}
            description={t("settings.showExtendedNutritionDescription")}
            checked={user.showExtendedNutrition}
            onChange={toggleShowExtendedNutrition}
          />

          <Toggle
            label={t("settings.showAdditives")}
            description={t("settings.showAdditivesDescription")}
            checked={user.showAdditives}
            onChange={(value) => toggleProductFlag("showAdditives", value)}
          />

          <Toggle
            label={t("settings.showToxins")}
            description={t("settings.showToxinsDescription")}
            checked={user.showToxins}
            onChange={(value) => toggleProductFlag("showToxins", value)}
          />

          <p className="text-text-secondary hf-type-small px-1">
            {t("settings.thirdPartyDisclaimer")}
          </p>
        </div>
      )}
      {sheetAllergen && user && (
        <BottomSheet onClose={() => setSheetAllergen(null)} title={ALLERGEN_CATALOG.find((a) => a.key === sheetAllergen)?.label}>
          <div className="flex flex-col gap-3 px-4 pb-6">
            <Toggle
              label={isAllergenVisible(sheetAllergen) ? t("circleBadges.sheet.deactivate") : t("circleBadges.sheet.activate")}
              checked={isAllergenVisible(sheetAllergen)}
              onChange={(value) => toggleAllergen(sheetAllergen, value)}
            />
            {isAllergenVisible(sheetAllergen) && (
              <div className="flex flex-col overflow-hidden rounded-2xl bg-hf-tan">
                {((["gluten", "milk"].includes(sheetAllergen) ? ["contains", "free", "both"] : ["contains"]) as AllergenDisplayMode[]).map(
                  (mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setAllergenMode(sheetAllergen, mode)}
                      aria-pressed={(prefs.allergenMode[sheetAllergen] ?? "contains") === mode}
                      className="hf-type-body flex items-center justify-between border-b border-hf-tan-dark px-4 py-3 text-left text-hf-black last:border-b-0"
                    >
                      {t(`circleBadges.mode.${mode}`)}
                      {(prefs.allergenMode[sheetAllergen] ?? "contains") === mode && <span aria-hidden="true">✓</span>}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </HfScreen>
  );
}
