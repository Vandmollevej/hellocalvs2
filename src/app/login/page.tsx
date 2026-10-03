"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfChevron } from "@/components/hf/HfChevron";
import { SocialLoginButton } from "@/components/hf/SocialLoginButton";
import { TextField } from "@/components/hf/TextField";
import { FaceIdAnimation, type FaceIdPhase } from "@/components/FaceIdAnimation";
import { useTranslation } from "@/i18n/LocaleProvider";
import { hasPasskeyOnDevice, loginWithPasskey } from "@/lib/passkey-client";
import { afterLoginPath, oauthErrorKey, startOAuth } from "@/lib/login-flow";
import { findLoginCountry, readLoginCountry, type LoginCountry } from "@/lib/login-country";

function LogIndContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // En afbrudt Apple/Google/Facebook-dialog er brugerens eget valg og vises ikke som fejl.
  const oauthCode = searchParams.get("error");
  const oauthError = oauthCode === "oauth-cancelled" ? null : oauthErrorKey(oauthCode);
  const [error, setError] = useState<string | null>(
    oauthError ? t(oauthError.key, oauthError.vars) : null
  );
  const [submitting, setSubmitting] = useState(false);
  const [approval, setApproval] = useState<{ approvalId: string; secret: string } | null>(null);
  // Face ID kun, når det er slået til på denne enhed efter et almindeligt login.
  const [faceIdOnDevice, setFaceIdOnDevice] = useState(false);
  const [country, setCountry] = useState<LoginCountry>(() => findLoginCountry(null));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage findes kun i browseren
    setFaceIdOnDevice(hasPasskeyOnDevice());
    setCountry(readLoginCountry());
  }, []);

  const [faceIdPhase, setFaceIdPhase] = useState<FaceIdPhase | null>(null);

  async function handleFaceId() {
    setError(null);
    setSubmitting(true);
    setFaceIdPhase("scanning");
    try {
      await loginWithPasskey();
      setFaceIdPhase("success"); // navigerer, når animationen er færdig
    } catch {
      setFaceIdPhase("failed");
      window.setTimeout(() => {
        setFaceIdPhase(null);
        setError(t("login.faceIdError"));
        setSubmitting(false);
      }, 600);
    }
  }

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
      if (data.approvalRequired) {
        // Login skal godkendes via push på en anden enhed (docs/DECISIONS.md 2026-10-03).
        setApproval({ approvalId: data.approvalId, secret: data.secret });
        return;
      }
      if (!response.ok) {
        setError(data.message ?? t("login.genericError"));
        setSubmitting(false);
        return;
      }
      router.push(afterLoginPath(next));
    } catch {
      setError(t("login.networkError"));
      setSubmitting(false);
    }
  }

  // Spørger hvert andet sekund, om login er godkendt på den anden enhed.
  useEffect(() => {
    if (!approval) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/auth/login-approval/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(approval),
        });
        const data = await response.json();
        if (data.status === "approved") {
          window.clearInterval(timer);
          router.push(afterLoginPath(next));
        } else if (data.status === "denied" || data.status === "expired") {
          window.clearInterval(timer);
          setApproval(null);
          setSubmitting(false);
          setError(t(data.status === "denied" ? "loginApproval.denied" : "loginApproval.expired"));
        }
      } catch {
        // Netværksfejl: prøv igen ved næste tik.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [approval, next, router, t]);

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="flex items-center justify-between bg-hf-green px-4 pb-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 0px))" }}
      >
        <span className="w-[52px]" aria-hidden="true" />
        <p className="hf-type-nav-title">
          {t("welcome.signUp")} <span className="opacity-80">/</span> {t("welcome.logIn")}
        </p>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <form id="login-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="hf-type-body">{t("login.chooseCountry")}</p>
          <Link
            href="/login/country"
            aria-label={t(`country.countries.${country.key}`)}
            className="hf-type-body inline-flex min-h-[44px] items-center gap-2 rounded-full border border-hf-gray-border px-3"
          >
            <Image src={`/flags/${country.flag}.png`} alt="" width={22} height={16} className="rounded-[2px]" />
            <span className="font-semibold">{country.code}</span>
            <HfChevron className="text-text-muted" />
          </Link>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          {faceIdOnDevice && (
            <button
              type="button"
              onClick={handleFaceId}
              disabled={submitting}
              className="hf-control hf-btn-primary w-full disabled:opacity-40"
            >
              {t("login.continueWithFaceId")}
            </button>
          )}
          <SocialLoginButton provider="google" label={t("login.continueWithGoogle")} onClick={() => startOAuth("google", next)} />
          <SocialLoginButton provider="apple" label={t("login.continueWithApple")} onClick={() => startOAuth("apple", next)} />
          <SocialLoginButton
            provider="facebook"
            label={t("login.continueWithFacebook")}
            onClick={() => startOAuth("facebook", next)}
          />
        </div>

        <p className="text-text-secondary hf-type-body mt-4 text-center">{t("common.or")}</p>

        <div className="mt-2 flex flex-col gap-4">
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
        <p className="hf-type-body mt-2 text-right">
          <Link href="/forgot-password" className="underline">
            {t("login.forgotPassword")}
          </Link>
        </p>
        {error && <p className="hf-type-caption mt-2 text-hf-red-dark">{error}</p>}

        <p className="hf-type-body mt-4 text-center">
          <Link href="/family-code" className="underline">{t("login.haveFamilyCode")}</Link>
        </p>
      </form>

      <div className="px-4 pb-6 pt-4">
        <button
          type="submit"
          form="login-form"
          disabled={submitting || !email || !password}
          className="hf-control hf-btn-primary w-full disabled:opacity-40"
        >
          {submitting ? t("login.submitting") : t("login.continueButton")}
        </button>
        <p className="hf-type-body-lg mt-5 text-center">
          {t("login.newHere")} <Link href="/signup" className="underline">{t("login.createAccount")}</Link>
        </p>
      </div>

      {approval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hf-black/40 p-4">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-[28px] bg-hf-cream p-6 shadow-xl">
            <h2 className="hf-type-body-lg font-semibold">{t("loginApproval.waitingTitle")}</h2>
            <p className="hf-type-body">{t("loginApproval.waitingBody")}</p>
            <button
              type="button"
              onClick={() => {
                setApproval(null);
                setSubmitting(false);
              }}
              className="hf-control w-full rounded-full border border-hf-gray-border"
            >
              {t("loginApproval.waitingCancel")}
            </button>
          </div>
        </div>
      )}

      {faceIdPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-hf-black/40 p-4">
          <div className="flex h-44 w-44 items-center justify-center rounded-[28px] bg-hf-cream shadow-xl">
            <FaceIdAnimation phase={faceIdPhase} onDone={() => router.push(afterLoginPath(next))} />
          </div>
        </div>
      )}
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
