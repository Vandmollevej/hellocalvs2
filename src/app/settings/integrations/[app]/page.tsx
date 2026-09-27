"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AccessFooter,
  AccessGroup,
  AccessMono,
  AccessRow,
  AccessToggleGroup,
  AccessTrailingButton,
  HfAccessSheet,
  type AccessCategory,
  type AccessToggleRow,
} from "@/components/hf/HfAccessSheet";
import type { IntegrationCardStatus } from "@/lib/integrations";
import type { ReadType, SyncSettings, WriteType } from "@/lib/integrations/sync-settings";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatDateTime, integrationStatusKey } from "../status-badge";

// Én side pr. integration (docs/DECISIONS.md 2026-09-26), vist som iOS'
// adgangsark (docs/DECISIONS.md 2026-09-27): brugeren vælger til/fra pr.
// datatype — hvad Hello Cal skriver til appen, og hvad Hello Cal læser —
// både før tilkobling og når som helst bagefter. Valget gemmes med det samme.

type DeviceToken = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

// Ældre enhedskoder fra før kortene fik hver deres (docs/DECISIONS.md 2026-09-24).
const LEGACY_TOKEN_LABEL = "Companion-app";

// Health-appens kategori (ikon og farve) for hver datatype.
const CATEGORY: Record<ReadType | WriteType, AccessCategory> = {
  nutrition: "nutrition",
  water: "nutrition",
  weight: "body",
  bodyFat: "body",
  body: "body",
  activities: "activity",
  steps: "activity",
  energy: "activity",
  heart: "heart",
  sleep: "sleep",
};

const OVERVIEW = "/settings/integrations";

function IntegrationContent() {
  const { t } = useTranslation();
  const router = useRouter();
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

  useEffect(() => {
    if (newToken) document.getElementById("new-device-code")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [newToken]);

  async function saveSettings(settings: SyncSettings) {
    if (!integration) return;
    const previous = integration;
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

  function close() {
    router.push(OVERVIEW);
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
      close();
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
      <HfAccessSheet
        title={t("integrations.title")}
        message={loading ? t("integrations.loading") : "—"}
        allowLabel={t("integrations.access.allow")}
        denyLabel={t("integrations.access.deny")}
        allowDisabled
        onAllow={close}
        onDeny={close}
        onDismiss={close}
      />
    );
  }

  const name = integration.label;
  const isOAuth = integration.kind === "oauth" && integration.slug !== null;
  const isSamsung = integration.provider === "SAMSUNG_HEALTH";
  const connected = integration.status !== "DISCONNECTED";
  const { read: readTypes, write: writeTypes } = integration.capabilities;
  const { settings } = integration;
  const cardTokens = tokens.filter(
    (token) => token.label === name || (integration.provider === "APPLE_HEALTH" && token.label === LEGACY_TOKEN_LABEL)
  );
  const notice = searchParams.get("connected")
    ? t("integrations.notice.connected", { name })
    : searchParams.get("error")
      ? t("integrations.notice.failed", { name })
      : null;

  const hasTypes = readTypes.length + writeTypes.length > 0;
  const allOn =
    readTypes.every((type) => settings.read[type]) && writeTypes.every((type) => settings.write[type]);
  const anyOn = readTypes.some((type) => settings.read[type]) || writeTypes.some((type) => settings.write[type]);

  function toggleAll() {
    const value = !allOn;
    void saveSettings({
      read: Object.fromEntries(readTypes.map((type) => [type, value])),
      write: Object.fromEntries(writeTypes.map((type) => [type, value])),
    });
  }

  function rows<T extends ReadType | WriteType>(direction: "read" | "write", types: T[]): AccessToggleRow[] {
    return types.map((type) => ({
      key: type,
      label: t(`integrations.access.${direction}.${type}`),
      category: CATEGORY[type],
      checked: Boolean(settings[direction][type as never]),
      onChange: (value) =>
        void saveSettings({
          read: { ...settings.read },
          write: { ...settings.write },
          [direction]: { ...settings[direction], [type]: value },
        }),
    }));
  }

  // "Tillad": forbinder (eller forbinder igen), når adgangen mangler; en
  // companion-app uden enhedskode får en; ellers er valget allerede gemt.
  function allow() {
    if (isSamsung) return router.push("/settings/integrations/health-connect");
    if (isOAuth && (!connected || integration!.needsReconnect.length > 0)) return connect();
    if (integration!.issuesDeviceTokens && cardTokens.length === 0 && !newToken) return void createToken();
    close();
  }

  // "Tillad ikke": en forbundet cloud-app frakobles; ellers lukkes arket.
  function deny() {
    if (isOAuth && connected) return void disconnect();
    close();
  }

  const statusLine = [
    t(`integrations.status.${integrationStatusKey(integration)}`),
    integration.lastSyncedAt ? t("integrations.lastSynced", { date: formatDateTime(integration.lastSyncedAt) }) : null,
    integration.lastPushedAt && writeTypes.length > 0
      ? t("integrations.lastPushed", { date: formatDateTime(integration.lastPushedAt) })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <HfAccessSheet
      title={t("integrations.access.title", { name })}
      // eslint-disable-next-line @next/next/no-img-element
      icon={<img src={integration.icon} alt="" />}
      heading={name}
      message={t(writeTypes.length > 0 ? "integrations.access.messageReadWrite" : "integrations.access.messageRead", {
        name,
      })}
      toggleAllLabel={hasTypes ? t(allOn ? "integrations.access.turnOffAll" : "integrations.access.turnOnAll") : undefined}
      onToggleAll={hasTypes ? toggleAll : undefined}
      allowLabel={t("integrations.access.allow")}
      denyLabel={t("integrations.access.deny")}
      allowDisabled={busy || (hasTypes && !anyOn) || (isOAuth && !integration.configured)}
      denyDisabled={busy}
      onAllow={allow}
      onDeny={deny}
      onDismiss={close}
    >
      {writeTypes.length > 0 && (
        <AccessToggleGroup title={t("integrations.access.writeTitle")} rows={rows("write", writeTypes)} />
      )}
      {readTypes.length > 0 && (
        <AccessToggleGroup title={t("integrations.access.readTitle")} rows={rows("read", readTypes)} />
      )}

      {hasTypes && (
        <AccessFooter>
          {t(writeTypes.length > 0 ? "integrations.access.explanationReadWrite" : "integrations.access.explanationRead", {
            name,
          })}
        </AccessFooter>
      )}
      {writeTypes.length === 0 && readTypes.length > 0 && (
        <AccessFooter>{t("integrations.writeNone", { name })}</AccessFooter>
      )}
      {saveError && <AccessFooter error>{t("integrations.saveError")}</AccessFooter>}

      {isSamsung && (
        <AccessGroup
          title={t("integrations.access.statusTitle")}
          footer={<AccessFooter>{t("integrations.samsungViaHealthConnect")}</AccessFooter>}
        >
          <AccessRow tone="action" onClick={() => router.push("/settings/integrations/health-connect")}>
            {t("integrations.openHealthConnect")}
          </AccessRow>
        </AccessGroup>
      )}

      {!isSamsung && (
        <AccessGroup
          title={t("integrations.access.statusTitle")}
          footer={
            <>
              {notice && <AccessFooter>{notice}</AccessFooter>}
              {isOAuth && !integration.configured && !connected && (
                <AccessFooter>{t("integrations.notConfigured")}</AccessFooter>
              )}
              {isOAuth && connected && integration.needsReconnect.length > 0 && (
                <AccessFooter>{t("integrations.needsReconnect", { name })}</AccessFooter>
              )}
              {integration.lastError && <AccessFooter error>{integration.lastError}</AccessFooter>}
            </>
          }
        >
          <AccessRow>{statusLine}</AccessRow>
          {isOAuth && connected && (
            <AccessRow tone="action" onClick={sync} disabled={busy}>
              {busy ? t("integrations.syncing") : t("integrations.syncNow")}
            </AccessRow>
          )}
          {isOAuth && connected && (
            <AccessRow tone="danger" onClick={disconnect} disabled={busy}>
              {t("integrations.disconnect")}
            </AccessRow>
          )}
        </AccessGroup>
      )}

      {integration.issuesDeviceTokens && (
        <AccessGroup
          title={t("integrations.access.deviceTitle")}
          footer={<AccessFooter>{t("integrations.companionHowTo")}</AccessFooter>}
        >
          {cardTokens.map((token) => (
            <AccessRow
              key={token.id}
              trailing={
                <AccessTrailingButton tone="danger" disabled={busy} onClick={() => revokeToken(token.id)}>
                  {t("integrations.remove")}
                </AccessTrailingButton>
              }
            >
              {t("integrations.createdAt", { date: formatDateTime(token.createdAt) })}
              {token.lastUsedAt ? t("integrations.lastUsedAt", { date: formatDateTime(token.lastUsedAt) }) : ""}
            </AccessRow>
          ))}
          {newToken && (
            <AccessRow
              id="new-device-code"
              trailing={<AccessTrailingButton onClick={() => setNewToken(null)}>{t("integrations.close")}</AccessTrailingButton>}
            >
              {t("integrations.saveTokenNotice")} <AccessMono>{newToken}</AccessMono>
            </AccessRow>
          )}
          {!newToken && (
            <AccessRow tone="action" onClick={createToken} disabled={busy}>
              {t("integrations.generateDeviceCode")}
            </AccessRow>
          )}
        </AccessGroup>
      )}
    </HfAccessSheet>
  );
}

export default function IntegrationPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationContent />
    </Suspense>
  );
}
