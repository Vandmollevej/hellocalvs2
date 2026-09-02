"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IconRun,
  IconScale,
  IconDeviceWatch,
  IconHeartbeat,
  IconBrandGoogle,
  type Icon,
} from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import type { IntegrationCardStatus } from "@/lib/integrations";
import type { IntegrationProvider } from "@prisma/client";

const PROVIDER_ICONS: Record<IntegrationProvider, Icon> = {
  FITBIT: IconRun,
  WITHINGS: IconScale,
  GARMIN: IconDeviceWatch,
  APPLE_HEALTH: IconHeartbeat,
  GOOGLE_HEALTH: IconBrandGoogle,
};

const STATUS_LABELS: Record<IntegrationCardStatus["status"], string> = {
  DISCONNECTED: "Ikke forbundet",
  CONNECTED: "Forbundet",
  ERROR: "Fejl",
};

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

function IntegrationerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationCardStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [tokens, setTokens] = useState<DeviceToken[]>([]);
  const [newToken, setNewToken] = useState<{ raw: string; label: string } | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);

  const notice =
    searchParams.get("connected") === "fitbit"
      ? "Fitbit blev forbundet."
      : searchParams.get("connected") === "withings"
        ? "Withings blev forbundet."
        : searchParams.get("error") === "fitbit_authorize_failed" ||
            searchParams.get("error") === "fitbit_token_exchange_failed"
          ? "Kunne ikke forbinde Fitbit. Prøv igen."
          : searchParams.get("error") === "withings_authorize_failed" ||
              searchParams.get("error") === "withings_token_exchange_failed"
            ? "Kunne ikke forbinde Withings. Prøv igen."
            : null;

  function load() {
    fetch("/api/integrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente integrationer");
        return (await response.json()) as { integrations: IntegrationCardStatus[] };
      })
      .then((data) => setIntegrations(data.integrations))
      .catch(() => setIntegrations([]))
      .finally(() => setLoading(false));
  }

  function loadTokens() {
    fetch("/api/integrations/healthkit/tokens")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente enhedstokens");
        return (await response.json()) as { tokens: DeviceToken[] };
      })
      .then((data) => setTokens(data.tokens))
      .catch(() => setTokens([]));
  }

  useEffect(() => {
    load();
    loadTokens();
  }, []);

  async function createToken() {
    setTokenBusy(true);
    try {
      const response = await fetch("/api/integrations/healthkit/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Companion-app" }),
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

  async function disconnect(provider: string) {
    setBusyProvider(provider);
    try {
      await fetch(`/api/integrations/${provider.toLowerCase()}/disconnect`, { method: "POST" });
      load();
    } finally {
      setBusyProvider(null);
    }
  }

  async function sync(provider: string) {
    setBusyProvider(provider);
    try {
      await fetch(`/api/integrations/${provider.toLowerCase()}/sync`, { method: "POST" });
      load();
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      <ScreenHeader title="Integrationer" onBack={() => router.back()} />

      <div className="flex flex-col gap-4 p-4">
        {notice && (
          <p className="rounded-xl bg-hf-tan px-4 py-3 text-[13px] text-hf-black">{notice}</p>
        )}

        <p className="px-1 text-[13px] leading-relaxed text-hf-black opacity-60">
          Forbind Fitbit eller Withings for at hente sport, forbrænding og vægt automatisk. De
          øvrige kræver enten en companion-app eller et tredjeparts-abonnement — ikke tilkoblet
          endnu.
        </p>

        {loading && <p className="text-center text-[13px] text-hf-black opacity-60">Henter…</p>}

        {!loading &&
          integrations.map((integration) => {
            const Icon = PROVIDER_ICONS[integration.provider];
            const busy = busyProvider === integration.provider;

            return (
              <div
                key={integration.provider}
                className={`flex flex-col gap-3 rounded-2xl bg-hf-tan p-4 ${
                  integration.connectable || integration.ingestOnly ? "" : "opacity-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-hf-black">
                    <Icon size={22} />
                  </span>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-hf-black">{integration.label}</p>
                    <p className="text-[12px] text-hf-black opacity-70">
                      {integration.connectable ? integration.description : integration.unavailableReason}
                    </p>
                  </div>
                  {integration.connectable && (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        integration.status === "CONNECTED"
                          ? "bg-hf-green text-hf-white"
                          : integration.status === "ERROR"
                            ? "bg-red-500 text-hf-white"
                            : "bg-hf-tan-dark text-hf-black"
                      }`}
                    >
                      {STATUS_LABELS[integration.status]}
                    </span>
                  )}
                </div>

                {integration.connectable && (
                  <div className="flex flex-col gap-2">
                    {integration.status === "CONNECTED" ? (
                      <>
                        {integration.lastSyncedAt && (
                          <p className="text-[11px] text-hf-black opacity-60">
                            Sidst synkroniseret {formatDateTime(integration.lastSyncedAt)}
                          </p>
                        )}
                        {integration.lastError && (
                          <p className="text-[11px] text-red-600">{integration.lastError}</p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => sync(integration.provider)}
                            className="hf-btn-primary flex-1 py-2.5 text-[13px] disabled:opacity-50"
                          >
                            Synkroniser nu
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => disconnect(integration.provider)}
                            className="flex-1 rounded-full bg-hf-cream py-2.5 text-[13px] font-semibold text-hf-black disabled:opacity-50"
                          >
                            Frakobl
                          </button>
                        </div>
                      </>
                    ) : (
                      <a
                        href={`/api/integrations/${integration.provider.toLowerCase()}/connect`}
                        className="hf-btn-primary block w-full py-2.5 text-center text-[13px]"
                      >
                        Forbind
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {!loading && (
          <div className="flex flex-col gap-3 rounded-2xl bg-hf-tan p-4">
            <div>
              <p className="text-[15px] font-bold text-hf-black">Enhedstokens (companion-app)</p>
              <p className="text-[12px] text-hf-black opacity-70">
                Bruges af en fremtidig iOS/Android-app til at sende Apple Health-/Google Health-data
                til Hello Cal — se docs/HEALTHKIT_COMPANION.md. Ingen app findes endnu, men koden kan
                genereres og gemmes klar.
              </p>
            </div>

            {tokens.map((token) => (
              <div key={token.id} className="flex items-center justify-between gap-2 rounded-xl bg-hf-cream px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-hf-black">{token.label}</p>
                  <p className="text-[11px] text-hf-black opacity-60">
                    Oprettet {formatDateTime(token.createdAt)}
                    {token.lastUsedAt ? ` · Sidst brugt ${formatDateTime(token.lastUsedAt)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={tokenBusy}
                  onClick={() => revokeToken(token.id)}
                  className="shrink-0 text-[12px] font-semibold text-hf-red-dark disabled:opacity-50"
                >
                  Fjern
                </button>
              </div>
            ))}

            {newToken ? (
              <div className="rounded-xl bg-hf-black p-3 text-hf-white">
                <p className="text-[12px] font-semibold">Gem denne værdi nu — den vises ikke igen:</p>
                <p className="mt-1 break-all font-mono text-[12px]">{newToken.raw}</p>
                <button
                  type="button"
                  onClick={() => setNewToken(null)}
                  className="mt-2 text-[12px] font-semibold underline"
                >
                  Luk
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={tokenBusy}
                onClick={createToken}
                className="hf-btn-primary py-2.5 text-[13px] disabled:opacity-50"
              >
                Generér enhedskode
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationerContent />
    </Suspense>
  );
}
