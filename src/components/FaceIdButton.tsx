"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { isPasskeySupported, registerPasskey } from "@/lib/passkey-client";

// "Slå Face ID til" på profilen, når enheden kan og kontoen ikke har det endnu.
export function FaceIdButton() {
  const { t } = useTranslation();
  const [state, setState] = useState<"hidden" | "offer" | "busy" | "done" | "error">("hidden");

  useEffect(() => {
    if (!isPasskeySupported()) return;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (!res.ok) return;
        const { user } = (await res.json()) as { user: { hasPasskey: boolean } };
        setState(user.hasPasskey ? "done" : "offer");
      })
      .catch(() => undefined);
  }, []);

  if (state === "hidden") return null;
  if (state === "done") return <p className="hf-type-body-sm mt-4 text-center">{t("faceIdOffer.enabled")}</p>;

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
        className="hf-btn-primary hf-type-button mt-4 h-12 w-full px-4 disabled:opacity-40"
      >
        {state === "busy" ? t("faceIdOffer.enabling") : t("faceIdOffer.enable")}
      </button>
      {state === "error" && <p className="hf-type-caption mt-2 text-hf-red-dark">{t("faceIdOffer.error")}</p>}
    </>
  );
}
