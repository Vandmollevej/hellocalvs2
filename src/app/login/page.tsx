"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfChevron } from "@/components/hf/HfChevron";
import { SocialLoginButton } from "@/components/hf/SocialLoginButton";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

function LogIndContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("login.genericError"));
        setSubmitting(false);
        return;
      }
      router.push(next);
    } catch {
      setError(t("login.networkError"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="flex items-center justify-between bg-hf-green px-4 pb-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <Link href="/welcome" className="hf-type-body text-hf-white">
          {t("login.cancel")}
        </Link>
        <p className="hf-type-nav-title">
          {t("welcome.signUp")} <span className="opacity-80">/</span> {t("welcome.logIn")}
        </p>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <form id="login-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 pt-5">
        <p className="hf-type-body-sm">{t("login.chooseCountry")}</p>
        <div className="mt-2 h-px bg-hf-gray-border" />
        <Link
          href="/login/country"
          className="flex h-12 items-center justify-between border-b border-hf-gray-border"
        >
          <div className="hf-type-body flex items-center gap-3">
            <Image src="/flag-denmark.png" alt="" width={22} height={16} className="rounded-[2px]" />
            <span>{t("login.country")}</span>
          </div>
          <HfChevron className="text-hf-gray" />
        </Link>

        <div className="mt-6 flex flex-col gap-3">
          <SocialLoginButton provider="google" label={t("login.continueWithGoogle")} />
          <SocialLoginButton provider="apple" label={t("login.continueWithApple")} />
          <SocialLoginButton provider="facebook" label={t("login.continueWithFacebook")} />
        </div>

        <p className="hf-type-body-sm mt-4 text-center opacity-70">{t("common.or")}</p>

        <div className="mt-2 flex flex-col gap-3">
          <TextField
            type="email"
            placeholder={t("login.emailPlaceholder")}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            type="password"
            placeholder={t("login.passwordPlaceholder")}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="hf-type-caption mt-2 text-hf-red-dark">{error}</p>}

        <p className="hf-type-body-sm mt-4 text-center">
          {t("login.newHere")} <Link href="/signup" className="underline">{t("login.createAccount")}</Link>
        </p>
      </form>

      <div className="px-4 pb-8 pt-4">
        <button
          type="submit"
          form="login-form"
          disabled={submitting || !email || !password}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {submitting ? t("login.submitting") : t("login.continueButton")}
        </button>
      </div>
    </div>
  );
}

export default function LogIndPage() {
  return (
    <Suspense fallback={null}>
      <LogIndContent />
    </Suspense>
  );
}
