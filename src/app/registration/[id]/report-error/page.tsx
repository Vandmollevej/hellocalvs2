"use client";

import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Skeleton only — reached via the "Fejl" swipe action on a daily-list entry
// (src/components/SwipeableRow.tsx). Design for this screen is not decided
// yet; content will be filled in once specified.
export default function RegistrationReportErrorPage() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <HfScreen title={t("registrationReportError.title")} onBack={() => router.back()}>
      <p className="p-4 text-center text-sm text-hf-black opacity-60">
        {t("registrationReportError.placeholder")}
      </p>
    </HfScreen>
  );
}
