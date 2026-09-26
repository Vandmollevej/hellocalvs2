"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SleepQualityOverlay } from "@/components/SleepQualityOverlay";
import {
  fetchSleepQuality,
  localDateKey,
  readLastSleepPromptDate,
  saveLastSleepPromptDate,
  saveSleepQuality,
} from "@/lib/sleep-quality";

// "Oplevelse af søvn" (docs/DECISIONS.md 2026-09-26): the first time the app
// is opened each day, a logged-in user with the setting on (default) and no
// rating for today yet is asked how last night felt. Never on login,
// consent, legal or admin pages.
const SKIP_PREFIXES = [
  "/samtykke",
  "/betingelser",
  "/privatlivspolitik",
  "/welcome",
  "/velkommen",
  "/login",
  "/logind",
  "/signup",
  "/tilmeld",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/hello-doc",
  "/forward",
  "/admin",
];

type ProfileFlags = { sleepQualityPromptEnabled?: boolean; healthDataConsentAt?: string | null };

export function SleepQualityGate() {
  const pathname = usePathname() ?? "/";
  const [dateKey, setDateKey] = useState<string | null>(null);

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    const today = localDateKey(new Date());
    if (readLastSleepPromptDate() === today) return;
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? (res.json() as Promise<{ user?: ProfileFlags }>) : null))
      .then(async (data) => {
        const user = data?.user;
        if (!user || !user.healthDataConsentAt || user.sleepQualityPromptEnabled === false) return;
        const entries = await fetchSleepQuality(today);
        if (cancelled || readLastSleepPromptDate() === today) return;
        // Remember the day as soon as the overlay is shown, so a reload or
        // another page never asks twice.
        saveLastSleepPromptDate(today);
        if (entries.length === 0) setDateKey(today);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!dateKey) return null;

  return (
    <SleepQualityOverlay
      onRate={(rating) => {
        saveSleepQuality(dateKey, rating).catch(() => undefined);
      }}
      onClose={() => setDateKey(null)}
      onDisable={() => {
        setDateKey(null);
        fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sleepQualityPromptEnabled: false }),
        }).catch(() => undefined);
      }}
    />
  );
}
