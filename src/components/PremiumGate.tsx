"use client";

import Link from "next/link";
import { IconLock } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useSubscriptionTier } from "@/lib/use-subscription-tier";

// Seriøs-låste sider (docs/DECISIONS.md 2026-09-26). Bruges fra en route-
// layout.tsx, så selve siden (og dens datahentning) slet ikke renderes for
// gratisbrugere — de ser i stedet en kort forklaring og vejen til Seriøs.
export function PremiumGate({ titleKey, children }: { titleKey: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  const tier = useSubscriptionTier();

  if (tier === "SERIOUS") return <>{children}</>;

  return (
    <HfScreen title={t(titleKey)}>
      {tier === "FREE" && <PremiumUpsell />}
    </HfScreen>
  );
}

export function PremiumUpsell() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col items-center gap-3 rounded-lg bg-hf-tan p-6 text-center">
        <IconLock size={28} aria-hidden="true" />
        <p className="hf-type-section-title">{t("premium.title")}</p>
        <p className="hf-type-body-sm opacity-80">{t("premium.description")}</p>
      </div>
      <Link href="/profile/subscription/serious" className="hf-btn-primary hf-type-button h-12 w-full">
        {t("premium.cta")}
      </Link>
    </div>
  );
}

/** Lille "Seriøs"-mærke ved enkeltfunktioner, der er låst for gratisbrugere. */
export function PremiumBadge() {
  const { t } = useTranslation();
  return (
    <span className="hf-type-caption inline-flex items-center gap-1 rounded-full bg-hf-tan px-2 py-0.5">
      <IconLock size={12} aria-hidden="true" />
      {t("premium.badge")}
    </span>
  );
}
