"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";

// Et familiemedlem, som betaleren har oprettet (fx et barn), sætter her sit
// eget login med den engangskode, betaleren har lavet (docs/FAMILY.md).
export default function FamilyCodePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/family/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, email, password }),
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
    <HfScreen title={t("family.claim.title")}>
      <form onSubmit={submit} className="hf-page hf-stack">
        <p className="hf-type-body-sm">{t("family.claim.intro")}</p>
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
          <p role="alert" className="hf-type-body-sm text-hf-red-dark">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="hf-btn-primary hf-type-button h-12 w-full px-4">
          {t("family.claim.submit")}
        </button>
      </form>
    </HfScreen>
  );
}
