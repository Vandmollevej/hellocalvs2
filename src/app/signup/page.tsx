"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { IconArrowLeft } from "@tabler/icons-react";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

function TilmeldContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralCode = searchParams.get("ref") ?? undefined;
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password, referralCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? t("signup.genericError"));
        setSubmitting(false);
        return;
      }
      router.push("/");
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
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">{t("signup.title")}</h1>
        <div className="hf-appbar__slot">
          <Link href="/welcome" aria-label={t("signup.back")} className="text-hf-white">
            <IconArrowLeft size={24} />
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-6">
        <TextField
          label={t("signup.nameLabel")}
          type="text"
          required
          value={displayName}
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
          label={t("signup.passwordLabel")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("signup.passwordPlaceholder")}
        />

        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

        <div className="flex-1" />

        <button
          type="submit"
          disabled={submitting}
          className="hf-btn-primary hf-type-button mb-8 h-12 w-full disabled:opacity-50"
        >
          {submitting ? t("signup.submitting") : t("signup.submit")}
        </button>
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
