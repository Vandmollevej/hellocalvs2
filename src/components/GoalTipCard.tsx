"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useShowGoalTips } from "@/lib/help-prefs";
import { clientTzOffsetMinutesEast } from "@/lib/daily-budget";

// Tip til at nå dagens mål (docs/DECISIONS.md 2026-10-07): vises på forsiden,
// højst én gang pr. dag, og kan slås fra under Indstillinger → Visning → Tips.
const SEEN_KEY = "hellocal.goalTip.seenDay";

function today() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(new Date());
}

function seenToday(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === today();
  } catch {
    return false;
  }
}

export function GoalTipCard() {
  const pathname = usePathname() ?? "/";
  const enabled = useShowGoalTips();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || pathname !== "/" || seenToday()) return;
    let cancelled = false;
    fetch(`/api/tips/goal?tz=${clientTzOffsetMinutesEast()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tip?: { text: string } | null } | null) => {
        if (!cancelled && data?.tip) setText(data.tip.text);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);

  if (!enabled || !text || pathname !== "/") return null;

  function close() {
    try {
      window.localStorage.setItem(SEEN_KEY, today());
    } catch {
      // localStorage utilgængelig — tippet vises så igen næste gang.
    }
    setText(null);
  }

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-[44] mx-auto flex max-w-md items-start gap-3 p-4 shadow-lg hf-surface"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="hf-type-body hf-type-strong text-hf-black">Tip til dagens mål</p>
        <p className="hf-type-small text-text-secondary">{text}</p>
      </div>
      <button type="button" onClick={close} aria-label="Luk" className="hf-btn-icon -mr-2 -mt-2 text-hf-black">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
