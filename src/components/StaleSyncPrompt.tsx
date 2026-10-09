"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionButton, ActionLink } from "@/components/hf/ActionButton";
import { useTranslation } from "@/i18n/LocaleProvider";
import type { IntegrationCardStatus } from "@/lib/integrations";
import { formatDateTime } from "@/app/settings/integrations/status-badge";

// Popup shown when a connected integration (smart scale, watch, …) has not
// synced for a while, so weight and activity data may be missing. "Sync now"
// fetches directly for cloud integrations; companion/via integrations (data
// pushed from the phone) only get the link to their page. "Later" snoozes the
// integration for a day.
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
  const { t } = useTranslation();
  const pathname = usePathname() ?? "/";
  const [stale, setStale] = useState<IntegrationCardStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (checkedThisVisit) return;
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    checkedThisVisit = true;
    fetch("/api/integrations")
      .then((res) => (res.ok ? (res.json() as Promise<{ integrations: IntegrationCardStatus[] }>) : null))
      .then((data) => {
        const candidates = (data?.integrations ?? [])
          .filter((i) => i.status !== "DISCONNECTED" && i.connectedAt)
          .filter((i) => Date.now() - lastSeen(i) > STALE_AFTER_MS && !snoozed(i.provider))
          .sort((a, b) => lastSeen(a) - lastSeen(b));
        setStale(candidates[0] ?? null);
      })
      .catch(() => undefined);
  }, [pathname]);

  if (!stale) return null;
  const current = stale;
  const href = `/settings/integrations/${current.pageSlug}`;

  function later() {
    try {
      window.localStorage.setItem(snoozeKey(current.provider), String(Date.now() + SNOOZE_MS));
    } catch {
      // No storage: the popup simply closes for this visit.
    }
    setStale(null);
  }

  async function syncNow() {
    if (!current.slug) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/integrations/${current.slug}/sync`, { method: "POST" });
      if (res.ok) setStale(null);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const lastSync = current.lastSyncedAt ? formatDateTime(current.lastSyncedAt) : t("staleSyncPrompt.never");

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="stale-sync-title">
      <div className="hf-page rounded-t-3xl bg-hf-cream pb-8 pt-6">
        <h2 id="stale-sync-title" className="hf-type-page-title hf-heading text-hf-black">
          {t("staleSyncPrompt.title", { name: current.label })}
        </h2>
        <p className="hf-type-body mt-3 text-text-secondary">{t("staleSyncPrompt.body", { name: current.label, date: lastSync })}</p>
        {failed && <p className="hf-type-small mt-3 text-red-600">{t("staleSyncPrompt.failed")}</p>}
        {current.slug ? (
          <ActionButton className="mt-6" disabled={busy} onClick={syncNow}>
            {t("staleSyncPrompt.syncNow")}
          </ActionButton>
        ) : (
          <ActionLink href={href} className="mt-6" onClick={() => setStale(null)}>
            {t("staleSyncPrompt.open")}
          </ActionLink>
        )}
        <div className="mt-5 flex items-center justify-between">
          <button type="button" disabled={busy} className="hf-type-small text-text-secondary" onClick={later}>
            {t("staleSyncPrompt.later")}
          </button>
          {current.slug && (
            <Link href={href} onClick={() => setStale(null)} className="hf-type-small text-text-secondary underline">
              {t("staleSyncPrompt.open")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
