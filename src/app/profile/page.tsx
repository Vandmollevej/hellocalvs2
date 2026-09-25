"use client";

import { useEffect, useState } from "react";
import {
  IconMoon,
  IconUser,
  IconCamera,
  IconStar,
  IconBook2,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { IconWaistMeasure } from "@/components/icons/WaistMeasure";
import { HfProgressStepper } from "@/components/hf/HfProgressStepper";
import { useTranslation } from "@/i18n/LocaleProvider";

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
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("profile.loading") : t("profile.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
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
            <ChevronRow icon={<IconStar size={20} />} label={t("profile.row.points")} href="/profile/points" />
            <ChevronRow
              icon={<IconBook2 size={20} />}
              label={t("profile.row.recipes")}
              href="/profile/recipes"
              divider={false}
            />
          </AccordionCard>
        </div>
      )}
    </HfScreen>
  );
}
