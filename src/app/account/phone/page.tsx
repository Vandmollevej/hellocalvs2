"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";
import { validatePhone } from "@/lib/phone";

// Obligatorisk telefonnummer (docs/DECISIONS.md 2026-10-02): AuthGate sender
// indloggede brugere uden nummer hertil — typisk konti oprettet med
// Google/Apple/Facebook eller før nummeret blev et krav. Ingen tilbagepil og
// ingen "spring over": nummeret skal bruges til tofaktor-godkendelse.
function PhoneRequiredContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const rawNext = useSearchParams().get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const [ready, setReady] = useState(false);
  const [region, setRegion] = useState("DK");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Kun for indloggede; har kontoen allerede et nummer, er der intet at gøre her.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) {
          router.replace("/welcome");
          return;
        }
        const data = (await res.json()) as { user: { hasPhone: boolean } };
        if (cancelled) return;
        if (data.user.hasPhone) {
          router.replace(next);
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: { region?: string } } | null) => {
        if (!cancelled && data?.user?.region) setRegion(data.user.region);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = validatePhone(phone, region);
    if (!parsed.ok) {
      setError(t(parsed.reason === "empty" ? "phoneRequired.empty" : "phoneRequired.invalid"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: parsed.e164 }),
      });
      if (!response.ok) {
        setError(t(response.status === 400 ? "phoneRequired.invalid" : "phoneRequired.networkError"));
        setSubmitting(false);
        return;
      }
      router.replace(next);
    } catch {
      setError(t("phoneRequired.networkError"));
      setSubmitting(false);
    }
  }

  if (!ready) return null;

  return (
    <div className="flex h-full min-h-full flex-col bg-hf-cream">
      <div
        className="hf-appbar hf-appbar--brand hf-safe-top"
      >
        <span className="hf-appbar__slot" aria-hidden="true" />
        <h1 className="hf-type-nav-title hf-appbar__title">{t("phoneRequired.title")}</h1>
        <span className="hf-appbar__slot" aria-hidden="true" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-8">
        <p className="hf-type-body">{t("phoneRequired.intro")}</p>

        <TextField
          label={t("phoneRequired.label")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          autoFocus
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setError(null);
          }}
          placeholder={t("phoneRequired.placeholder")}
        />

        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}

        <div className="flex-1" />

        <button
          type="submit"
          disabled={submitting}
          className="hf-control hf-btn-primary mb-6 w-full"
        >
          {submitting ? t("phoneRequired.submitting") : t("phoneRequired.submit")}
        </button>
      </form>
    </div>
  );
}

export default function PhoneRequiredPage() {
  return (
    <Suspense fallback={null}>
      <PhoneRequiredContent />
    </Suspense>
  );
}
