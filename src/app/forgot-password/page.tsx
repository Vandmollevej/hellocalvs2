"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HfChevron } from "@/components/hf/HfChevron";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

type Method = "email" | "sms";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [method, setMethod] = useState<Method>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchMethod(next: Method) {
    setMethod(next);
    setSent(false);
    setCode("");
    setError(null);
  }

  async function post(url: string, body: Record<string, string>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { response, data: await response.json() };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = method === "sms" ? "/api/auth/forgot-password/sms" : "/api/auth/forgot-password";
      const { response, data } = await post(url, { email });
      if (!response.ok) {
        setError(data.message ?? t("forgotPassword.genericError"));
      } else {
        setSent(true);
      }
    } catch {
      setError(t("forgotPassword.networkError"));
    }
    setSubmitting(false);
  }

  // Korrekt SMS-kode giver et almindeligt reset-token → samme side som mail-linket.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { response, data } = await post("/api/auth/forgot-password/sms/verify", { email, code });
      if (!response.ok || typeof data.token !== "string") {
        setError(data.message ?? t("forgotPassword.genericError"));
        setSubmitting(false);
        return;
      }
      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    } catch {
      setError(t("forgotPassword.networkError"));
      setSubmitting(false);
    }
  }

  const switchLink = (
    <button
      type="button"
      onClick={() => switchMethod(method === "email" ? "sms" : "email")}
      className="hf-type-body self-center underline"
    >
      {method === "email" ? t("forgotPassword.useSms") : t("forgotPassword.useEmail")}
    </button>
  );

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

      {sent && method === "email" ? (
        <div className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-body">{t("forgotPassword.sentMessage")}</p>
          <Link href="/login" className="hf-control hf-btn-primary mt-2 flex w-full items-center justify-center">
            {t("forgotPassword.backToLogin")}
          </Link>
        </div>
      ) : sent && method === "sms" ? (
        <form onSubmit={handleVerify} className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-body">{t("forgotPassword.smsSentMessage")}</p>

          <TextField
            label={t("forgotPassword.codeLabel")}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />

          {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

          <button type="button" onClick={() => switchMethod("sms")} className="hf-type-body self-center underline">
            {t("forgotPassword.resendCode")}
          </button>

          <div className="flex-1" />

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="hf-control hf-btn-primary mb-8 w-full disabled:opacity-50"
          >
            {submitting ? t("forgotPassword.verifying") : t("forgotPassword.verifySubmit")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-8">
          <p className="hf-type-body">
            {method === "sms" ? t("forgotPassword.smsInstructions") : t("forgotPassword.instructions")}
          </p>

          <TextField
            label={t("forgotPassword.emailLabel")}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("login.emailPlaceholder")}
          />

          {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

          {switchLink}

          <div className="flex-1" />

          <button
            type="submit"
            disabled={submitting || !email}
            className="hf-control hf-btn-primary mb-8 w-full disabled:opacity-50"
          >
            {submitting
              ? t("forgotPassword.submitting")
              : method === "sms"
                ? t("forgotPassword.smsSubmit")
                : t("forgotPassword.submit")}
          </button>
        </form>
      )}
    </div>
  );
}
