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
  IconHome2,
  IconCalendarHeart,
  IconCalendarWeek,
  IconAlertTriangle,
  IconLifebuoy,
  IconMoon,
  IconAdjustments,
  IconBug,
  IconUsers,
  IconHistory,
  IconTrashOff,
  IconBulb,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { IconPaymentCard } from "@/components/icons/PaymentCard";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SearchField } from "@/components/knowledge/SearchField";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";

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
  // "Menstruationscyklus" (Visning) only shows up for sex = FEMALE, per
  // docs/DECISIONS.md 2026-09-19 — fetched once here rather than blocking
  // the rest of the settings page on it.
  const [isFemale, setIsFemale] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { status: familyStatus } = useFamilyStatus();
  // Kontrol-loggen vises for den, der er med i en andens familie (barn,
  // partner — den, der kontrolleres), se docs/FAMILY.md.
  const isControlled = Boolean(familyStatus?.family && !familyStatus.family.isOwner);
  // Familie vises kun for dem, der har familieabonnement eller er med i en
  // familie (docs/DECISIONS.md 2026-10-02). Administratorer har det altid.
  const showFamily = Boolean(familyStatus?.hasFamilyPlan || familyStatus?.family);
  // Sletteret vises for den, der har oprettet (eller styrer) andre profiler.
  const controlsOthers = Boolean(
    familyStatus?.family?.members.some(
      (member) => member.controllerId === familyStatus.me.id && member.userId !== familyStatus.me.id
    )
  );

  // Hjælpecenterets "Start guiden" (public/hjaelp.html) linker til
  // /settings?guide=1 og starter "Lær appen at kende" direkte.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("guide") !== "1") return;
    router.replace("/settings");
    resetOnboardingProgress().then(() => setShowOnboarding(true));
  }, [router]);

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

  const [query, setQuery] = useState("");
  // Søgefeltet viser en flad liste over alle punkter her (tekst-match på rækkens navn).
  type SearchItem = { icon: React.ReactNode; label: string; href?: string; onClick?: () => void };
  const searchItems: SearchItem[] = [
    { icon: <IconWorld size={20} />, label: t("settings.languageAndRegion"), href: "/profile/settings/language-region" },
    ...(showFamily ? [{ icon: <IconUsers size={20} />, label: t("family.title"), href: "/profile/family" }] : []),
    { icon: <IconCreditCard size={20} />, label: t("profile.row.subscription"), href: "/profile/subscription" },
    { icon: <IconPaymentCard size={20} />, label: t("settings.payment"), href: "/settings/payment" },
    { icon: <IconAdjustments size={20} />, label: t("settings.setupTitle"), href: "/profile/settings" },
    {
      icon: <IconRefresh size={20} />,
      label: t("settings.learnTheApp"),
      onClick: () => {
        resetOnboardingProgress().then(() => setShowOnboarding(true));
      },
    },
    { icon: <IconPlugConnected size={20} />, label: t("settings.integrations"), href: "/settings/integrations" },
    { icon: <IconMail size={20} />, label: t("settings.messages"), href: "/profile/messages" },
    { icon: <IconBell size={20} />, label: t("settings.notifications"), href: "/profile/notifications" },
    { icon: <IconHome2 size={20} />, label: t("settings.frontPage"), href: "/settings/display/front-page" },
    { icon: <IconAlertTriangle size={20} />, label: t("settings.recommendedLimits"), href: "/settings/display/limits" },
    { icon: <IconAdjustments size={20} />, label: t("displaySettings.uncertainty"), href: "/settings/display/uncertainty" },
    { icon: <IconCalendarWeek size={20} />, label: t("settings.calendarView"), href: "/settings/display/calendar-view" },
    { icon: <IconMoon size={20} />, label: t("settings.sleepQuality"), href: "/settings/display/sleep-quality" },
    { icon: <IconBulb size={20} />, label: t("settings.tipsTitle"), href: "/settings/display/tips" },
    ...(isFemale
      ? [{ icon: <IconCalendarHeart size={20} />, label: t("settings.menstrualCycle"), href: "/settings/display/menstrual-cycle" }]
      : []),
    { icon: <IconHelp size={20} />, label: t("settings.helpCenter"), onClick: () => window.location.assign("/hjaelp.html") },
    { icon: <IconBug size={20} />, label: t("profile.row.reportBug"), href: "/profile/report-bug" },
    { icon: <IconLifebuoy size={20} />, label: t("settings.contactSupport"), href: "/settings/support" },
    { icon: <IconFileText size={20} />, label: t("settings.terms"), href: "/betingelser" },
    { icon: <IconFileText size={20} />, label: t("settings.privacyPolicy"), href: "/privatlivspolitik" },
    { icon: <IconFileText size={20} />, label: t("settings.dataTracking"), href: "/privatlivspolitik#datasporing" },
  ];
  const normalizedQuery = query.trim().toLowerCase();
  const results = normalizedQuery ? searchItems.filter((item) => item.label.toLowerCase().includes(normalizedQuery)) : null;

  return (
    <HfScreen title={t("settings.title")}>
      {showOnboarding && (
        <OnboardingWizard forceVisible onClose={() => setShowOnboarding(false)} />
      )}

      <div className="hf-page hf-page--sections">
        <SearchField value={query} onChange={setQuery} placeholder={t("settings.search")} />
        {results ? (
          results.length > 0 ? (
            <AccordionCard>
              {results.map((item, index) => (
                <ChevronRow
                  key={item.label}
                  icon={item.icon}
                  label={item.label}
                  href={item.href}
                  onClick={item.onClick}
                  divider={index < results.length - 1}
                />
              ))}
            </AccordionCard>
          ) : (
            <p className="hf-type-body text-text-secondary px-1">{t("settings.searchNoResults")}</p>
          )
        ) : (
          <>
        <AccordionCard>
          <ChevronRow icon={<IconWorld size={20} />} label={t("settings.languageAndRegion")} href="/profile/settings/language-region" divider={false} />
        </AccordionCard>

        <AccordionCard>
          {showFamily && (
            <>
              <ChevronRow
                icon={<IconUsers size={20} />}
                label={t("family.title")}
                href="/profile/family"
              />
              {controlsOthers && (
                <ChevronRow
                  icon={<IconTrashOff size={20} />}
                  label={t("family.deletePermissions.title")}
                  href="/settings/delete-permissions"
                />
              )}
              {isControlled && (
                <ChevronRow
                  icon={<IconHistory size={20} />}
                  label={t("family.log.title")}
                  href="/settings/control-log"
                  badgeCount={familyStatus?.unseenCount}
                />
              )}
            </>
          )}
          <ChevronRow
            icon={<IconCreditCard size={20} />}
            label={t("profile.row.subscription")}
            href="/profile/subscription"
          />
          <ChevronRow
            icon={<IconPaymentCard size={20} />}
            label={t("settings.payment")}
            href="/settings/payment"
            divider={false}
          />
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

        <div className="flex flex-col gap-2">
          <p className="hf-type-small hf-type-strong text-text-secondary hf-heading px-1 uppercase tracking-wide">
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
                <span aria-hidden="true" className="hf-type-page-title w-5 text-center leading-none text-hf-green">
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
              divider
            />
            <ChevronRow
              icon={<IconMoon size={20} />}
              label={t("settings.sleepQuality")}
              href="/settings/display/sleep-quality"
              divider
            />
            <ChevronRow
              icon={<IconBulb size={20} />}
              label={t("settings.tipsTitle")}
              href="/settings/display/tips"
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
          {/* Statisk hjælpeside i public/ — fuld sideindlæsning, ikke en app-route. */}
          <ChevronRow
            icon={<IconHelp size={20} />}
            label={t("settings.helpCenter")}
            onClick={() => window.location.assign("/hjaelp.html")}
          />
          <ChevronRow icon={<IconBug size={20} />} label={t("profile.row.reportBug")} href="/profile/report-bug" />
          <ChevronRow
            icon={<IconLifebuoy size={20} />}
            label={t("settings.contactSupport")}
            href="/settings/support"
          />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.terms")} href="/betingelser" />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.privacyPolicy")} href="/privatlivspolitik" />
          <ChevronRow icon={<IconFileText size={20} />} label={t("settings.dataTracking")} href="/privatlivspolitik#datasporing" divider={false} />
        </AccordionCard>
          </>
        )}

        <button
          type="button"
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).finally(() => {
              router.push("/login");
              router.refresh();
            });
          }}
          className="hf-type-body flex h-12 w-full items-center px-4 text-left"
        >
          {t("settings.logOut")}
        </button>
      </div>
    </HfScreen>
  );
}
