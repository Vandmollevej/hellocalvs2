"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import type { IntegrationCardStatus } from "@/lib/integrations";
import type { ReadType, SyncSettings, WriteType } from "@/lib/integrations/sync-settings";
import { useTranslation } from "@/i18n/LocaleProvider";
import { IntegrationStatusBadge, formatDateTime } from "../status-badge";

// Én side pr. integration (docs/DECISIONS.md 2026-09-26): brugeren vælger
// til/fra pr. datatype — hvad der hentes til Hello Cal, og hvad der sendes
// fra Hello Cal — både før tilkobling og når som helst bagefter.

type DeviceToken = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

// Ældre enhedskoder fra før kortene fik hver deres (docs/DECISIONS.md 2026-09-24).
const LEGACY_TOKEN_LABEL = "Companion-app";

function IntegrationContent() {
  const { t } = useTranslation();
  const { app } = useParams<{ app: string }>();
  const searchParams = useSearchParams();
  const [integration, setIntegration] = useState<IntegrationCardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);

  function load() {
    fetch("/api/integrations")
      .then(async (res) => (res.ok ? ((await res.json()) as { integrations: IntegrationCardStatus[] }) : { integrations: [] }))
      .then((data) => setIntegration(data.integrations.find((i) => i.pageSlug === app) ?? null))
      .catch(() => setIntegration(null))
      .finally(() => setLoading(false));
  }

  function loadTokens() {
    fetch("/api/integrations/healthkit/tokens")
      .then(async (res) => (res.ok ? ((await res.json()) as { tokens: DeviceToken[] }) : { tokens: [] }))
      .then((data) => setTokens(data.tokens))
      .catch(() => setTokens([]));
  }

  useEffect(() => {
    load();
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  async function changeSetting(direction: "read" | "write", type: ReadType | WriteType, value: boolean) {
    if (!integration) return;
    const previous = integration;
    const settings: SyncSettings = {
      read: { ...integration.settings.read },
      write: { ...integration.settings.write },
      [direction]: { ...integration.settings[direction], [type]: value },
    };
    setIntegration({ ...integration, settings });
    setSaveError(false);
    const res = await fetch(`/api/integrations/${integration.pageSlug}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }).catch(() => null);
    if (!res?.ok) {
      setIntegration(previous);
      setSaveError(true);
      return;
    }
    const data = (await res.json()) as { settings: SyncSettings; needsReconnect: WriteType[] };
    setIntegration((current) => (current ? { ...current, settings: data.settings, needsReconnect: data.needsReconnect } : current));
  }

  function connect() {
    if (!integration?.slug) return;
    setBusy(true);
    window.location.assign(`/api/integrations/${integration.slug}/connect`);
  }

  async function sync() {
    if (!integration?.slug) return;
    setBusy(true);
    try {
      await fetch(`/api/integrations/${integration.slug}/sync`, { method: "POST" });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!integration?.slug) return;
    setBusy(true);
    try {
      await fetch(`/api/integrations/${integration.slug}/disconnect`, { method: "POST" });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function createToken() {
    if (!integration) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/healthkit/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: integration.label }),
      });
      if (res.ok) {
        setNewToken(((await res.json()) as { token: string }).token);
        loadTokens();
      }
    } finally {
      setBusy(false);
    }
  }

  async function revokeToken(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/integrations/healthkit/tokens/${id}`, { method: "DELETE" });
      loadTokens();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !integration) {
    return (
      <HfScreen title={t("integrations.title")}>
        <p className="p-4 text-center text-[13px] text-hf-black opacity-60">{loading ? t("integrations.loading") : "—"}</p>
      </HfScreen>
    );
  }

  const name = integration.label;
  const isOAuth = integration.kind === "oauth" && integration.slug !== null;
  const connected = integration.status !== "DISCONNECTED";
  const { read: readTypes, write: writeTypes } = integration.capabilities;
  const cardTokens = tokens.filter(
    (token) => token.label === name || (integration.provider === "APPLE_HEALTH" && token.label === LEGACY_TOKEN_LABEL)
  );
  const notice = searchParams.get("connected")
    ? t("integrations.notice.connected", { name })
    : searchParams.get("error")
      ? t("integrations.notice.failed", { name })
      : null;

  const toggleRows = <T extends ReadType | WriteType>(direction: "read" | "write", types: T[]) => (
    <div className="flex flex-col rounded-[8px] bg-hf-tan px-4">
      {types.map((type, index) => (
        <div
          key={type}
          className={`flex items-center justify-between gap-3 py-3 ${index > 0 ? "border-t border-hf-tan-dark" : ""}`}
        >
          <span className="hf-type-body text-hf-black">{t(`integrations.${direction}Types.${type}`)}</span>
          <Toggle
            ariaLabel={t(`integrations.${direction}Types.${type}`)}
            checked={Boolean(integration.settings[direction][type as never])}
            onChange={(value) => changeSetting(direction, type, value)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <HfScreen title={name}>
      <div className="hf-page">
        {notice && <p className="text-[13px] rounded-[8px] bg-hf-tan px-4 py-3 text-hf-black">{notice}</p>}

        <div className="flex items-start gap-3 rounded-[8px] bg-hf-tan p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={integration.icon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-[8px] object-contain" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-hf-black opacity-70">
              {isOAuth && !integration.configured && !connected ? t("integrations.notConfigured") : integration.description}
            </p>
            {integration.lastSyncedAt && (
              <p className="text-[11px] mt-1 text-hf-black opacity-60">
                {t("integrations.lastSynced", { date: formatDateTime(integration.lastSyncedAt) })}
              </p>
            )}
            {integration.lastPushedAt && writeTypes.length > 0 && (
              <p className="text-[11px] text-hf-black opacity-60">
                {t("integrations.lastPushed", { date: formatDateTime(integration.lastPushedAt) })}
              </p>
            )}
            {integration.lastError && <p className="text-[11px] mt-1 text-red-600">{integration.lastError}</p>}
          </div>
          <IntegrationStatusBadge integration={integration} />
        </div>

        {integration.provider === "SAMSUNG_HEALTH" && (
          <div className="flex flex-col gap-3 rounded-[8px] bg-hf-tan p-4">
            <p className="text-[13px] text-hf-black opacity-70">{t("integrations.samsungViaHealthConnect")}</p>
            <Link
              href="/settings/integrations/health-connect"
              className="hf-type-button hf-btn-primary block w-full py-2.5 text-center"
            >
              {t("integrations.openHealthConnect")}
            </Link>
          </div>
        )}

        {readTypes.length > 0 && (
          <>
            {!connected && <p className="text-[13px] px-1 text-hf-black opacity-60">{t("integrations.chooseFirst")}</p>}
            <p className="text-[13px] font-semibold px-1 text-hf-black">{t("integrations.readTitle")}</p>
            {toggleRows("read", readTypes)}
            <p className="text-[13px] font-semibold px-1 text-hf-black">{t("integrations.writeTitle", { name })}</p>
            {writeTypes.length > 0 ? (
              toggleRows("write", writeTypes)
            ) : (
              <p className="text-[13px] px-1 text-hf-black opacity-60">{t("integrations.writeNone", { name })}</p>
            )}
          </>
        )}

        {saveError && <p className="text-[13px] px-1 text-red-600">{t("integrations.saveError")}</p>}

        {isOAuth && connected && integration.needsReconnect.length > 0 && (
          <div className="flex flex-col gap-2 rounded-[8px] bg-hf-black p-4 text-hf-white">
            <p className="text-[13px]">{t("integrations.needsReconnect", { name })}</p>
            <button
              type="button"
              disabled={busy || !integration.configured}
              onClick={connect}
              className="hf-type-button hf-btn-primary w-full py-2.5 disabled:opacity-50"
            >
              {t("integrations.reconnect")}
            </button>
          </div>
        )}

        {isOAuth &&
          (connected ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={sync}
                className="hf-type-button hf-btn-primary flex-1 py-2.5 disabled:opacity-50"
              >
                {busy ? t("integrations.syncing") : t("integrations.syncNow")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={disconnect}
                className="text-[13px] font-semibold flex-1 rounded-full bg-hf-tan py-2.5 text-hf-black disabled:opacity-50"
              >
                {t("integrations.disconnect")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !integration.configured}
              onClick={connect}
              className="hf-type-button hf-btn-primary block w-full py-2.5 text-center disabled:opacity-50"
            >
              {t("integrations.connect")}
            </button>
          ))}

        {integration.issuesDeviceTokens && (
          <div className="flex flex-col gap-2 rounded-[8px] bg-hf-tan p-4">
            <p className="text-[13px] text-hf-black opacity-70">{t("integrations.companionHowTo")}</p>

            {cardTokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-2 rounded-[8px] bg-hf-cream px-3 py-2">
                <p className="text-[11px] min-w-0 truncate text-hf-black opacity-60">
                  {t("integrations.createdAt", { date: formatDateTime(token.createdAt) })}
                  {token.lastUsedAt ? t("integrations.lastUsedAt", { date: formatDateTime(token.lastUsedAt) }) : ""}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => revokeToken(token.id)}
                  className="text-[13px] font-semibold shrink-0 text-hf-red-dark disabled:opacity-50"
                >
                  {t("integrations.remove")}
                </button>
              </div>
            ))}

            {newToken ? (
              <div className="rounded-[8px] bg-hf-black p-3 text-hf-white">
                <p className="text-[13px] font-semibold">{t("integrations.saveTokenNotice")}</p>
                <p className="text-[13px] mt-1 break-all font-mono">{newToken}</p>
                <button type="button" onClick={() => setNewToken(null)} className="text-[13px] font-semibold mt-2 underline">
                  {t("integrations.close")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={createToken}
                className="text-[13px] font-semibold w-full rounded-full bg-hf-cream py-2.5 text-hf-black disabled:opacity-50"
              >
                {t("integrations.generateDeviceCode")}
              </button>
            )}
          </div>
        )}
      </div>
    </HfScreen>
  );
}

export default function IntegrationPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationContent />
    </Suspense>
  );
}
