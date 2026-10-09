"use client";

import { useState } from "react";
import { IconMail } from "@tabler/icons-react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";

const DISMISS_KEY = "hc_verify_email_banner_dismissed";

// Blød e-mailbekræftelse (docs/DECISIONS.md 2026-09-25): vises af AuthGate,
// så længe den indloggede brugers e-mail ikke er bekræftet. Siden 2026-09-27
// i bundarket (KRAV.md "Bundark") i stedet for bjælken øverst. Et træk ned
// lukker det for resten af browsersessionen.
export function EmailVerifySheet() {
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
      // ignoreres — arket lukkes stadig for denne visning
    }
    setDismissed(true);
  }

  return (
    <BottomSheet
      title={t("verifyEmail.sheetTitle")}
      onClose={dismiss}
      footer={
        <>
          {status !== "sent" && (
            <button
              type="button"
              onClick={resend}
              disabled={status === "sending"}
              className="hf-control hf-btn-primary w-full"
            >
              {t("verifyEmail.resend")}
            </button>
          )}
          <p className="hf-type-small pt-3 text-center text-text-secondary">{t("verifyEmail.linkValidity")}</p>
        </>
      }
    >
      <div role="status" className="flex flex-col items-center gap-4 px-4 text-center">
        <span className="flex size-20 items-center justify-center rounded-full bg-hf-tan text-hf-green">
          <IconMail size={40} stroke={1.6} />
        </span>
        <p className="hf-type-body-lg">
          {status === "sent" ? t("verifyEmail.bannerSent") : status === "error" ? t("verifyEmail.bannerError") : t("verifyEmail.sheetText")}
        </p>
      </div>
    </BottomSheet>
  );
}
