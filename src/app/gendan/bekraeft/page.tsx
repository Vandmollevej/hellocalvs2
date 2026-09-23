"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthError, AuthScreen, readHashToken } from "@/components/account/AuthScreen";
import { RecoveryFileStep } from "@/components/account/RecoveryFileStep";
import { readRecoveryFile, saveCase } from "@/components/account/recovery-case";
import { useTranslation } from "@/i18n/LocaleProvider";
import { sha256Base64Url } from "@/lib/vault/crypto";
import { completeRecovery, type AccountSetupResult } from "@/lib/vault/store";

// Gendannelse trin 2 (fra mail-linket): enten opret en sag med
// gendannelsesfilen, eller start forfra med en tom konto.
export default function BekraeftGendannelsePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountSetupResult | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readHashToken());
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/auth/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, string | undefined>;
    if (!res.ok) throw new Error(data.message ?? t("account.networkError"));
    return data;
  }

  async function handleFile(file: File | undefined) {
    if (!file || !token) return;
    setError(null);
    setBusy(true);
    try {
      let fileHash: string;
      try {
        fileHash = await sha256Base64Url(await readRecoveryFile(file));
      } catch {
        throw new Error(t("account.fileInvalid"));
      }
      const data = await post({ action: "start", emailToken: token, fileHash });
      saveCase({ claim: data.claim!, caseCode: data.caseCode! });
      router.push("/gendan/status");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("account.networkError"));
      setBusy(false);
    }
  }

  async function handleStartOver() {
    if (!token || !window.confirm(t("account.startOverConfirm"))) return;
    setError(null);
    setBusy(true);
    try {
      const data = await post({ action: "reset", emailToken: token });
      setResult(await completeRecovery(data.claim!, null));
    } catch (e) {
      setError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : t("account.networkError"));
      setBusy(false);
    }
  }

  if (result) {
    return (
      <RecoveryFileStep
        recoveryFile={result.recoveryFile}
        passkeyUnlocksKey={result.passkeyUnlocksKey}
        onDone={() => router.push("/")}
      />
    );
  }

  return (
    <AuthScreen title={t("account.recoverChooseTitle")} backHref="/gendan" backLabel={t("account.back")}>
      {token !== null && !token && <AuthError message={t("account.linkMissing")} />}

      <section className="rounded-lg bg-hf-tan p-4">
        <p className="hf-type-body font-semibold">{t("account.haveFile")}</p>
        <p className="hf-type-body-sm mt-1">{t("account.haveFileNote")}</p>
        <label
          className={`hf-btn-primary hf-type-button mt-3 h-12 w-full cursor-pointer ${!token || busy ? "pointer-events-none opacity-40" : ""}`}
        >
          {t("account.chooseFile")}
          <input
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            disabled={!token || busy}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </label>
      </section>

      <section className="rounded-lg bg-hf-tan p-4">
        <p className="hf-type-body font-semibold">{t("account.noFile")}</p>
        <p className="hf-type-body-sm mt-1">{t("account.noFileNote")}</p>
        <button
          type="button"
          onClick={handleStartOver}
          disabled={!token || busy}
          className="hf-btn-secondary hf-type-button mt-3 h-12 w-full disabled:opacity-40"
        >
          {t("account.startOver")}
        </button>
      </section>

      <AuthError message={error} />
    </AuthScreen>
  );
}
