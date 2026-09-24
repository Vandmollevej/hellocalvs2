"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthError, AuthScreen } from "@/components/account/AuthScreen";
import { HfChevron } from "@/components/hf/HfChevron";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";
import { logInWithCode } from "@/lib/vault/store";

// Midlertidigt login med e-mail + kode (docs/DECISIONS.md 2026-09-24), indtil
// rigtig adgangskode-login er bygget.
function LogIndContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await logInWithCode(email, code);
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.genericError"));
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      title={t("account.loginTitle")}
      backHref="/welcome"
      backLabel={t("account.back")}
      actions={
        <button
          type="submit"
          form="code-login-form"
          disabled={submitting || !email || !code}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {submitting ? t("login.submitting") : t("login.continueButton")}
        </button>
      }
    >
      <p className="hf-type-body-sm">{t("login.chooseCountry")}</p>
      <Link href="/login/country" className="flex h-12 items-center justify-between border-b border-hf-gray-border">
        <div className="hf-type-body flex items-center gap-3">
          <Image src="/flag-denmark.png" alt="" width={22} height={16} className="rounded-[2px]" />
          <span>{t("login.country")}</span>
        </div>
        <HfChevron className="text-hf-gray" />
      </Link>

      <form id="code-login-form" onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3">
        <TextField
          label={t("login.emailPlaceholder")}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t("login.passwordPlaceholder")}
          type="password"
          autoComplete="current-password"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </form>
      <AuthError message={error} />

      <p className="hf-type-body-sm mt-4 text-center">
        {t("account.newHere")}{" "}
        <Link href="/signup" className="underline">
          {t("account.createAccount")}
        </Link>
      </p>
    </AuthScreen>
  );
}

export default function LogIndPage() {
  return (
    <Suspense fallback={null}>
      <LogIndContent />
    </Suspense>
  );
}
