"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { HfChevron } from "@/components/hf/HfChevron";
import { TextField } from "@/components/hf/TextField";
import { SocialLoginButton } from "@/components/hf/SocialLoginButton";
import { HealthConsentToggle } from "@/components/hf/HealthConsentToggle";
import { useTranslation } from "@/i18n/LocaleProvider";
import { afterLoginPath, startOAuth } from "@/lib/login-flow";

function TilmeldContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") ?? undefined;
  // Fx forsidens betalings-ark: efter oprettelse direkte til abonnementssiden.
  const next = searchParams.get("next") ?? "/";
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [healthDataConsent, setHealthDataConsent] = useState(false);
  const [phone, setPhone] = useState("");
  // Trin 2: 6-cifret SMS-kode (docs/DECISIONS.md 2026-10-02).
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function sendCode(): Promise<boolean> {
    const response = await fetch("/api/auth/sms/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.message ?? t("signup.genericError"));
      return false;
    }
    setVerificationId(data.verificationId);
    setNormalizedPhone(data.phone);
    setSmsCode("");
    return true;
  }

  async function handleResend() {
    setError(null);
    setSubmitting(true);
    try {
      await sendCode();
    } catch {
      setError(t("sms.networkError"));
    }
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!healthDataConsent) {
      setError(t("signup.consentRequired"));
      return;
    }
    setSubmitting(true);

    try {
      if (!verificationId) {
        await sendCode();
        setSubmitting(false);
        return;
      }
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          password,
          referralCode,
          healthDataConsent,
          phone: normalizedPhone,
          verificationId,
          smsCode,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("signup.genericError"));
        setSubmitting(false);
        return;
      }
      router.push(afterLoginPath(next));
    } catch {
      setError(t("signup.networkError"));
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
          <Link href="/welcome" aria-label={t("signup.back")} className="flex h-full w-full items-center justify-center text-hf-white">
            <HfChevron direction="left" />
          </Link>
        </div>
        <h1 className="hf-type-nav-title hf-appbar__title">{t("signup.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-8">
        {verificationId ? (
          <>
            <p className="hf-type-body">{t("sms.codeSent", { phone: normalizedPhone })}</p>
            <TextField
              label={t("sms.codeLabel")}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
              placeholder={t("sms.codePlaceholder")}
            />
            <p className="hf-type-body flex justify-between">
              <button type="button" disabled={submitting} onClick={handleResend} className="underline">
                {t("sms.resend")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setVerificationId(null);
                  setSmsCode("");
                  setError(null);
                }}
                className="underline"
              >
                {t("sms.changeNumber")}
              </button>
            </p>
          </>
        ) : (
        <>
        <div className="flex flex-col gap-4">
          <SocialLoginButton provider="google" label={t("login.continueWithGoogle")} onClick={() => startOAuth("google", next)} />
          <SocialLoginButton provider="apple" label={t("login.continueWithApple")} onClick={() => startOAuth("apple", next)} />
          <SocialLoginButton
            provider="facebook"
            label={t("login.continueWithFacebook")}
            onClick={() => startOAuth("facebook", next)}
          />
        </div>
        <p className="text-text-secondary hf-type-body text-center">{t("common.or")}</p>

        <TextField
          label={t("signup.nameLabel")}
          type="text"
          required
          value={displayName}
          className="userback-ignore"
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("signup.namePlaceholder")}
        />

        <TextField
          label={t("signup.emailLabel")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          label={t("sms.phoneLabel")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t("sms.phonePlaceholder")}
        />
        <p className="hf-type-caption text-text-secondary -mt-2">{t("sms.phoneHint")}</p>

        <TextField
          label={t("signup.passwordLabel")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("signup.passwordPlaceholder")}
        />

        <p className="hf-type-body text-right">
          <Link href="/forgot-password" className="underline">
            {t("login.forgotPassword")}
          </Link>
        </p>

        <HealthConsentToggle checked={healthDataConsent} onChange={setHealthDataConsent} />
        </>
        )}

        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

        <div className="flex-1" />

        <button
          type="submit"
          disabled={submitting}
          className="hf-control hf-btn-primary w-full disabled:opacity-50"
        >
          {verificationId
            ? submitting
              ? t("sms.signupConfirming")
              : t("sms.signupConfirm")
            : submitting
              ? t("sms.sendingCode")
              : t("sms.sendCode")}
        </button>
        <p className="hf-type-body-lg mb-6 mt-1 text-center">
          {t("signup.haveAccount")}{" "}
          <Link href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="underline">{t("signup.logIn")}</Link>
        </p>
      </form>
    </div>
  );
}

export default function TilmeldPage() {
  return (
    <Suspense fallback={null}>
      <TilmeldContent />
    </Suspense>
  );
}
