"use client";

import { useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";

const DISMISS_KEY = "hc_verify_email_banner_dismissed";

// Blød e-mailbekræftelse (docs/DECISIONS.md 2026-09-25): vises af AuthGate,
// så længe den indloggede brugers e-mail ikke er bekræftet. Kan lukkes for
// resten af browsersessionen.
export function EmailVerifyBanner() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (dismissed) return null;

  async function resend() {
    setStatus("sending");
    try {
      const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignoreres — banneret lukkes stadig for denne visning
    }
    setDismissed(true);
  }

  return (
    <div
      role="status"
      className="hf-type-caption fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 px-4 py-1 text-center"
      style={{
        paddingTop: "max(4px, env(safe-area-inset-top))",
        background: "var(--hf-color-brand)",
        color: "var(--hf-color-white)",
      }}
    >
      <span>
        {status === "sent" ? t("verifyEmail.bannerSent") : status === "error" ? t("verifyEmail.bannerError") : t("verifyEmail.banner")}
      </span>
      {status !== "sent" && (
        <button type="button" onClick={resend} disabled={status === "sending"} className="hf-btn-text disabled:opacity-60">
          {t("verifyEmail.resend")}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label={t("verifyEmail.dismiss")} className="hf-type-strong px-1">
        ×
      </button>
    </div>
  );
}
