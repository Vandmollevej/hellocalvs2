"use client";

import { useState } from "react";
import Link from "next/link";
import {
  IconHelp,
  IconFileText,
  IconWorld,
  IconRefresh,
  IconPlugConnected,
  IconCreditCard,
  IconBell,
} from "@tabler/icons-react";
import { ScreenHeader } from "@/components/hf/ScreenHeader";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { BottomNav } from "@/components/BottomNav";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useTranslation } from "@/i18n/LocaleProvider";

function resetOnboardingProgress() {
  return fetch("/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      onboardingStep: 0,
      onboardingCompletedAt: null,
      onboardingRemindLaterAt: null,
      onboardingDismissed: false,
    }),
  }).catch(() => {});
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-hf-cream">
      {showOnboarding && (
        <OnboardingWizard forceVisible onClose={() => setShowOnboarding(false)} />
      )}
      <ScreenHeader title={t("settings.title")} />

      <div className="flex flex-col gap-8 p-4">
        <AccordionCard>
          <ChevronRow
            icon={<IconCreditCard size={20} />}
            label={t("settings.payment")}
            href="/settings/payment"
            divider={false}
          />
        </AccordionCard>

        <div className="rounded-[8px] bg-hf-tan p-4 text-center">
          <p className="hf-type-body-sm font-bold">{t("settings.recipesPromo")}</p>
          <button className="hf-btn-primary mt-4 h-12 w-full text-[17px]">
            {t("settings.logInOrSignUp")}
          </button>
        </div>

        <AccordionCard>
          <ChevronRow icon={<IconHelp size={20} />} label={t("settings.helpCenter")} />
          <ChevronRow
            icon={<IconRefresh size={20} />}
            label={t("settings.learnTheApp")}
            onClick={() => {
              resetOnboardingProgress().then(() => setShowOnboarding(true));
            }}
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconPlugConnected size={20} />}
            label={t("settings.integrations")}
            href="/settings/integrations"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconBell size={20} />}
            label={t("settings.notifications")}
            href="/profile/notifications"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.terms")} href="/betingelser" />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.privacyPolicy")} />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.dataTracking")} divider={false} />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow icon={<IconWorld size={20} />} label={t("settings.chooseCountry")} divider={false} />
        </AccordionCard>

        <Link
          href="/profile/invite"
          className="block rounded-[8px] bg-hf-green p-4 text-left text-hf-white"
        >
          <p className="hf-type-body-sm font-bold">{t("settings.inviteFriend")}</p>
          <p className="hf-type-caption mt-0.5 text-hf-white opacity-90">
            {t("settings.invitePointsDescription")}
          </p>
        </Link>
      </div>

      <div className="flex-1" />
      <BottomNav />
    </div>
  );
}
