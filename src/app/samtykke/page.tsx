"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HealthConsentToggle } from "@/components/hf/HealthConsentToggle";
import { useTranslation } from "@/i18n/LocaleProvider";

// Samtykke til helbredsoplysninger for brugere, der ikke gav det ved
// e-mail-tilmelding (se src/components/ConsentGate.tsx, docs/DECISIONS.md
// 2026-09-25).
function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function SamtykkeContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/consent", { method: "POST" });
      if (!res.ok) throw new Error();
      router.replace(next);
    } catch {
      setError(t("consent.error"));
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/welcome");
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">{t("consent.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
        <p className="hf-type-body">{t("consent.intro")}</p>
        <HealthConsentToggle checked={consent} onChange={setConsent} />
        <p className="text-text-secondary hf-type-caption">{t("consent.declineNote")}</p>
        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

        <div className="flex-1" />

        <button
          type="button"
          onClick={submit}
          disabled={!consent || submitting}
          className="hf-btn-primary h-12 w-full disabled:opacity-50"
        >
          {submitting ? t("consent.submitting") : t("consent.submit")}
        </button>
        <button type="button" onClick={logout} className="hf-btn-text mb-8">
          {t("consent.logout")}
        </button>
      </div>
    </div>
  );
}

export default function SamtykkePage() {
  return (
    <Suspense fallback={null}>
      <SamtykkeContent />
    </Suspense>
  );
}
