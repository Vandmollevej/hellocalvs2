"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("resetPassword.mismatchError"));
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("resetPassword.genericError"));
        setSubmitting(false);
        return;
      }
      router.push("/");
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
        <div className="flex flex-1 flex-col gap-4 px-4 pt-6">
          <p className="hf-type-caption text-hf-red-dark">{t("resetPassword.missingToken")}</p>
          <Link href="/forgot-password" className="hf-type-body underline">
            {t("resetPassword.requestNewLink")}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-6">
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
            disabled={submitting || !password || !confirmPassword}
            className="hf-btn-primary hf-type-button mb-8 h-12 w-full disabled:opacity-50"
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
