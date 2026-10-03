"use client";

import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Lås"-siden bag den låste højde på Profil (docs/DECISIONS.md 2026-10-03).
// Højden ændres ikke i hånden; en integration, der måler højde, opdaterer den.
export default function HeightLockPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <HfScreen title={t("profile.height.lockTitle")} onBack={() => router.back()}>
      <div className="hf-page">
        <p className="hf-type-body text-hf-black">{t("profile.height.lockBody")}</p>
        <button
          type="button"
          onClick={() => router.push("/settings/integrations")}
          className="hf-control hf-btn-primary w-full px-4"
        >
          {t("profile.height.goToIntegrations")}
        </button>
      </div>
    </HfScreen>
  );
}
