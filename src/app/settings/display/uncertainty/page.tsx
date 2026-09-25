"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { UncertaintyTilde } from "@/components/ui/UncertaintyTilde";
import { UncertaintyLine } from "@/components/ui/UncertaintyLine";
import { useTranslation } from "@/i18n/LocaleProvider";
import { localApi } from "@/lib/vault/local-api";

// Settings → Visning → Usikkerhed (docs/DECISIONS.md 2026-09-24): én kontakt,
// der bestemmer om den grå usikkerhedslinje under estimerede værdier er
// foldet ud automatisk. Selve ~ vises altid. Standard: slået fra. Feltet
// ligger privat i boksen (src/lib/vault/handlers/profile.ts), samme mønster
// som limits/page.tsx.
type DisplaySettingsUser = {
  autoExpandUncertainty: boolean;
};

export default function UncertaintySettingsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<DisplaySettingsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    localApi("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("profile");
        return (await response.json()) as { user: DisplaySettingsUser };
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

  function setAutoExpand(value: boolean) {
    setUser((current) => (current ? { ...current, autoExpandUncertainty: value } : current));
    localApi("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoExpandUncertainty: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("displaySettings.uncertainty")}>
      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("settings.loading") : t("settings.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <Toggle
            label={t("displaySettings.autoExpandUncertainty")}
            description={t("displaySettings.autoExpandUncertaintyDescription")}
            checked={Boolean(user.autoExpandUncertainty)}
            onChange={setAutoExpand}
          />
          {/* Lille eksempel, så brugeren kan se hvad kontakten styrer. */}
          <div className="rounded-2xl bg-hf-tan px-4 py-3 text-[13px] text-hf-black">
            <div className="flex items-center justify-between">
              <span className="opacity-70">{t("addProduct.nutrient.iron")}</span>
              <span className="font-medium">
                <UncertaintyTilde />
                2,1 mg
              </span>
            </div>
            {user.autoExpandUncertainty && (
              <UncertaintyLine className="mt-1 text-right" estimated={2.1} tolerance={null} unit="mg" digits={1} />
            )}
          </div>
        </div>
      )}
    </HfScreen>
  );
}
