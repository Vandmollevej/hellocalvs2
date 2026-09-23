"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthError } from "@/components/account/AuthScreen";
import { RecoveryFileStep } from "@/components/account/RecoveryFileStep";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { addPasskey, deleteAccount, logOut, regenerateRecoveryFile, useVault } from "@/lib/vault/store";

type PasskeyInfo = { credentialId: string; createdAt: string; lastUsedAt: string | null; hasEnvelope: boolean };

// Profil → Login og gendannelse (docs/PRIVACY.md): passkeys, ny
// gendannelsesfil, log ud og slet konto. Erstatter "Skift adgangskode".
export default function SecurityPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const { status } = useVault();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [recoveryFile, setRecoveryFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/auth/keys", { cache: "no-store" });
    if (res.ok) setPasskeys(((await res.json()) as { passkeys: PasskeyInfo[] }).passkeys);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : t("account.networkError"));
    } finally {
      setBusy(false);
    }
  }

  if (recoveryFile) {
    return <RecoveryFileStep recoveryFile={recoveryFile} passkeyUnlocksKey onDone={() => setRecoveryFile(null)} />;
  }

  const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "da-DK", { dateStyle: "medium" });
  const ready = status === "ready";

  return (
    <HfScreen title={t("account.securityTitle")}>
      <div className="flex flex-col gap-4 px-4 py-4">
        <h2 className="hf-type-section-title">{t("account.passkeys")}</h2>
        <ul className="flex flex-col divide-y divide-hf-gray-border rounded-lg bg-hf-tan">
          {passkeys.map((p, index) => (
            <li key={p.credentialId} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="hf-type-body">Passkey {index + 1}</p>
                <p className="hf-type-caption text-hf-gray-dark">
                  {t("account.lastUsed")}: {dateFormat.format(new Date(p.lastUsedAt ?? p.createdAt))}
                </p>
              </div>
              <span className="hf-type-caption">
                {p.hasEnvelope ? t("account.passkeyUnlocks") : t("account.passkeyNoUnlock")}
              </span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => run(async () => { await addPasskey(); await load(); })}
          className="hf-btn-secondary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {t("account.addPasskey")}
        </button>

        <div>
          <button
            type="button"
            disabled={!ready || busy}
            onClick={() => run(async () => setRecoveryFile(await regenerateRecoveryFile()))}
            className="hf-btn-secondary hf-type-button h-12 w-full disabled:opacity-40"
          >
            {t("account.newRecoveryFile")}
          </button>
          <p className="hf-type-caption mt-1 text-hf-gray-dark">{t("account.newRecoveryFileNote")}</p>
        </div>

        <AuthError message={error} />

        <button
          type="button"
          disabled={busy}
          onClick={() => run(async () => { await logOut(); router.push("/welcome"); })}
          className="hf-btn-primary hf-type-button mt-4 h-12 w-full disabled:opacity-40"
        >
          {t("account.logOut")}
        </button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => {
            if (!window.confirm(t("account.deleteAccountConfirm"))) return;
            void run(async () => { await deleteAccount(); router.push("/welcome"); });
          }}
          className="hf-type-body-sm text-hf-red-dark underline disabled:opacity-40"
        >
          {t("account.deleteAccount")}
        </button>
      </div>
    </HfScreen>
  );
}
