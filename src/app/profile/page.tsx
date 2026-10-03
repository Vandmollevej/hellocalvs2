"use client";

import { useEffect, useState } from "react";
import {
  IconMoon,
  IconUser,
  IconCamera,
  IconStar,
  IconBook,
  IconChartLine,
  IconUsers,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { IconPlateCutlery } from "@/components/icons/PlateCutlery";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { IconWaistMeasure } from "@/components/icons/WaistMeasure";
import { HfProgressStepper } from "@/components/hf/HfProgressStepper";
import { useTranslation } from "@/i18n/LocaleProvider";
import { ProfileSwitcher } from "@/components/family/ProfileSwitcher";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { SkeletonCards, SkeletonList, SkeletonScreen } from "@/components/hf/Skeleton";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
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

    return () => {
      cancelled = true;
    };
  }, []);

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
          {/* Statisk indtil guided profilopsætning beregner det dynamisk. */}
          <HfProgressStepper
            steps={[
              t("profile.completion.aboutYou"),
              t("profile.completion.goals"),
              t("profile.completion.habits"),
            ]}
            current={0}
            progress={0.2}
            label={t("profile.completion.label")}
          />
          <AccordionCard>
            <ChevronRow
              icon={<IconUser size={20} />}
              label={t("profile.section.profile")}
              href="/profile/edit"
            />
            <ChevronRow icon={<IconStar size={20} />} label={t("profile.row.points")} href="/profile/points" />
            <ChevronRow
              icon={<IconChartLine size={20} />}
              label={t("profile.row.status")}
              href="/profile/status"
            />
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
              icon={<IconCamera size={20} />}
              label={t("profile.row.photoDiary")}
              href="/profile/photo-diary"
            />
            <ChevronRow
              icon={<IconPlateCutlery size={20} />}
              label={t("profile.row.recipes")}
              href="/profile/recipes"
            />
            <ChevronRow
              icon={<IconBook size={20} />}
              label={t("profile.row.knowledge")}
              href="/viden-om"
              divider={false}
            />
          </AccordionCard>
        </div>
      )}
    </HfScreen>
  );
}
