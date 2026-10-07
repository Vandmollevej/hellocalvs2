"use client";

import { useState } from "react";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";

// Bekræftelse som bundark i stedet for browserens window.confirm
// (ejerens regel 2026-10-07: popups vises aldrig som overlay). ask() åbner
// arket; "Fortsæt" kører handlingen, swipe ned eller scrim lukker uden.
export function useConfirmSheet() {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{ message: string; action: () => void } | null>(null);

  function ask(message: string, action: () => void) {
    setPending({ message, action });
  }

  const sheet = pending ? (
    <BottomSheet ariaLabel={pending.message} onClose={() => setPending(null)}>
      <div className="flex flex-col gap-3 p-4">
        <p className="hf-type-body">{pending.message}</p>
        <BottomSheetCloseButton onClick={pending.action} className="hf-control hf-btn-primary w-full px-4">
          {t("common.continue")}
        </BottomSheetCloseButton>
      </div>
    </BottomSheet>
  ) : null;

  return { ask, sheet };
}
