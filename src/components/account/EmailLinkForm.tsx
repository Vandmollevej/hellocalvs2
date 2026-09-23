"use client";

import { useState } from "react";
import { AuthError, AuthScreen } from "@/components/account/AuthScreen";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

// Beder om en e-mail og sender et engangslink (tilmelding eller
// gendannelse). Adressen gemmes ikke (docs/PRIVACY.md).
export function EmailLinkForm({
  purpose,
  title,
  intro,
  note,
  backHref,
  children,
}: {
  purpose: "signup" | "recovery";
  title: string;
  intro: string;
  note?: string;
  backHref: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/email-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? t("account.networkError"));
        return;
      }
      setSent(true);
    } catch {
      setError(t("account.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthScreen title={t("account.checkMailTitle")} backHref={backHref} backLabel={t("account.back")}>
        <p className="hf-type-body">{t("account.checkMailBody")}</p>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title={title}
      backHref={backHref}
      backLabel={t("account.back")}
      actions={
        <button
          type="submit"
          form="email-link-form"
          disabled={submitting || !email}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {submitting ? t("account.sending") : t("account.sendLink")}
        </button>
      }
    >
      {children}
      <p className="hf-type-body">{intro}</p>
      <form id="email-link-form" onSubmit={handleSubmit}>
        <TextField
          label={t("account.emailLabel")}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </form>
      {note && <p className="hf-type-body-sm text-hf-gray-dark">{note}</p>}
      <AuthError message={error} />
    </AuthScreen>
  );
}
