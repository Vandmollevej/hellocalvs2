"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/i18n/LocaleProvider";

type State = "checking" | "ok" | "invalid";

function VerifyEmailContent() {
  const { t } = useTranslation();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<State>(token ? "checking" : "invalid");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (!cancelled) setState(res.ok ? "ok" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">{t("verifyEmail.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
        {state === "checking" && <p className="hf-type-body">{t("verifyEmail.checking")}</p>}
        {state === "ok" && <p className="hf-type-body">{t("verifyEmail.success")}</p>}
        {state === "invalid" && <p className="hf-type-caption text-hf-red-dark">{t("verifyEmail.invalid")}</p>}

        <div className="flex-1" />

        {state !== "checking" && (
          <Link href="/" className="hf-btn-primary mb-8 flex h-12 w-full items-center justify-center">
            {t("verifyEmail.continue")}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
