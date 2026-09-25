"use client";

import Link from "next/link";
import { useTranslation } from "@/i18n/LocaleProvider";

// Den ene profilcirkel øverst til højre. Bruges både af forsidens TopBar og
// af ScreenHeader, så størrelse og placering styres ét sted: .hf-avatar
// (cirklen) i en .hf-appbar__slot (44 px trykflade) i globals.css.
export function ProfileAvatarLink() {
  const { t } = useTranslation();

  return (
    <Link href="/profile" aria-label={t("settings.openProfile")} className="hf-appbar__slot">
      <span className="hf-avatar">PT</span>
    </Link>
  );
}
