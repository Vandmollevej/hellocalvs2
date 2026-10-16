"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StaleSyncSheet } from "@/components/weight/WeighInPrompts";
import type { IntegrationCardStatus } from "@/lib/integrations";

// Popup shown when a connected integration (smart scale, watch, …) has not
// synced for a while, so weight and activity data may be missing. "Sync now"
// fetches directly for cloud integrations; companion/via integrations (data
// pushed from the phone) only get the link to their page. "Later" snoozes the
// integration for a day. Same bottom sheet as the weigh-in prompt
// (WeighInPrompts), which owns integrations that deliver weight — they are
// skipped here so the user never gets the same question twice (2026-10-16).
const STALE_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const SNOOZE_MS = 24 * 60 * 60 * 1000;

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
  "/settings/integrations",
];

const snoozeKey = (provider: string) => `stale-sync-snooze:${provider}`;

function snoozed(provider: string): boolean {
  try {
    const until = Number(window.localStorage.getItem(snoozeKey(provider)));
    return until > Date.now();
  } catch {
    return false;
  }
}

function lastSeen(integration: IntegrationCardStatus): number {
  const at = integration.lastSyncedAt ?? integration.connectedAt;
  return at ? new Date(at).getTime() : 0;
}

let checkedThisVisit = false;

export function StaleSyncPrompt() {
  const pathname = usePathname() ?? "/";
  const [stale, setStale] = useState<IntegrationCardStatus | null>(null);

  useEffect(() => {
    if (checkedThisVisit) return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    checkedThisVisit = true;
    fetch("/api/integrations")
      .then((res) => (res.ok ? (res.json() as Promise<{ integrations: IntegrationCardStatus[] }>) : null))
      .then((data) => {
        const candidates = (data?.integrations ?? [])
          .filter((i) => i.status !== "DISCONNECTED" && i.connectedAt)
          .filter((i) => !i.capabilities.read.includes("weight"))
          .filter((i) => Date.now() - lastSeen(i) > STALE_AFTER_MS && !snoozed(i.provider))
          .sort((a, b) => lastSeen(a) - lastSeen(b));
        setStale(candidates[0] ?? null);
      })
      .catch(() => undefined);
  }, [pathname]);

  if (!stale) return null;
  const current = stale;

  // "Senere" og luk udsætter integrationen et døgn.
  function later() {
    try {
      window.localStorage.setItem(snoozeKey(current.provider), String(Date.now() + SNOOZE_MS));
    } catch {
      // No storage: the popup simply closes for this visit.
    }
    setStale(null);
  }

  return (
    <StaleSyncSheet
      items={[
        {
          provider: current.provider,
          label: current.label,
          icon: current.icon,
          slug: current.slug,
          pageSlug: current.pageSlug,
          canSyncNow: current.kind === "oauth",
          status: current.status,
          lastSyncedAt: current.lastSyncedAt,
          stale: true,
        },
      ]}
      onSynced={() => undefined}
      onClose={later}
    />
  );
}
