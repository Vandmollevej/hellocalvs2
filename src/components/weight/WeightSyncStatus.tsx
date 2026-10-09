"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import { syncIntegrationNow, type SyncStatusItem } from "@/components/weight/WeighInPrompts";
import { useTranslation } from "@/i18n/LocaleProvider";
import { agoLabel } from "@/lib/weigh-labels";

// Synlig synk-status på vægtsiden (2026-10-07: "Hvordan ser jeg og sikrer jeg
// mig, at vægten er synkroniseret med smartvægten?"): hver forbundet
// integration med hvornår den sidst blev synkroniseret og en Synk nu-knap.
export function WeightSyncStatus({ onSynced }: { onSynced?: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<SyncStatusItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(() => {
    return fetch("/api/weight-sync-status")
      .then((response) => (response.ok ? response.json() : { integrations: [] }))
      .then((data: { integrations: SyncStatusItem[] }) => setItems(data.integrations ?? []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncNow(item: SyncStatusItem) {
    if (!item.slug) return;
    setBusy(item.provider);
    setFailed(null);
    const ok = await syncIntegrationNow(item.slug);
    if (!ok) setFailed(item.provider);
    await load();
    setBusy(null);
    if (ok) onSynced?.();
  }

  if (items === null) return null;

  if (items.length === 0) {
    return (
      <Link href="/settings/integrations" className="hf-card flex items-center justify-between gap-3 px-4 py-3">
        <span className="hf-type-body text-hf-black">{t("weighIn.sync.noneConnected")}</span>
        <span className="hf-type-small hf-type-strong text-hf-green">{t("weighIn.sync.connect")}</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.provider} className="hf-card flex items-center gap-3 px-4 py-3">
          <IntegrationIcon icon={item.icon} label={item.label} size={32} className="rounded-card" />
          <div className="min-w-0 flex-1">
            <p className="hf-type-body hf-type-strong text-hf-black">{item.label}</p>
            <p className={`hf-type-small ${item.stale ? "text-hf-red-dark" : "text-text-secondary"}`}>
              {failed === item.provider
                ? t("weighIn.sync.failed")
                : item.status === "ERROR"
                  ? t("weighIn.sync.error")
                  : item.lastSyncedAt
                    ? t("weighIn.sync.last", { ago: agoLabel(new Date(item.lastSyncedAt), t) })
                    : t("weighIn.sync.never")}
            </p>
          </div>
          {item.canSyncNow && item.slug ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void syncNow(item)}
              className="hf-type-small hf-type-strong rounded-full bg-hf-black px-4 py-2 text-hf-white disabled:opacity-40"
            >
              {busy === item.provider ? t("weighIn.sync.syncing") : t("weighIn.sync.now")}
            </button>
          ) : (
            <Link href={`/settings/integrations/${item.pageSlug}`} className="hf-type-small hf-type-strong text-hf-green">
              {t("weighIn.sync.openShort")}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
