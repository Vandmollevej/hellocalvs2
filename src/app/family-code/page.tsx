"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

// Et familiemedlem, som betaleren har oprettet (fx et barn), sætter her sit
// eget login med den engangskode, betaleren har lavet (docs/FAMILY.md). Koden
// virker kun sammen med den e-mail, betaleren lavede den til. Åbnes siden fra
// QR-koden (?t=), er kode og e-mail allerede givet, og kun adgangskoden mangler.
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/family/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(qrEmail ? { token, password } : { code, email, password }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      router.replace("/");
      return;
    }
    const data = res ? await res.json().catch(() => ({})) : {};
    setError(t(`family.error.${typeof data.code === "string" ? data.code : "unknown"}`));
  }

  return (
    <form onSubmit={submit} className="hf-page hf-stack">
      {qrEmail ? (
        <p className="hf-type-body userback-ignore userback-block">{t("family.claim.introQr", { email: qrEmail })}</p>
      ) : (
        <>
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
        </>
      )}
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
      {error && (
        <p role="alert" className="hf-type-body text-hf-red-dark">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || Boolean(token && !qrEmail && !error)} className="hf-control hf-btn-primary w-full px-4">
        {t("family.claim.submit")}
      </button>
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
