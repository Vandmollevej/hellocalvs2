"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  IconHelp,
  IconFileText,
  IconWorld,
  IconRefresh,
  IconPlugConnected,
  IconCreditCard,
  IconBell,
  IconMail,
  IconStethoscope,
  IconHome2,
  IconCalendarHeart,
  IconCalendarWeek,
  IconAlertTriangle,
  IconLifebuoy,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
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
  // "Menstruationscyklus" (Visning) only shows up for sex = FEMALE, per
  // docs/DECISIONS.md 2026-09-19 — fetched once here rather than blocking
  // the rest of the settings page on it.
  const [isFemale, setIsFemale] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { user: { sex: "FEMALE" | "MALE" | null } };
      })
      .then((data) => {
        if (!cancelled) setIsFemale(data.user.sex === "FEMALE");
      })
      .catch(() => {});
    fetch("/api/messages")
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { unreadCount: number };
      })
      .then((data) => {
        if (!cancelled) setUnreadMessages(data.unreadCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <HfScreen title={t("settings.title")}>
      {showOnboarding && (
        <OnboardingWizard forceVisible onClose={() => setShowOnboarding(false)} />
      )}

      <div className="hf-page hf-page--sections">
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
            icon={<IconMail size={20} />}
            label={t("settings.messages")}
            href="/profile/messages"
            badgeCount={unreadMessages}
          />
          <ChevronRow
            icon={<IconBell size={20} />}
            label={t("settings.notifications")}
            href="/profile/notifications"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconStethoscope size={20} />}
            label={t("settings.helloDoc")}
            href="/settings/hello-doc"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconLifebuoy size={20} />}
            label={t("settings.support.title")}
            href="/settings/support"
            divider={false}
          />
        </AccordionCard>

        <div className="flex flex-col gap-2">
          <p className="hf-heading px-1 text-xs font-bold uppercase tracking-wide text-hf-black opacity-60">
            {t("settings.display")}
          </p>
          <AccordionCard>
            <ChevronRow
              icon={<IconHome2 size={20} />}
              label={t("settings.frontPage")}
              href="/settings/display/front-page"
              divider
            />
            <ChevronRow
              icon={<IconAlertTriangle size={20} />}
              label={t("settings.recommendedLimits")}
              href="/settings/display/limits"
              divider
            />
            <ChevronRow
              icon={<IconCalendarWeek size={20} />}
              label={t("settings.calendarView")}
              href="/settings/display/calendar-view"
              divider={isFemale}
            />
            {isFemale && (
              <ChevronRow
                icon={<IconCalendarHeart size={20} />}
                label={t("settings.menstrualCycle")}
                href="/settings/display/menstrual-cycle"
                divider={false}
              />
            )}
          </AccordionCard>
        </div>

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
          <p className="hf-type-body-sm font-bold" style={{ color: "var(--hf-color-white)" }}>
            {t("settings.inviteFriend")}
          </p>
          <p className="hf-type-caption mt-1 opacity-90" style={{ color: "var(--hf-color-white)" }}>
            {t("settings.invitePointsDescription")}
          </p>
        </Link>
      </div>
    </HfScreen>
  );
}
