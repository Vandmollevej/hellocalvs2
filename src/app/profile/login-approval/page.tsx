"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { enablePush, type PushSetupResult } from "@/lib/push-client";

// Slå "godkend login med notifikation" til: brugeren tillader notifikationer
// på denne enhed, og nye logins skal derefter godkendes her (docs/DECISIONS.md
// 2026-10-03).
export default function LoginApprovalSettingsPage() {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/push/subscribe")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setEnabled(data ? Boolean(data.loginApprovalEnabled) : false))
      .catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    if (enabled === null || busy) return;
    setError(null);
    setBusy(true);
    const next = !enabled;
    if (next) {
      const result: PushSetupResult = await enablePush();
      if (result !== "ok") {
        setError(t(`loginApproval.error.${result}`));
        setBusy(false);
        return;
      }
    }
    const response = await fetch("/api/profile/login-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (response.ok) setEnabled(next);
    else setError(t("loginApproval.error.failed"));
    setBusy(false);
  }

  return (
    <HfScreen title={t("loginApproval.title")}>
      <div className="flex flex-col gap-4 p-4">
        <p className="hf-type-body">{t("loginApproval.description")}</p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled === true}
          disabled={enabled === null || busy}
          onClick={toggle}
          className="hf-control-row flex w-full items-center justify-between rounded-xl bg-hf-white px-4 disabled:opacity-50"
        >
          <span className="hf-type-body">{t("loginApproval.toggle")}</span>
          <span className="hf-type-body hf-type-strong">
            {enabled ? t("loginApproval.on") : t("loginApproval.off")}
          </span>
        </button>
        <p className="hf-type-caption text-text-secondary">{t("loginApproval.hint")}</p>
        {error && <p className="hf-type-caption text-hf-red-dark">{error}</p>}
      </div>
    </HfScreen>
  );
}
