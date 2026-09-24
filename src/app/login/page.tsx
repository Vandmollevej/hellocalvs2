"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthError, AuthScreen } from "@/components/account/AuthScreen";
import { HfChevron } from "@/components/hf/HfChevron";
import { useTranslation } from "@/i18n/LocaleProvider";
import { logIn } from "@/lib/vault/store";
import { isPasskeySupported } from "@/lib/vault/webauthn-client";

// Login med passkey (docs/PRIVACY.md "Login og e-mail"). Ingen e-mail og
// ingen adgangskode: telefonen viser selv de passkeys, den har til Hello Cal.
function LogIndContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const supported = typeof window === "undefined" || isPasskeySupported();

  async function handleLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await logIn();
      router.push(result === "ready" ? next : "/gendan?locked=1");
    } catch (e) {
      setError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : t("account.loginFailed"));
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
          type="button"
          onClick={handleLogin}
          disabled={submitting || !supported}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {submitting ? t("account.loggingIn") : t("account.loginButton")}
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

      <p className="hf-type-body mt-2">{t("account.loginIntro")}</p>
      {!supported && <AuthError message={t("account.noPasskeySupport")} />}
      <AuthError message={error} />

      <p className="hf-type-body-sm mt-4 text-center">
        {t("account.newHere")}{" "}
        <Link href="/signup" className="underline">
          {t("account.createAccount")}
        </Link>
      </p>
      <p className="hf-type-body-sm text-center">
        {t("account.lostAccess")}{" "}
        <Link href="/gendan" className="underline">
          {t("account.recoverAccess")}
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
