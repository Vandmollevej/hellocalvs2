"use client";

import Link from "next/link";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Udtrykkeligt samtykke til helbredsoplysninger (GDPR art. 9, docs/DECISIONS.md
// 2026-09-25). Bruges ved e-mail-tilmelding og på /samtykke.
export function HealthConsentToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-hf-tan px-4 py-4">
      <span className="flex-1">
        <span className="hf-type-body block">{t("signup.healthConsent")}</span>
        <span className="hf-type-caption mt-2 flex gap-3 border-t border-hf-tan-dark pt-2">
          <Link href="/betingelser" target="_blank" className="underline">
            {t("signup.legalLinksTerms")}
          </Link>
          <Link href="/privatlivspolitik" target="_blank" className="underline">
            {t("signup.legalLinksPrivacy")}
          </Link>
        </span>
      </span>
      <span className="pt-0.5">
        <Toggle checked={checked} onChange={onChange} ariaLabel={t("signup.healthConsent")} />
      </span>
    </div>
  );
}
