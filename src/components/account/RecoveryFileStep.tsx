"use client";

import { useState } from "react";
import { AuthScreen } from "@/components/account/AuthScreen";
import { downloadRecoveryFile } from "@/lib/vault/store";
import { useTranslation } from "@/i18n/LocaleProvider";

// Brugeren SKAL downloade gendannelsesfilen, før de kan fortsætte
// (docs/PRIVACY.md "Gendannelse"). Filen findes kun her — Hello Cal har den ikke.
export function RecoveryFileStep({
  recoveryFile,
  passkeyUnlocksKey,
  onDone,
}: {
  recoveryFile: string;
  passkeyUnlocksKey: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <AuthScreen
      title={t("account.recoveryFileTitle")}
      actions={
        <>
          <button
            type="button"
            onClick={() => {
              downloadRecoveryFile(recoveryFile);
              setDownloaded(true);
            }}
            className={`${downloaded ? "hf-btn-secondary" : "hf-btn-primary"} hf-type-button h-12 w-full`}
          >
            {downloaded ? t("account.downloaded") : t("account.downloadRecoveryFile")}
          </button>
          <button
            type="button"
            disabled={!downloaded || !confirmed}
            onClick={onDone}
            className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-40"
          >
            {t("account.continue")}
          </button>
        </>
      }
    >
      <p className="hf-type-body">{t("account.recoveryFileIntro")}</p>
      <p className="hf-type-body font-semibold">{t("account.recoveryFileWarning")}</p>
      <p className="hf-type-body-sm text-hf-gray-dark">{t("account.recoveryFileSplit")}</p>
      {!passkeyUnlocksKey && <p className="hf-type-body-sm text-hf-red-dark">{t("account.passkeyDeviceOnly")}</p>}
      <label className="hf-type-body mt-2 flex items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={confirmed}
          disabled={!downloaded}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        {t("account.savedConfirm")}
      </label>
    </AuthScreen>
  );
}
