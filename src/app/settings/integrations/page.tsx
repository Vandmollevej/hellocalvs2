"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconChefHat } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { Toggle } from "@/components/ui/Toggle";
import type { IntegrationCardStatus } from "@/lib/integrations";
import { useTranslation } from "@/i18n/LocaleProvider";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type DeviceToken = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
};

// Ældre enhedskoder fra før kortene fik hver deres (docs/DECISIONS.md 2026-09-24).
const LEGACY_TOKEN_LABEL = "Companion-app";

function tokensFor(tokens: DeviceToken[], integration: IntegrationCardStatus) {
  return tokens.filter(
    (token) =>
      token.label === integration.label ||
      (integration.provider === "APPLE_HEALTH" && token.label === LEGACY_TOKEN_LABEL)
  );
}

function IntegrationerContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationCardStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [newToken, setNewToken] = useState<{ raw: string; label: string } | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  // HelloFresh-opskrifter i "Søg i delte retter" (docs/DECISIONS.md
  // 2026-09-24). Valget ligger i brugerens boks.
  const [helloFresh, setHelloFresh] = useState<boolean | null>(null);
  const autoSynced = useRef(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: { helloFreshEnabled?: boolean } }) : {}))
      .then((data) => setHelloFresh(Boolean(data.user?.helloFreshEnabled)))
      .catch(() => setHelloFresh(false));
  }, []);

  async function changeHelloFresh(next: boolean) {
    setHelloFresh(next);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ helloFreshEnabled: next }),
    }).catch(() => null);
    if (!res?.ok) setHelloFresh(!next);
  }

  const connectedSlug = searchParams.get("connected");
  const failedSlug = searchParams.get("error");
  const noticeName = (slug: string | null) => integrations.find((i) => i.slug === slug)?.label ?? slug;
  const notice = connectedSlug
    ? t("integrations.notice.connected", { name: noticeName(connectedSlug) ?? "" })
    : failedSlug
      ? t("integrations.notice.failed", { name: noticeName(failedSlug) ?? "" })
      : null;

  function load() {
    fetch("/api/integrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente integrationer");
        return (await response.json()) as { integrations: IntegrationCardStatus[] };
      })
      .then((data) => {
        setIntegrations(data.integrations);
        // Forbundne cloud-integrationer synkroniseres automatisk første gang
        // siden åbnes (serveren springer over, hvis det er sket for nylig).
        if (autoSynced.current) return;
        autoSynced.current = true;
        for (const integration of data.integrations) {
          if (integration.kind === "oauth" && integration.slug && integration.status === "CONNECTED") {
            void sync(integration.slug);
          }
        }
      })
      .catch(() => setIntegrations([]))
      .finally(() => setLoading(false));
  }

  function loadTokens() {
    fetch("/api/integrations/healthkit/tokens")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente enhedskoder");
        return (await response.json()) as { tokens: DeviceToken[] };
      })
      .then((data) => setTokens(data.tokens))
      .catch(() => setTokens([]));
  }

  useEffect(() => {
    load();
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createToken(label: string) {
    setTokenBusy(true);
    try {
      const response = await fetch("/api/integrations/healthkit/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (response.ok) {
        const data = (await response.json()) as { token: string; label: string };
        setNewToken({ raw: data.token, label: data.label });
        loadTokens();
      }
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken(id: string) {
    setTokenBusy(true);
    try {
      await fetch(`/api/integrations/healthkit/tokens/${id}`, { method: "DELETE" });
      loadTokens();
    } finally {
      setTokenBusy(false);
    }
  }

  function connect(slug: string) {
    setBusyProvider(slug);
    window.location.assign(`/api/integrations/${slug}/connect`);
  }

  async function disconnect(slug: string) {
    setBusyProvider(slug);
    try {
      await fetch(`/api/integrations/${slug}/disconnect`, { method: "POST" });
      load();
    } finally {
      setBusyProvider(null);
    }
  }

  async function sync(slug: string) {
    setBusyProvider(slug);
    try {
      await fetch(`/api/integrations/${slug}/sync`, { method: "POST" });
      load();
    } finally {
      setBusyProvider(null);
    }
  }

  function statusBadge(integration: IntegrationCardStatus) {
    const [label, style] =
      integration.kind === "companion"
        ? [t("integrations.status.needsApp"), "bg-hf-tan-dark text-hf-black"]
        : integration.kind === "unavailable"
          ? [t("integrations.status.pending"), "bg-hf-tan-dark text-hf-black"]
          : integration.status === "CONNECTED"
            ? [t("integrations.status.connected"), "bg-hf-green text-hf-white"]
            : integration.status === "ERROR"
              ? [t("integrations.status.error"), "bg-red-500 text-hf-white"]
              : [t("integrations.status.disconnected"), "bg-hf-tan-dark text-hf-black"];
    return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${style}`}>{label}</span>;
  }

  return (
    <HfScreen title={t("integrations.title")}>
      <div className="hf-page">
        {notice && <p className="rounded-[8px] bg-hf-tan px-4 py-3 text-[13px] text-hf-black">{notice}</p>}

        <p className="px-1 text-[13px] leading-relaxed text-hf-black opacity-60">{t("integrations.intro")}</p>

        {helloFresh !== null && (
          <div className="flex items-start gap-3 rounded-[8px] bg-hf-tan p-4">
            <span className="mt-1 text-hf-black">
              <IconChefHat size={22} />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-hf-black">{t("integrations.helloFreshTitle")}</p>
              <p className="text-[12px] text-hf-black opacity-70">{t("integrations.helloFreshDescription")}</p>
            </div>
            <span className="pt-1">
              <Toggle checked={helloFresh} onChange={changeHelloFresh} />
            </span>
          </div>
        )}

        {loading && <p className="text-center text-[13px] text-hf-black opacity-60">{t("integrations.loading")}</p>}

        {!loading &&
          integrations.map((integration) => {
            const slug = integration.slug;
            const busy = busyProvider === slug;
            const isOAuth = integration.kind === "oauth" && slug !== null;
            const cardTokens = tokensFor(tokens, integration);

            return (
              <div
                key={integration.provider}
                className={`flex flex-col gap-4 rounded-[8px] bg-hf-tan p-4 ${
                  integration.kind === "unavailable" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={integration.icon}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-[8px] object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-hf-black">{integration.label}</p>
                    <p className="text-[12px] text-hf-black opacity-70">
                      {isOAuth && !integration.configured && integration.status !== "CONNECTED"
                        ? t("integrations.notConfigured")
                        : isOAuth
                          ? integration.description
                          : integration.unavailableReason}
                    </p>
                  </div>
                  {statusBadge(integration)}
                </div>

                {isOAuth && (
                  <div className="flex flex-col gap-2">
                    {integration.status !== "DISCONNECTED" ? (
                      <>
                        {integration.lastSyncedAt && (
                          <p className="text-[11px] text-hf-black opacity-60">
                            {t("integrations.lastSynced", { date: formatDateTime(integration.lastSyncedAt) })}
                          </p>
                        )}
                        {integration.lastError && <p className="text-[11px] text-red-600">{integration.lastError}</p>}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => sync(slug)}
                            className="hf-btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-50"
                          >
                            {busy ? t("integrations.syncing") : t("integrations.syncNow")}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => disconnect(slug)}
                            className="flex-1 rounded-full bg-hf-cream py-2.5 text-[13px] font-semibold text-hf-black disabled:opacity-50"
                          >
                            {t("integrations.disconnect")}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy || !integration.configured}
                        onClick={() => connect(slug)}
                        className="hf-btn-primary block w-full py-2.5 text-center text-[13px] disabled:opacity-50"
                      >
                        {t("integrations.connect")}
                      </button>
                    )}
                  </div>
                )}

                {integration.issuesDeviceTokens && (
                  <div className="flex flex-col gap-2 border-t border-hf-tan-dark pt-4">
                    <p className="text-[12px] text-hf-black opacity-70">{t("integrations.deviceTokensDescription")}</p>

                    {cardTokens.map((token) => (
                      <div
                        key={token.id}
                        className="flex items-center justify-between gap-2 rounded-[8px] bg-hf-cream px-3 py-2"
                      >
                        <p className="min-w-0 truncate text-[11px] text-hf-black opacity-60">
                          {t("integrations.createdAt", { date: formatDateTime(token.createdAt) })}
                          {token.lastUsedAt ? t("integrations.lastUsedAt", { date: formatDateTime(token.lastUsedAt) }) : ""}
                        </p>
                        <button
                          type="button"
                          disabled={tokenBusy}
                          onClick={() => revokeToken(token.id)}
                          className="shrink-0 text-[12px] font-semibold text-hf-red-dark disabled:opacity-50"
                        >
                          {t("integrations.remove")}
                        </button>
                      </div>
                    ))}

                    {newToken?.label === integration.label ? (
                      <div className="rounded-[8px] bg-hf-black p-3 text-hf-white">
                        <p className="text-[12px] font-semibold">{t("integrations.saveTokenNotice")}</p>
                        <p className="mt-1 break-all font-mono text-[12px]">{newToken.raw}</p>
                        <button
                          type="button"
                          onClick={() => setNewToken(null)}
                          className="mt-2 text-[12px] font-semibold underline"
                        >
                          {t("integrations.close")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={tokenBusy}
                        onClick={() => createToken(integration.label)}
                        className="w-full rounded-full bg-hf-cream py-2.5 text-[13px] font-semibold text-hf-black disabled:opacity-50"
                      >
                        {t("integrations.generateDeviceCode")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </HfScreen>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationerContent />
    </Suspense>
  );
}
