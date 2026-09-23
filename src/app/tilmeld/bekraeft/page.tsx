"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthError, AuthScreen, readHashToken, REFERRAL_STORAGE_KEY } from "@/components/account/AuthScreen";
import { RecoveryFileStep } from "@/components/account/RecoveryFileStep";
import { useTranslation } from "@/i18n/LocaleProvider";
import { signUp, type AccountSetupResult } from "@/lib/vault/store";
import { isPasskeySupported } from "@/lib/vault/webauthn-client";

// Tilmelding trin 2 (fra mail-linket): passkey + krypteringsnøgle på enheden
// + gendannelsesfil (docs/PRIVACY.md).
export default function BekraeftTilmeldingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AccountSetupResult | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Tokenet læses fra URL-fragmentet og fjernes straks fra adresselinjen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(readHashToken());
    setSupported(isPasskeySupported());
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function handleCreate() {
    if (!token) return;
    setError(null);
    setSubmitting(true);
    let referral: string | undefined;
    try {
      referral = localStorage.getItem(REFERRAL_STORAGE_KEY) ?? undefined;
    } catch {
      referral = undefined;
    }
    try {
      const setup = await signUp(token, referral);
      try {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
      } catch {
        // ignorer
      }
      setResult(setup);
    } catch (e) {
      setError(e instanceof Error && e.name !== "NotAllowedError" ? e.message : t("account.networkError"));
      setSubmitting(false);
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

  const invalid = token !== null && !token;
  return (
    <AuthScreen
      title={t("account.confirmTitle")}
      backHref="/signup"
      backLabel={t("account.back")}
      actions={
        <button
          type="button"
          onClick={handleCreate}
          disabled={!token || submitting || !supported}
          className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
        >
          {submitting ? t("account.creating") : t("account.createPasskey")}
        </button>
      }
    >
      <p className="hf-type-body">{t("account.confirmIntro")}</p>
      <p className="hf-type-body-sm text-hf-gray-dark">{t("account.loginPrivacy")}</p>
      {invalid && <AuthError message={t("account.linkMissing")} />}
      {!supported && <AuthError message={t("account.noPasskeySupport")} />}
      <AuthError message={error} />
    </AuthScreen>
  );
}
