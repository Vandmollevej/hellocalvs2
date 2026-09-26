"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { FaceIdIcon } from "@/components/icons/FaceIdIcon";
import { hasPasskeyOnDevice, isPasskeySupported, registerPasskey } from "@/lib/passkey-client";

// Face ID-rækken på profilen. Vises kun, når enheden har en indbygget
// biometrisk godkender (Face ID/Touch ID); ellers skjules den helt.
export function FaceIdButton() {
  const { t } = useTranslation();
  const [state, setState] = useState<"hidden" | "offer" | "busy" | "done" | "error">("hidden");

  useEffect(() => {
    if (!isPasskeySupported()) return;
    let cancelled = false;
    const check = PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? Promise.resolve(false);
    check
      .then((available) => {
        if (!cancelled && available) setState(hasPasskeyOnDevice() ? "done" : "offer");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "hidden") return null;

  async function enable() {
    setState("busy");
    try {
      await registerPasskey();
      setState("done");
    } catch {
      setState("error");
    }
  }

  const done = state === "done";
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={done ? undefined : enable}
        disabled={done || state === "busy"}
        className="hf-type-body hf-type-strong flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-hf-tan px-4 text-hf-black disabled:cursor-default"
      >
        <span className="text-[#05aaf5]">
          <FaceIdIcon size={30} animate={!done} />
        </span>
        {done ? t("faceIdOffer.active") : state === "busy" ? t("faceIdOffer.enabling") : t("faceIdOffer.activate")}
      </button>
      {state === "error" && <p className="hf-type-caption text-hf-red-dark">{t("faceIdOffer.error")}</p>}
    </div>
  );
}
