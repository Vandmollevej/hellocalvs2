"use client";

import Link from "next/link";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { MIGRATION_SOURCES } from "@/lib/migration-sources";

// Import (docs/DECISIONS.md 2026-10-15): forsiden til at flytte data fra en
// anden app. Brugeren vælger appen her; siden pr. app (/settings/import/[provider])
// står for optagelsen. Andre apps: kontaktformularen med emnet udfyldt.
export default function ImportPage() {
  const { t } = useTranslation();
  const contactHref = `/settings/support/contact?category=DATA&subject=${encodeURIComponent(t("migrationImport.contactSubject"))}`;

  return (
    <HfScreen
      title={t("migrationImport.landingTitle")}
      footer={
        <div className="flex flex-col gap-2">
          {MIGRATION_SOURCES.map((source) => (
            <Link key={source.slug} href={`/settings/import/${source.slug}`} className="hf-control hf-btn-primary w-full">
              {source.label}
            </Link>
          ))}
        </div>
      }
    >
      <div className="hf-page">
        <p className="hf-type-body text-hf-black">{t("migrationImport.landingIntro")}</p>
        <p className="hf-type-body text-text-secondary">{t("migrationImport.otherProvider")}</p>
        <Link href={contactHref} className="hf-btn-text self-start">
          {t("migrationImport.contactUs")}
        </Link>
      </div>
    </HfScreen>
  );
}
