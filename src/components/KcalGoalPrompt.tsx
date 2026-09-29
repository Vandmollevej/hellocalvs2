"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ActionButton } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { KcalGoalSuggestion } from "@/lib/kcal-goal-suggestion";
import { clientTzOffsetMinutesEast } from "@/lib/daily-budget";

// Popup that offers a new daily kcal limit once the app has enough logged
// intake + weight data to see that the current limit is off
// (src/lib/kcal-goal-suggestion.ts). "Opdater" saves it; "Senere" snoozes a
// few days; "Spørg ikke igen" switches the popup off for good.
const SKIP_PREFIXES = [
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
  "/scan",
];

let checkedThisVisit = false;

async function post(body: object) {
  return fetch("/api/profile/kcal-goal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function KcalGoalPrompt() {
  const { t } = useTranslation();
  const pathname = usePathname() ?? "/";
  const [suggestion, setSuggestion] = useState<KcalGoalSuggestion | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (checkedThisVisit) return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    checkedThisVisit = true;
    fetch(`/api/profile/kcal-goal?tz=${clientTzOffsetMinutesEast()}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ suggestion: KcalGoalSuggestion | null }>) : null))
      .then((data) => setSuggestion(data?.suggestion ?? null))
      .catch(() => undefined);
  }, [pathname]);

  if (!suggestion) return null;
  const current = suggestion;

  async function run(body: object) {
    setBusy(true);
    try {
      const res = await post({ ...body, tz: clientTzOffsetMinutesEast() });
      if (res.ok) {
        setSuggestion(null);
      }
    } catch {
      // Stays open so the user can try again.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="kcal-goal-title">
      <div className="hf-page rounded-t-3xl bg-hf-cream pb-8 pt-6">
        <h2 id="kcal-goal-title" className="hf-type-page-title hf-heading text-hf-black">
          {t("kcalGoalPrompt.title")}
        </h2>
        <p className="hf-type-body mt-3 text-text-secondary">
          {t("kcalGoalPrompt.body", { weeks: current.weeks, from: current.currentKcal, to: current.suggestedKcal })}
        </p>
        <ActionButton
          className="mt-6"
          disabled={busy}
          onClick={() => run({ action: "apply", kcal: current.suggestedKcal })}
        >
          {t("kcalGoalPrompt.update")}
        </ActionButton>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" disabled={busy} className="hf-type-small text-text-secondary" onClick={() => run({ action: "snooze" })}>
            {t("kcalGoalPrompt.later")}
          </button>
          <button type="button" disabled={busy} className="hf-type-small text-text-secondary" onClick={() => run({ action: "disable" })}>
            {t("kcalGoalPrompt.dontAskAgain")}
          </button>
        </div>
      </div>
    </div>
  );
}
