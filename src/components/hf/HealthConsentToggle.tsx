"use client";

import Link from "next/link";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Udtrykkeligt samtykke til helbredsoplysninger (GDPR art. 9, docs/DECISIONS.md
// 2026-09-25/2026-09-28). Ligger direkte på tilmeldingssiden under e-mailfeltet;
// Hello Cals Toggle bruges i stedet for en native checkbox.
export function HealthConsentToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3">
      <p className="hf-type-caption flex-1">
        {t("signup.healthConsent")}{" "}
        <Link href="/betingelser" target="_blank" className="underline">
          {t("signup.healthConsentTermsLink")}
        </Link>
        .
      </p>
      <span className="pt-0.5">
        <Toggle checked={checked} onChange={onChange} ariaLabel={t("signup.healthConsent")} />
      </span>
    </div>
  );
}
