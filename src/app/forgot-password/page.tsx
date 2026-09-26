"use client";

import Link from "next/link";
import { useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("forgotPassword.genericError"));
        setSubmitting(false);
        return;
      }
      setSent(true);
      setSubmitting(false);
    } catch {
      setError(t("forgotPassword.networkError"));
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
        <h1 className="hf-type-nav-title hf-appbar__title">{t("forgotPassword.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      {sent ? (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-body">{t("forgotPassword.sentMessage")}</p>
          <Link href="/login" className="hf-btn-primary mt-2 flex h-12 w-full items-center justify-center">
            {t("forgotPassword.backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-body">{t("forgotPassword.instructions")}</p>

          <TextField
            label={t("forgotPassword.emailLabel")}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.emailPlaceholder")}
          />

          {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={submitting || !email}
            className="hf-btn-primary mb-8 h-12 w-full disabled:opacity-50"
          >
            {submitting ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
          </button>
        </form>
      )}
    </div>
  );
}
