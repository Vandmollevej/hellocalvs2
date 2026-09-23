"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmailLinkForm } from "@/components/account/EmailLinkForm";
import { loadCase } from "@/components/account/recovery-case";
import { useTranslation } from "@/i18n/LocaleProvider";

// Gendannelse trin 1: e-mail → engangslink (docs/PRIVACY.md "Gendannelse").
function GendanContent() {
  const { t } = useTranslation();
  const locked = useSearchParams().get("locked") === "1";
  const [openCase, setOpenCase] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenCase(loadCase()?.caseCode ?? null);
  }, []);

  return (
    <EmailLinkForm purpose="recovery" title={t("account.recoverTitle")} intro={t("account.recoverIntro")} backHref="/login">
      {locked && (
        <div className="rounded-lg bg-hf-tan p-4">
          <p className="hf-type-body font-semibold">{t("account.lockedTitle")}</p>
          <p className="hf-type-body-sm mt-1">{t("account.lockedBody")}</p>
        </div>
      )}
      {openCase && (
        <Link href="/gendan/status" className="hf-btn-secondary hf-type-button h-12 w-full">
          {t("account.caseTitle")} · {openCase}
        </Link>
      )}
    </EmailLinkForm>
  );
}

export default function GendanPage() {
  return (
    <Suspense fallback={null}>
      <GendanContent />
    </Suspense>
  );
}
