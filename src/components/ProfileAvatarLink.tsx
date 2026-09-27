"use client";

import Link from "next/link";
import { useFamilyStatus } from "@/components/family/FamilyStatusProvider";
import { ProfileCircle } from "@/components/family/ProfileCircle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Den ene profilcirkel øverst til højre — bruges af både forsidens TopBar og
// ScreenHeader, så størrelse og placering kun styres ét sted: ProfileCircle
// (32 px) i en .hf-appbar__slot (44 px trykflade) i globals.css.
// `outlined` giver en 1 px ring UDEN for de 32 px (box-shadow, ikke border),
// så cirklen kan ses på lys baggrund uden at den farvede flade skrumper.
export function ProfileAvatarLink({ outlined = false }: { outlined?: boolean }) {
  const { t } = useTranslation();
  const { status } = useFamilyStatus();

  return (
    <Link href="/profile" aria-label={t("settings.openProfile")} className="hf-appbar__slot">
      <ProfileCircle
        name={status?.activeProfile.displayName ?? ""}
        className={outlined ? "hf-avatar--outlined" : ""}
      />
    </Link>
  );
}
