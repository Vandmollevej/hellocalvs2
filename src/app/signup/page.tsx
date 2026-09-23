"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { REFERRAL_STORAGE_KEY } from "@/components/account/AuthScreen";
import { EmailLinkForm } from "@/components/account/EmailLinkForm";
import { useTranslation } from "@/i18n/LocaleProvider";

// Tilmelding trin 1: e-mail → engangslink (docs/PRIVACY.md). Navn,
// adgangskode m.m. spørges der ikke om — navnet ligger senere i boksen.
function TilmeldContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref");

  // Invitationskoden huskes lokalt, fordi bekræftelseslinket fra mailen
  // åbner en ny side.
  useEffect(() => {
    if (!referralCode) return;
    try {
      localStorage.setItem(REFERRAL_STORAGE_KEY, referralCode);
    } catch {
      // Lagring er ikke tilgængelig; invitationen går tabt, men tilmelding virker.
    }
  }, [referralCode]);

  return (
    <EmailLinkForm
      purpose="signup"
      title={t("account.signupTitle")}
      intro={t("account.signupIntro")}
      note={t("account.signupEmailNote")}
      backHref="/welcome"
    />
  );
}

export default function TilmeldPage() {
  return (
    <Suspense fallback={null}>
      <TilmeldContent />
    </Suspense>
  );
}
