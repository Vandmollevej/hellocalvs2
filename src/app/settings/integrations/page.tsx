"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { IconChefHat } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { SectionSeparator } from "@/components/hf/SectionSeparator";
import type { IntegrationCardStatus } from "@/lib/integrations";
import type { IntegrationProvider } from "@prisma/client";
import { useTranslation } from "@/i18n/LocaleProvider";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// Sektioner og rækkefølge (docs/DECISIONS.md 2026-09-25 "Integrationssiden"):
// Aktive integrationer → Oftest anvendt → Opskrifter → Apps.
const POPULAR: IntegrationProvider[] = ["APPLE_HEALTH", "GOOGLE_HEALTH", "STRAVA"];

const isActive = (integration: IntegrationCardStatus) => integration.status !== "DISCONNECTED";

function Card({
  icon,
  title,
  description,
  active,
  dimmed,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  active: boolean;
  dimmed?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-4 rounded-[8px] bg-hf-tan p-4 ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="hf-type-body hf-type-strong flex items-center gap-2 text-hf-black">
            {active && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-hf-green" />}
            {title}
          </p>
          <p className="hf-type-small text-text-secondary">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function IntegrationerContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationCardStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  // HelloFresh-opskrifter i "Delte retter" (docs/DECISIONS.md 2026-09-24).
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

  async function sync(slug: string) {
    try {
      await fetch(`/api/integrations/${slug}/sync`, { method: "POST" });
      load();
    } catch {
      // Status og fejl vises fra næste load.
    }
  }

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const removeLink = (onClick: () => void, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="hf-type-small self-start text-hf-red-dark disabled:opacity-50"
    >
      {t("integrations.remove")}
    </button>
  );

  function integrationCard(integration: IntegrationCardStatus) {
    const slug = integration.slug;
    const busy = busyProvider === slug;
    const isOAuth = integration.kind === "oauth" && slug !== null;
    const active = isActive(integration);
    const description =
      isOAuth && !integration.configured && !active ? t("integrations.notConfigured") : integration.description;

    return (
      <Card
        key={integration.provider}
        active={active}
        dimmed={!isOAuth}
        title={integration.label}
        description={description}
        icon={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={integration.icon}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-[8px] object-contain"
          />
        }
      >
        {!isOAuth ? (
          <p className="hf-type-small text-text-secondary">{t("integrations.unavailable")}</p>
        ) : active ? (
          <div className="flex flex-col gap-1">
            {integration.lastSyncedAt && (
              <p className="hf-type-micro text-text-secondary">
                {t("integrations.lastSynced", { date: formatDateTime(integration.lastSyncedAt) })}
              </p>
            )}
            {integration.lastError && <p className="hf-type-micro text-hf-red-dark">{integration.lastError}</p>}
            {removeLink(() => disconnect(slug), busy)}
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !integration.configured}
            onClick={() => connect(slug)}
            className="hf-btn-primary block w-full py-2.5 text-center disabled:opacity-50"
          >
            {t("integrations.connect")}
          </button>
        )}
      </Card>
    );
  }

  const helloFreshCard =
    helloFresh === null ? null : (
      <Card
        key="hellofresh"
        active={helloFresh}
        title={t("integrations.helloFreshTitle")}
        description={t("integrations.helloFreshDescription")}
        icon={
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-hf-black">
            <IconChefHat size={24} />
          </span>
        }
      >
        {helloFresh ? (
          removeLink(() => changeHelloFresh(false))
        ) : (
          <button
            type="button"
            onClick={() => changeHelloFresh(true)}
            className="hf-btn-primary block w-full py-2.5 text-center"
          >
            {t("integrations.enable")}
          </button>
        )}
      </Card>
    );

  const activeIntegrations = integrations.filter(isActive);
  const inactive = integrations.filter((i) => !isActive(i));
  const popular = POPULAR.flatMap((provider) => inactive.filter((i) => i.provider === provider));
  const apps = inactive.filter((i) => !POPULAR.includes(i.provider));

  const section = (label: string, cards: ReactNode[]) =>
    cards.length > 0 && (
      <>
        <SectionSeparator label={label} className="mt-2" />
        {cards}
      </>
    );

  return (
    <HfScreen title={t("integrations.title")}>
      <div className="hf-page">
        {notice && <p className="hf-type-small rounded-[8px] bg-hf-tan px-4 py-3 text-hf-black">{notice}</p>}

        <p className="hf-type-small text-text-secondary px-1">{t("integrations.intro")}</p>

        {loading ? (
          <p className="hf-type-small text-text-secondary text-center">{t("integrations.loading")}</p>
        ) : (
          <>
            {section(t("integrations.sections.active"), [
              ...activeIntegrations.map(integrationCard),
              ...(helloFresh ? [helloFreshCard] : []),
            ])}
            {section(t("integrations.sections.popular"), popular.map(integrationCard))}
            {section(t("integrations.sections.recipes"), helloFresh === false ? [helloFreshCard] : [])}
            {section(t("integrations.sections.apps"), apps.map(integrationCard))}
          </>
        )}
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
