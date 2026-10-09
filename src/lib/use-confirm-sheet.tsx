"use client";

import { useState } from "react";
import { BottomSheet, BottomSheetCloseButton, useBottomSheetClose } from "@/components/hf/BottomSheet";
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

function TypedConfirmBody({ message, word, onConfirm }: { message: string; word: string; onConfirm: () => void }) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const close = useBottomSheetClose();
  const ok = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="hf-type-body">{message}</p>
      <input
        className="hf-type-body hf-field rounded-xl bg-hf-tan px-4 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        placeholder={word}
        autoCapitalize="characters"
        autoComplete="off"
      />
      <button
        type="button"
        disabled={!ok}
        onClick={() => {
          onConfirm();
          close();
        }}
        className="hf-control hf-btn-primary w-full px-4"
      >
        {t("common.continue")}
      </button>
    </div>
  );
}

// Som useConfirmSheet, men brugeren skal skrive kontrolordet (fx "SLET")
// før "Fortsæt" kan trykkes — erstatter window.prompt ved uigenkaldelige
// handlinger.
export function useTypedConfirmSheet() {
  const [pending, setPending] = useState<{ message: string; word: string; action: () => void } | null>(null);

  function ask(message: string, word: string, action: () => void) {
    setPending({ message, word, action });
  }

  const sheet = pending ? (
    <BottomSheet ariaLabel={pending.message} onClose={() => setPending(null)}>
      <TypedConfirmBody message={pending.message} word={pending.word} onConfirm={pending.action} />
    </BottomSheet>
  ) : null;

  return { ask, sheet };
}
