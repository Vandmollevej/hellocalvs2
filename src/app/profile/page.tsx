"use client";

import { useEffect, useState } from "react";
import {
  IconMoon,
  IconUser,
  IconStar,
  IconBook,
  IconChartLine,
  IconUsers,
  IconMail,
  IconStethoscope,
  IconRefresh,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { IconPhotoFrame } from "@/components/icons/PhotoFrame";
import { IconPlateCutlery } from "@/components/icons/PlateCutlery";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { IconWaistMeasure } from "@/components/icons/WaistMeasure";
import { HfProgressStepper } from "@/components/hf/HfProgressStepper";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { accountSetupDone, isAccountSetupComplete, type AccountSetupUser } from "@/lib/account-setup";
import { useTranslation } from "@/i18n/LocaleProvider";
import { ProfileSwitcher } from "@/components/family/ProfileSwitcher";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { SkeletonCards, SkeletonList, SkeletonScreen } from "@/components/hf/Skeleton";

type Sex = "FEMALE" | "MALE";

type ProfileUser = AccountSetupUser & {
  displayName: string;
  email: string;
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  sex: Sex | null;
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

export default function ProfilePage() {
  const { t } = useTranslation();
  const { status: familyStatus } = useFamilyStatus();
  // Medlemmer af en familie (ikke betaleren) har "Familie" øverst: hvem de
  // deler deres profil med (ejerens ønske 2026-10-03).
  const isFamilyMember = Boolean(familyStatus?.family && !familyStatus.family.isOwner);
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Kunne ikke hente profil");
        return (await response.json()) as { user: ProfileUser };
      })
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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

  const setupDone = user ? accountSetupDone(user) : { aboutYou: false, goals: false, habits: false };
  const setupComplete = user ? isAccountSetupComplete(user) : false;

  return (
    <HfScreen title={t("profile.title")} alwaysShowBackButton showAppSettingsButton>
      {loading || !user ? (
        loading ? (
          <SkeletonScreen>
            <SkeletonCards count={1} height={64} />
            <SkeletonList rows={9} />
          </SkeletonScreen>
        ) : (
          <p className="hf-type-body text-text-secondary p-4 text-center">{t("profile.loadError")}</p>
        )
      ) : (
        <div className="hf-page">
          {showGuide && <OnboardingWizard forceVisible onClose={() => setShowGuide(false)} />}
          {/* Proceslinjen og kassen står allerøverst, før alt andet, til alle felter og indstillinger er sat. */}
          {!setupComplete && (
            <HfProgressStepper
              steps={[
                t("profile.completion.aboutYou"),
                t("profile.completion.goals"),
                t("profile.completion.habits"),
              ]}
              current={Math.max(0, Object.values(setupDone).indexOf(false))}
              progress={0}
              label={t("profile.completion.label")}
            />
          )}
          {!setupComplete && (
            <AccordionCard>
              <ChevronRow
                icon={<IconRefresh size={20} />}
                label={t("settings.learnTheApp")}
                onClick={() => setShowGuide(true)}
                divider={false}
              />
            </AccordionCard>
          )}
          {isFamilyMember && (
            <AccordionCard>
              <ChevronRow
                icon={<IconUsers size={20} />}
                label={t("family.title")}
                href="/profile/family"
                divider={false}
              />
            </AccordionCard>
          )}
          <ProfileSwitcher />
          <AccordionCard>
            <ChevronRow
              icon={<IconUser size={20} />}
              label={t("profile.section.profile")}
              href="/profile/edit"
            />
            {/* Beskeder øverst under "Profil" med grønt ulæst-tal (ejerens valg 2026-10-03). */}
            <ChevronRow
              icon={<IconMail size={20} />}
              label={t("settings.messages")}
              href="/profile/messages"
              badgeCount={unreadMessages}
            />
            <ChevronRow
              icon={<IconChartLine size={20} />}
              label={t("profile.row.status")}
              href="/profile/status"
            />
            <ChevronRow
              icon={<IconStar size={20} />}
              label={t("profile.row.points")}
              href="/profile/points"
              divider={false}
            />
          </AccordionCard>
          <AccordionCard>
            <ChevronRow
              icon={<IconBathScale size={20} />}
              label={t("profile.row.weightCalibration")}
              href="/profile/weight-calibration"
            />
            <ChevronRow
              icon={<IconWaistMeasure size={20} sex={user?.sex} />}
              label={t("profile.row.bodyMeasurements")}
              href="/profile/body-measurements"
            />
            <ChevronRow
              icon={<IconMoon size={20} />}
              label={t("profile.row.sleep")}
              href="/profile/sleep"
            />
            <ChevronRow
              icon={<IconPhotoFrame size={20} />}
              label={t("profile.row.photoDiary")}
              href="/profile/photo-diary"
              divider={false}
            />
          </AccordionCard>
          <AccordionCard>
            <ChevronRow
              icon={<IconPlateCutlery size={20} />}
              label={t("profile.row.recipes")}
              href="/profile/recipes"
            />
            <ChevronRow
              icon={<IconBook size={20} />}
              label={t("profile.row.knowledge")}
              href="/viden-om"
            />
            <ChevronRow
              icon={<IconStethoscope size={20} />}
              label={t("settings.helloDoc")}
              href="/settings/hello-doc"
              divider={false}
            />
          </AccordionCard>
        </div>
      )}
    </HfScreen>
  );
}
