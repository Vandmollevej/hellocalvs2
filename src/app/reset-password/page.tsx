"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfChevron } from "@/components/hf/HfChevron";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

function ResetPasswordContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // SMS-kode som ekstra sikring, hvis kontoen har et bekræftet mobilnummer
  // (docs/DECISIONS.md 2026-10-02).
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [smsCode, setSmsCode] = useState("");

  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/reset-password/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "status" }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.requiresSms) setMaskedPhone(data.phone);
      })
      .catch(() => undefined);
  }, [token]);

  async function sendCode() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "send" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("resetPassword.genericError"));
      } else {
        setVerificationId(data.verificationId);
        setSmsCode("");
      }
    } catch {
      setError(t("sms.networkError"));
    }
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t("resetPassword.tooShortError"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("resetPassword.mismatchError"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, verificationId, smsCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("resetPassword.genericError"));
        setSubmitting(false);
        return;
      }
      // En admin skal videre til admin-login (2FA), ikke til appens forside.
      if (data.isAdmin) {
        window.location.assign("/admin/login");
      } else {
        router.push("/");
      }
    } catch {
      setError(t("resetPassword.networkError"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <div className="hf-appbar__slot">
          <Link href="/login" aria-label={t("forgotPassword.back")} className="flex h-full w-full items-center justify-center text-hf-white">
            <HfChevron direction="left" />
          </Link>
        </div>
        <h1 className="hf-type-nav-title hf-appbar__title">{t("resetPassword.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      {!token ? (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-caption text-hf-red-dark">{t("resetPassword.missingToken")}</p>
          <Link href="/forgot-password" className="hf-type-body underline">
            {t("resetPassword.requestNewLink")}
          </Link>
        </div>
      ) : maskedPhone && !verificationId ? (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-body">{t("sms.resetRequired", { phone: maskedPhone })}</p>
          {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
          <div className="flex-1" />
          <button
            type="button"
            disabled={submitting}
            onClick={sendCode}
            className="hf-control hf-btn-primary mb-8 w-full disabled:opacity-50"
          >
            {submitting ? t("sms.sendingCode") : t("sms.sendCode")}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col gap-4 px-4 pt-8">
          {verificationId && (
            <>
              <p className="hf-type-body">{t("sms.codeSent", { phone: maskedPhone ?? "" })}</p>
              <TextField
                label={t("sms.codeLabel")}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={smsCode}
                onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t("sms.codePlaceholder")}
              />
              <button type="button" disabled={submitting} onClick={sendCode} className="hf-type-body self-start underline">
                {t("sms.resend")}
              </button>
            </>
          )}
          <TextField
            label={t("resetPassword.newPasswordLabel")}
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("signup.passwordPlaceholder")}
          />
          <TextField
            label={t("resetPassword.confirmPasswordLabel")}
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={submitting}
            className="hf-control hf-btn-primary mb-8 w-full disabled:opacity-50"
          >
            {submitting ? t("resetPassword.submitting") : t("resetPassword.submit")}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
