"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { IconChefHat, IconChevronRight, IconFileImport } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { IntegrationIcon } from "@/components/IntegrationIcon";
import type { IntegrationCardStatus } from "@/lib/integrations";
import type { IntegrationProvider } from "@prisma/client";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatDateTime } from "./status-badge";
import { SkeletonCards, SkeletonScreen, SkeletonSectionTitle } from "@/components/hf/Skeleton";
import { MEAL_KIT_PROVIDERS, parseRecipeProviders, type MealKitKey } from "@/lib/meal-kit-providers";

// Sektioner og rækkefølge (docs/DECISIONS.md 2026-09-25 "Integrationssiden"):
// Aktive integrationer → Oftest anvendt → Opskrifter → Apps.
// Hver app har sin egen side (/settings/integrations/<app>), hvor brugeren
// vælger til/fra, hvad der hentes og sendes, og forbinder/frakobler
// (docs/DECISIONS.md 2026-09-26).
const POPULAR: IntegrationProvider[] = ["APPLE_HEALTH", "GOOGLE_HEALTH", "STRAVA"];

const isActive = (integration: IntegrationCardStatus) => integration.status !== "DISCONNECTED";

// Måltidskasserne under "Opskrifter" (docs/DECISIONS.md 2026-10-10): titel og
// beskrivelse pr. udbyder (i18n-nøgler).
const MEAL_KIT_TEXTS: Record<MealKitKey, { title: string; description: string }> = {
  hellofresh: { title: "integrations.helloFreshTitle", description: "integrations.helloFreshDescription" },
  retnemt: { title: "integrations.retNemtTitle", description: "integrations.retNemtDescription" },
  betterfeast: { title: "integrations.betterFeastTitle", description: "integrations.betterFeastDescription" },
};

function Card({
  icon,
  title,
  description,
  active,
  dimmed,
  chevron,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  active: boolean;
  dimmed?: boolean;
  chevron?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-card flex flex-col gap-4 bg-hf-tan p-4 ${dimmed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="hf-type-body hf-type-strong flex items-center gap-2 text-hf-black">
            {active && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-hf-green" />}
            {title}
          </p>
          <p className="hf-type-small text-text-secondary">{description}</p>
        </div>
        {chevron && <IconChevronRight size={18} className="mt-1 shrink-0 text-hf-black opacity-40" />}
      </div>
      {children}
    </div>
  );
}

function IntegrationerContent() {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState<IntegrationCardStatus[]>([]);
  const [loading, setLoading] = useState(true);
  // Måltidskassernes retter i "Delte retter" (docs/DECISIONS.md 2026-09-24
  // og 2026-10-10), gemt i User.recipeProviders.
  const [providers, setProviders] = useState<MealKitKey[] | null>(null);
  const autoSynced = useRef(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (res) => (res.ok ? ((await res.json()) as { user?: { recipeProviders?: unknown } }) : {}))
      .then((data) => setProviders(parseRecipeProviders(data.user?.recipeProviders)))
      .catch(() => setProviders([]));
  }, []);

  async function changeProvider(key: MealKitKey, enabled: boolean) {
    const previous = providers ?? [];
    const next = parseRecipeProviders(enabled ? [...previous, key] : previous.filter((p) => p !== key));
    setProviders(next);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeProviders: next }),
    }).catch(() => null);
    if (!res?.ok) setProviders(previous);
  }

  function load() {
    fetch("/api/integrations")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente integrationer");
        return (await response.json()) as { integrations: IntegrationCardStatus[] };
      })
      .then((data) => {
        setIntegrations(data.integrations);
        // Forbundne cloud-integrationer synkroniseres, når siden åbnes
        // (serveren springer over, hvis det er sket for nylig; ellers sørger
        // baggrundsjobbet for det hvert 15. minut).
        if (autoSynced.current) return;
        autoSynced.current = true;
        const toSync = data.integrations.filter((i) => i.kind === "oauth" && i.slug && i.status === "CONNECTED");
        if (toSync.length === 0) return;
        void Promise.all(toSync.map((i) => fetch(`/api/integrations/${i.slug}/sync`, { method: "POST" }).catch(() => null))).then(
          load
        );
      })
      .catch(() => setIntegrations([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function integrationCard(integration: IntegrationCardStatus) {
    const isOAuth = integration.kind === "oauth" && integration.slug !== null;
    const active = isActive(integration);
    const unavailable = integration.kind === "unavailable";
    const description =
      isOAuth && !integration.configured && !active ? t("integrations.notConfigured") : integration.description;

    const card = (
      <Card
        active={active}
        dimmed={unavailable}
        chevron={!unavailable}
        title={integration.label}
        description={description}
        icon={<IntegrationIcon icon={integration.icon} label={integration.label} size={36} className="h-9 w-9 rounded-card" />}
      >
        {unavailable ? (
          <p className="hf-type-small text-text-secondary">{t("integrations.unavailable")}</p>
        ) : active ? (
          <div className="flex flex-col gap-1">
            {integration.lastSyncedAt && (
              <p className="hf-type-micro text-text-secondary">
                {t("integrations.lastSynced", { date: formatDateTime(integration.lastSyncedAt) })}
              </p>
            )}
            {integration.lastError && <p className="hf-type-micro text-hf-red-dark">{integration.lastError}</p>}
          </div>
        ) : (
          <span className="hf-btn-primary block w-full py-2.5 text-center">
            {integration.kind === "companion"
              ? t("integrations.manage")
              : integration.kind === "via"
                ? t("integrations.howTo")
                : t("integrations.connect")}
          </span>
        )}
      </Card>
    );

    // En integration, der afventer partneraftale, har intet at vælge endnu.
    if (unavailable) return <div key={integration.provider}>{card}</div>;
    return (
      <Link key={integration.provider} href={`/settings/integrations/${integration.pageSlug}`} className="block">
        {card}
      </Link>
    );
  }

  const mealKitCard = (key: MealKitKey) => {
    const enabled = providers?.includes(key) ?? false;
    return (
      <Card
        key={key}
        active={enabled}
        title={t(MEAL_KIT_TEXTS[key].title)}
        description={t(MEAL_KIT_TEXTS[key].description)}
        icon={
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-hf-black">
            <IconChefHat size={24} />
          </span>
        }
      >
        {enabled ? (
          <button
            type="button"
            onClick={() => changeProvider(key, false)}
            className="hf-type-small self-start text-hf-red-dark"
          >
            {t("integrations.remove")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => changeProvider(key, true)}
            className="hf-control hf-btn-primary block w-full text-center"
          >
            {t("integrations.enable")}
          </button>
        )}
      </Card>
    );
  };
  const enabledMealKits = providers === null ? [] : MEAL_KIT_PROVIDERS.filter((p) => providers.includes(p.key));
  const otherMealKits = providers === null ? [] : MEAL_KIT_PROVIDERS.filter((p) => !providers.includes(p.key));

  const activeIntegrations = integrations.filter(isActive);
  const inactive = integrations.filter((i) => !isActive(i));
  const popular = POPULAR.flatMap((provider) => inactive.filter((i) => i.provider === provider));
  const apps = inactive.filter((i) => !POPULAR.includes(i.provider));

  const section = (label: string, cards: ReactNode[]) =>
    cards.length > 0 && (
      <>
        <h2 className="hf-type-section-title">{label}</h2>
        {cards}
      </>
    );

  return (
    <HfScreen title={t("integrations.title")}>
      <div className="hf-page">
        <p className="hf-type-small text-text-secondary px-1">{t("integrations.intro")}</p>

        {loading ? (
          <SkeletonScreen className="contents">
            <SkeletonSectionTitle />
            <SkeletonCards count={2} height={84} />
            <SkeletonSectionTitle />
            <SkeletonCards count={3} height={84} />
          </SkeletonScreen>
        ) : (
          <>
            {section(t("integrations.sections.active"), [
              ...activeIntegrations.map(integrationCard),
              ...enabledMealKits.map((p) => mealKitCard(p.key)),
            ])}
            {section(t("integrations.sections.popular"), popular.map(integrationCard))}
            {section(t("integrations.sections.recipes"), otherMealKits.map((p) => mealKitCard(p.key)))}
            {section(t("integrations.sections.apps"), apps.map(integrationCard))}
            {section(t("integrations.sections.moveFrom"), [
              <Link key="migration-import" href="/settings/import" className="block">
                <Card
                  active={false}
                  chevron
                  title={t("integrations.moveFromTitle")}
                  description={t("integrations.moveFromDescription")}
                  icon={
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center text-hf-black">
                      <IconFileImport size={24} />
                    </span>
                  }
                />
              </Link>,
            ])}
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
