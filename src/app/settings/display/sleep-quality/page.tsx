"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonScreen, SkeletonToggle } from "@/components/hf/Skeleton";

// Settings → Visning → Oplevelse af søvn (docs/DECISIONS.md 2026-09-26): on by
// default. When on, the first app opening each day asks for a 1–5 rating of
// last night's sleep (src/components/SleepQualityGate.tsx).
export default function SleepQualityDisplaySettingsPage() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  // ?focus=toggle — opened from "Slå fra" in the sleep question overlay: the
  // toggle gets a thin green ring and keyboard focus.
  const focusToggle = useSearchParams().get("focus") === "toggle";
  const toggleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusToggle && enabled !== null)
      toggleRef.current?.querySelector<HTMLElement>("[role=switch]")?.focus();
  }, [focusToggle, enabled]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as {
          user: { sleepQualityPromptEnabled: boolean };
        };
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
          <SkeletonScreen className="">
            <SkeletonToggle />
          </SkeletonScreen>
        ) : (
          <div
            ref={toggleRef}
            className={
              focusToggle ? "rounded-xl ring-2 ring-hf-green" : undefined
            }
          >
            <Toggle
              checked={enabled}
              onChange={toggle}
              label={t("sleepQualitySettings.toggleLabel")}
              description={t("sleepQualitySettings.toggleDescription")}
            />
          </div>
        )}
      </div>
    </HfScreen>
  );
}
