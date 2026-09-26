"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StartupTipOverlay } from "@/components/StartupTipOverlay";
import { markStartupTipSeen, readSeenStartupTips, saveShowStartupTips, useShowStartupTips } from "@/lib/help-prefs";
import { nextStartupTip, type StartupTip } from "@/lib/startup-tips";

// Shows at most one start-up tip per visit (app load), only for a logged-in
// user who has given health-data consent, and never on login, consent, legal
// or admin pages.
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

let checkedThisVisit = false;

export function StartupTipsGate() {
  const pathname = usePathname() ?? "/";
  const enabled = useShowStartupTips();
  const [tip, setTip] = useState<StartupTip | null>(null);

  useEffect(() => {
    if (!enabled || checkedThisVisit) return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    const candidate = nextStartupTip(readSeenStartupTips());
    if (!candidate) return;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { hasHealthDataConsent?: boolean } } | null) => {
        if (checkedThisVisit || !data?.user || data.user.hasHealthDataConsent === false) return;
        checkedThisVisit = true;
        setTip(candidate);
      })
      .catch(() => undefined);
  }, [pathname, enabled]);

  if (!tip || !enabled) return null;

  function close() {
    if (tip) markStartupTipSeen(tip.id);
    setTip(null);
  }

  return (
    <StartupTipOverlay
      tip={tip}
      onClose={close}
      onDisable={() => {
        close();
        saveShowStartupTips(false);
      }}
    />
  );
}
