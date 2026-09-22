"use client";

import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Skeleton only — reached via the "Fejl" swipe action on a daily-list entry
// (src/components/SwipeableRow.tsx). Design for this screen is not decided
// yet; content will be filled in once specified.
export default function RegistrationReportErrorPage() {
  const { t } = useTranslation();

  return (
    <HfScreen title={t("registrationReportError.title")}>
      <p className="p-4 text-center text-sm text-hf-black opacity-60">
        {t("registrationReportError.placeholder")}
      </p>
    </HfScreen>
  );
}
