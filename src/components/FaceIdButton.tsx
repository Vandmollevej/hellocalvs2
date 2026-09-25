"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { hasPasskeyOnDevice, isPasskeySupported, registerPasskey } from "@/lib/passkey-client";

// "Slå Face ID til" på profilen, når enheden kan og ikke har det endnu.
export function FaceIdButton() {
  const { t } = useTranslation();
  const [state, setState] = useState<"hidden" | "offer" | "busy" | "done" | "error">("hidden");

  useEffect(() => {
    if (!isPasskeySupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage findes kun i browseren
    setState(hasPasskeyOnDevice() ? "done" : "offer");
  }, []);

  if (state === "hidden") return null;
  if (state === "done") return <p className="hf-type-body-sm mt-3 text-center">{t("faceIdOffer.enabled")}</p>;

  async function enable() {
    setState("busy");
    try {
      await registerPasskey();
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={enable}
        disabled={state === "busy"}
        className="hf-btn-primary hf-type-button mt-3 h-12 w-full px-4 disabled:opacity-40"
      >
        {state === "busy" ? t("faceIdOffer.enabling") : t("faceIdOffer.enable")}
      </button>
      {state === "error" && <p className="hf-type-caption mt-2 text-hf-red-dark">{t("faceIdOffer.error")}</p>}
    </>
  );
}
