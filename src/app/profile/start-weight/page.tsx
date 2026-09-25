"use client";

import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// "Lås"-siden bag den låste start-vægt på Profil (docs/DECISIONS.md
// 2026-09-25). Start-vægten kan ikke ændres; brugeren henvises til dagsvægt.
export default function StartWeightLockPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <HfScreen title={t("profile.startWeight.lockTitle")} onBack={() => router.back()}>
      <div className="hf-page">
        <p className="text-[15px] leading-6 text-hf-black">{t("profile.startWeight.lockBody")}</p>
        <button
          type="button"
          onClick={() => router.push("/profile/weight-calibration")}
          className="hf-btn-primary hf-type-button h-12 w-full px-4"
        >
          {t("profile.startWeight.setDailyWeight")}
        </button>
      </div>
    </HfScreen>
  );
}
