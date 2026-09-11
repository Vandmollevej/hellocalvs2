"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconMoon,
  IconPlugConnected,
  IconSettings,
  IconUser,
  IconCamera,
  IconStar,
  IconBug,
  IconUserPlus,
  IconBell,
} from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { AccordionCard, ChevronRow } from "@/components/hf/AccordionCard";
import { IconBathScale } from "@/components/hf/IconBathScale";
import { useTranslation } from "@/i18n/LocaleProvider";

type Sex = "FEMALE" | "MALE";

type ProfileUser = {
  displayName: string;
  email: string;
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  wantsPushNotifications: boolean;
  wantsUpdateNewsEmails: boolean;
  wantsAdviceEmails: boolean;
  wantsPartnerOffersEmails: boolean;
};

export default function ProfilePage() {
  const { t } = useTranslation();
  const router = useRouter();
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
    <HfScreen
      title={t("profile.title")}
      onBack={() => router.back()}
    >
      {loading || !user ? (
        <p className="p-6 text-center text-[14px] text-hf-black opacity-60">
          {loading ? t("profile.loading") : t("profile.loadError")}
        </p>
      ) : (
        <div className="flex flex-col gap-4 p-4">
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
              icon={<IconPlugConnected size={20} />}
              label={t("profile.row.integrations")}
              href="/settings/integrations"
            />
            <ChevronRow icon={<IconStar size={20} />} label={t("profile.row.points")} href="/profile/points" />
            <ChevronRow
              icon={<IconUserPlus size={20} />}
              label={t("profile.row.inviteFriend")}
              href="/profile/invite"
            />
            <ChevronRow
              icon={<IconBell size={20} />}
              label={t("profile.section.communication")}
              href="/profile/notifications"
            />
            <ChevronRow
              icon={<IconBug size={20} />}
              label={t("profile.row.reportBug")}
              href="/profile/report-bug"
            />

            <ChevronRow
              icon={<IconSettings size={20} />}
              label={t("profile.row.settings")}
              href="/profile/settings"
              divider={false}
            />
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
            {t("profile.logOut")}
          </button>
        </div>
      )}
    </HfScreen>
  );
}
