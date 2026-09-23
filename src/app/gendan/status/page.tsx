"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthError, AuthScreen } from "@/components/account/AuthScreen";
import { RecoveryFileStep } from "@/components/account/RecoveryFileStep";
import { clearCase, loadCase, readRecoveryFile, type StoredCase } from "@/components/account/recovery-case";
import { useTranslation } from "@/i18n/LocaleProvider";
import { completeRecovery, type AccountSetupResult } from "@/lib/vault/store";

type CaseStatus = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED" | "EXPIRED";

// Gendannelse trin 3: vent på supports godkendelse, vælg derefter filen igen
// og opret en ny passkey (docs/PRIVACY.md "Gendannelse").
export default function GendannelsesStatusPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [storedCase, setStoredCase] = useState<StoredCase | null | undefined>(undefined);
  const [status, setStatus] = useState<CaseStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AccountSetupResult | null>(null);

  const refresh = useCallback(async (value: StoredCase) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", claim: value.claim }),
      });
      const data = (await res.json()) as { status?: CaseStatus; message?: string };
      if (!res.ok || !data.status) throw new Error(data.message ?? t("account.networkError"));
      setStatus(data.status);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("account.networkError"));
    }
  }, [t]);

  useEffect(() => {
    const value = loadCase();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStoredCase(value);
    if (value) void refresh(value);
  }, [refresh]);

  async function handleRestore() {
    if (!storedCase || !file) return;
    setError(null);
    setBusy(true);
    try {
      let fileSecret: Uint8Array;
      try {
        fileSecret = await readRecoveryFile(file);
      } catch {
        throw new Error(t("account.fileInvalid"));
      }
      const setup = await completeRecovery(storedCase.claim, fileSecret);
      clearCase();
      setResult(setup);
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

  if (storedCase === null) {
    return (
      <AuthScreen title={t("account.caseTitle")} backHref="/gendan" backLabel={t("account.back")}>
        <p className="hf-type-body">{t("account.linkMissing")}</p>
      </AuthScreen>
    );
  }

  const approved = status === "APPROVED";
  return (
    <AuthScreen
      title={t("account.caseTitle")}
      backHref="/gendan"
      backLabel={t("account.back")}
      actions={
        approved ? (
          <button
            type="button"
            onClick={handleRestore}
            disabled={!file || busy}
            className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
          >
            {busy ? t("account.restoring") : t("account.restore")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => storedCase && refresh(storedCase)}
            className="hf-btn-secondary hf-type-button h-12 w-full"
          >
            {t("account.checkStatus")}
          </button>
        )
      }
    >
      {storedCase && (
        <div className="rounded-lg bg-hf-tan p-4">
          <p className="hf-type-body-sm">{t("account.caseCode")}</p>
          <p className="hf-type-section-title mt-1 select-all tracking-wider">{storedCase.caseCode}</p>
          <p className="hf-type-body-sm mt-3">{t("account.caseStatus")}</p>
          <p className="hf-type-body font-semibold">{status ? t(`account.status${status}`) : "…"}</p>
        </div>
      )}
      {!approved && <p className="hf-type-body">{t("account.caseInstructions")}</p>}
      {approved && (
        <>
          <p className="hf-type-body">{t("account.approvedIntro")}</p>
          <label className="hf-btn-secondary hf-type-button h-12 w-full cursor-pointer">
            {file ? file.name : t("account.chooseFile")}
            <input
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </>
      )}
      <AuthError message={error} />
    </AuthScreen>
  );
}
