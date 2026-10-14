"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";

// Settings → Visning → Oversættelse (docs/DECISIONS.md 2026-10-14): én
// kontakt, der bestemmer, om varetekst på et sprog uden for HelloFresh-landene
// vises oversat til appens sprog (standard) eller som original. Feltet ligger
// på User.translateForeignText (/api/profile), samme mønster som uncertainty.
type DisplaySettingsUser = {
  translateForeignText: boolean;
};

export default function TranslationSettingsPage() {
  const { t } = useTranslation();
  const [user, setUser] = useState<DisplaySettingsUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
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

  function setTranslate(value: boolean) {
    setUser((current) => (current ? { ...current, translateForeignText: value } : current));
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ translateForeignText: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.translation")}>
      {loading || !user ? (
        loading ? (
          <SkeletonScreen className="flex flex-col gap-4 p-4">
            <SkeletonToggle />
          </SkeletonScreen>
        ) : (
          <p className="hf-type-body text-text-secondary p-6 text-center">{t("settings.loadError")}</p>
        )
      ) : (
        <div className="flex flex-col gap-4 p-4">
          <Toggle
            label={t("displaySettings.translateForeignText")}
            description={t("displaySettings.translateForeignTextDescription")}
            checked={user.translateForeignText !== false}
            onChange={setTranslate}
          />
        </div>
      )}
    </HfScreen>
  );
}
