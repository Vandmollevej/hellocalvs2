"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Settings → Visning → Oplevelse af søvn (docs/DECISIONS.md 2026-09-26): on by
// default. When on, the first app opening each day asks for a 1–5 rating of
// last night's sleep (src/components/SleepQualityGate.tsx).
export default function SleepQualityDisplaySettingsPage() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { user: { sleepQualityPromptEnabled: boolean } };
      })
      .then((data) => {
        if (!cancelled) setEnabled(data.user.sleepQualityPromptEnabled);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(value: boolean) {
    setEnabled(value);
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sleepQualityPromptEnabled: value }),
    }).catch(() => {});
  }

  return (
    <HfScreen title={t("settings.sleepQuality")}>
      <div className="flex flex-col gap-4 p-4">
        {enabled === null ? (
          <p className="text-center text-[14px] text-hf-black opacity-60">{t("profile.loading")}</p>
        ) : (
          <Toggle
            checked={enabled}
            onChange={toggle}
            label={t("sleepQualitySettings.toggleLabel")}
            description={t("sleepQualitySettings.toggleDescription")}
          />
        )}
      </div>
    </HfScreen>
  );
}
