"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { hasPasskeyOnDevice, isPasskeySupported, registerPasskey } from "@/lib/passkey-client";

// "Slå Face ID til" på profilen, når enheden kan og kontoen ikke har det endnu.
// Almindeligt tekstlink (ikke knap): tilbuddet vises primært efter login.
export function FaceIdButton() {
  const { t } = useTranslation();
  const [state, setState] = useState<"hidden" | "offer" | "busy" | "done" | "error">("hidden");

  useEffect(() => {
    if (!isPasskeySupported()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage findes kun i browseren
    setState(hasPasskeyOnDevice() ? "done" : "offer");
  }, []);

  if (state === "hidden") return null;
  if (state === "done") return <p className="hf-type-body-sm my-4 text-center opacity-70">{t("faceIdOffer.enabled")}</p>;

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
    <div className="my-4 flex flex-col items-center">
      <button
        type="button"
        onClick={enable}
        disabled={state === "busy"}
        className="hf-type-body-sm min-h-11 px-2 text-hf-black underline underline-offset-2 disabled:opacity-40"
      >
        {state === "busy" ? t("faceIdOffer.enabling") : t("faceIdOffer.enable")}
      </button>
      {state === "error" && <p className="hf-type-caption mt-1 text-center text-hf-red-dark">{t("faceIdOffer.error")}</p>}
    </div>
  );
}
