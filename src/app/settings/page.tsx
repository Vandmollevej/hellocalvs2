"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  IconWallet,
  IconAdjustments,
  IconBug,
  IconUsers,
  IconHistory,
  IconTrashOff,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useTranslation } from "@/i18n/LocaleProvider";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { Toggle } from "@/components/ui/Toggle";
import { HelpTip } from "@/components/hf/HelpTip";
import { saveShowStartupTips, saveShowTooltips, useShowStartupTips, useShowTooltips } from "@/lib/help-prefs";

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
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const showTooltips = useShowTooltips();
  const showStartupTips = useShowStartupTips();
  // "Menstruationscyklus" (Visning) only shows up for sex = FEMALE, per
  // docs/DECISIONS.md 2026-09-19 — fetched once here rather than blocking
  // the rest of the settings page on it.
  const [isFemale, setIsFemale] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { status: familyStatus } = useFamilyStatus();
  // Kontrol-loggen vises for den, der er med i en andens familie (barn,
  // partner — den, der kontrolleres), se docs/FAMILY.md.
  const isControlled = Boolean(familyStatus?.family && !familyStatus.family.isOwner);
  // Sletteret vises for den, der har oprettet (eller styrer) andre profiler.
  const controlsOthers = Boolean(
    familyStatus?.family?.members.some(
      (member) => member.controllerId === familyStatus.me.id && member.userId !== familyStatus.me.id
    )
  );

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
          <ChevronRow icon={<IconWorld size={20} />} label={t("settings.languageAndRegion")} divider={false} />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconCreditCard size={20} />}
            label={t("profile.row.subscription")}
            href="/profile/subscription"
          />
          <ChevronRow
            icon={<IconWallet size={20} />}
            label={t("settings.payment")}
            href="/settings/payment"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconUsers size={20} />}
            label={t("family.title")}
            href="/profile/family"
            divider={isControlled || controlsOthers}
          />
          {controlsOthers && (
            <ChevronRow
              icon={<IconTrashOff size={20} />}
              label={t("family.deletePermissions.title")}
              href="/settings/delete-permissions"
              divider={isControlled}
            />
          )}
          {isControlled && (
            <ChevronRow
              icon={<IconHistory size={20} />}
              label={t("family.log.title")}
              href="/settings/control-log"
              badgeCount={familyStatus?.unseenCount}
              divider={false}
            />
          )}
        </AccordionCard>

        <AccordionCard>
          <ChevronRow
            icon={<IconAdjustments size={20} />}
            label={t("settings.setupTitle")}
            href="/profile/settings"
            divider={false}
          />
        </AccordionCard>

        <AccordionCard>
          {/* Statisk hjælpeside i public/ — fuld sideindlæsning, ikke en app-route. */}
          <ChevronRow
            icon={<IconHelp size={20} />}
            label={t("settings.helpCenter")}
            onClick={() => window.location.assign("/hjaelp.html")}
          />
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
          />
          <ChevronRow
            icon={<IconBug size={20} />}
            label={t("profile.row.reportBug")}
            href="/profile/report-bug"
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
              icon={
                <span aria-hidden="true" className="w-5 text-center text-[22px] font-bold leading-none text-hf-green">
                  ~
                </span>
              }
              label={t("displaySettings.uncertainty")}
              href="/settings/display/uncertainty"
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
          <HelpTip>{t("settings.displayHelpTip")}</HelpTip>
          <Toggle
            label={t("settings.showTooltips")}
            description={t("settings.showTooltipsDescription")}
            checked={showTooltips}
            onChange={saveShowTooltips}
          />
          <Toggle
            label={t("settings.showStartupTips")}
            description={t("settings.showStartupTipsDescription")}
            checked={showStartupTips}
            onChange={saveShowStartupTips}
          />
        </div>

        <AccordionCard>
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.terms")} href="/betingelser" />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.privacyPolicy")} href="/privatlivspolitik" />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.dataTracking")} href="/privatlivspolitik#datasporing" divider={false} />
        </AccordionCard>

        <button
          type="button"
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).finally(() => {
              router.push("/login");
              router.refresh();
            });
          }}
          className="hf-type-body flex h-12 w-full items-center px-4 text-left font-bold"
        >
          {t("settings.logOut")}
        </button>
      </div>
    </HfScreen>
  );
}
