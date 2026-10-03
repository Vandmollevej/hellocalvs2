"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

// Opret dig som medlem af en familiekonto (docs/FAMILY.md, DECISIONS.md
// 2026-10-03). Trin 1: invitationskode + e-mail (eller en scannet QR-kode,
// der giver ?t=). Koden virker kun sammen med den e-mail, betaleren lavede den
// til. Er koden til en profil, betaleren har oprettet (fx et barn), vælger man
// her sin adgangskode; er den til en eksisterende konto, fortsætter man på
// tilknytningssiden.
function FamilyCodeContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const token = useSearchParams()?.get("t") ?? "";
  const [qrEmail, setQrEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function showError(data: Record<string, unknown>) {
    setError(t(`family.error.${typeof data.code === "string" ? data.code : "unknown"}`));
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch(`/api/family/invite?t=${encodeURIComponent(token)}`).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (cancelled) return;
      if (!res?.ok) {
        setError(t(`family.error.${typeof data.code === "string" ? data.code : "unknown"}`));
        return;
      }
      // En invitation til en eksisterende konto hører til tilknytningssiden.
      if (data.kind === "join") {
        router.replace(`/family-code/join?t=${encodeURIComponent(token)}`);
        return;
      }
      setQrEmail(String(data.email));
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router, t]);

  async function continueWithCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/family/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || typeof data.token !== "string") {
      showError(data);
      return;
    }
    const next = data.kind === "join" ? "/family-code/join" : "/family-code";
    router.push(`${next}?t=${encodeURIComponent(data.token)}`);
  }

  async function createLogin(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/family/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.replace("/");
      return;
    }
    showError(res ? await res.json().catch(() => ({})) : {});
  }

  const errorText = error && (
    <p role="alert" className="hf-type-body text-hf-red-dark">
      {error}
    </p>
  );

  // Trin 2: profil oprettet af betaleren — vælg adgangskode.
  if (token) {
    return (
      <form onSubmit={createLogin} className="hf-page hf-stack">
        {qrEmail && (
          <>
            <p className="hf-type-body userback-ignore userback-block">{t("family.claim.introQr", { email: qrEmail })}</p>
            <TextField
              variant="standard"
              type="password"
              label={t("family.claim.password")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </>
        )}
        {errorText}
        {qrEmail ? (
          <button type="submit" disabled={busy} className="hf-control hf-btn-primary w-full px-4">
            {t("family.claim.submit")}
          </button>
        ) : (
          error && (
            <Link href="/family-code" className="hf-control hf-btn-secondary w-full px-4">
              {t("family.claim.tryAgain")}
            </Link>
          )
        )}
      </form>
    );
  }

  // Trin 1: invitationskode + e-mail, eller scan QR-koden.
  return (
    <form onSubmit={continueWithCode} className="hf-page hf-stack">
      <p className="hf-type-body">{t("family.claim.intro")}</p>
      <TextField
        variant="standard"
        label={t("family.claim.code")}
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="XXXX-XXXX"
        autoCapitalize="characters"
        required
      />
      <TextField
        variant="standard"
        type="email"
        label={t("family.claim.email")}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        required
      />
      {errorText}
      <button
        type="submit"
        disabled={busy || code.trim().length < 8 || !email.includes("@")}
        className="hf-control hf-btn-primary w-full px-4"
      >
        {t("family.claim.continue")}
      </button>
      <Link href="/family-code/scan" className="hf-control hf-btn-secondary w-full px-4">
        {t("family.claim.scan")}
      </Link>
    </form>
  );
}

export default function FamilyCodePage() {
  const { t } = useTranslation();
  return (
    <HfScreen title={t("family.claim.title")}>
      <Suspense fallback={null}>
        <FamilyCodeContent />
      </Suspense>
    </HfScreen>
  );
}
