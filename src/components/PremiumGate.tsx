"use client";

import Link from "next/link";
import { createContext, useContext } from "react";
import { IconLock } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useSubscriptionTier } from "@/lib/use-subscription-tier";

// Seriøs-låste sider (docs/DECISIONS.md 2026-09-26). Bruges fra en route-
// layout.tsx, så selve siden (og dens datahentning) slet ikke renderes for
// gratisbrugere — de ser i stedet en kort forklaring og vejen til Seriøs.
//
// renderWhilePending: mens niveauet hentes, tegnes siden selv som skelet
// (design.md §6.14) i stedet for en tom skærm. Siden læser
// usePremiumPending() og venter med sin datahentning, til niveauet er kendt;
// samme element bliver stående, så data blot fyldes ind på pladserne.
const PremiumPendingContext = createContext(false);

/** Sand, mens PremiumGate (med renderWhilePending) endnu ikke kender niveauet. */
export function usePremiumPending() {
  return useContext(PremiumPendingContext);
}

export function PremiumGate({
  titleKey,
  children,
  renderWhilePending = false,
}: {
  titleKey: string;
  children: React.ReactNode;
  renderWhilePending?: boolean;
}) {
  const { t } = useTranslation();
  const tier = useSubscriptionTier();

  if (tier === "SERIOUS" || (tier === null && renderWhilePending)) {
    return <PremiumPendingContext.Provider value={tier === null}>{children}</PremiumPendingContext.Provider>;
  }

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
        <p className="text-text-secondary hf-type-body">{t("premium.description")}</p>
      </div>
      <Link href="/profile/subscription/serious" className="hf-control hf-btn-primary w-full">
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
