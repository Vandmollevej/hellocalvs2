"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";

type Mode = "close" | "forget";

// Nederst på Profil (/profile/edit) — flyttet fra den tidligere side
// Kontoindstillinger (ejerens valg 2026-10-03). "Ret til at blive glemt"
// anonymiserer med det samme (src/lib/gdpr.ts), og brugeren skal skrive SLET.
// "Luk konto" er kun et sort, understreget tekstlink (ejerens regel
// 2026-10-03) og kan fortrydes ved at logge ind inden for 3 måneder
// (src/lib/account-closure.ts).
export function AccountDeletionSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Mode) {
    setMode(next);
    setConfirm("");
    setError(null);
  }

  // Kontrolordet skrives på brugerens eget sprog (serveren får altid "SLET").
  const controlWord = t(mode === "close" ? "accountSettings.closeWord" : "accountSettings.confirmWord");
  const controlOk = confirm.trim().toLocaleUpperCase() === controlWord.toLocaleUpperCase();

  async function submit() {
    if (!mode || !controlOk) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, confirm: mode === "forget" ? "SLET" : confirm.trim() }),
    }).catch(() => null);
    if (res?.ok) {
      router.push("/login");
      router.refresh();
      return;
    }
    setError(t("accountSettings.error"));
    setBusy(false);
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-4">
        <section className="flex flex-col gap-3">
          <h2 className="hf-type-body hf-type-strong">{t("accountSettings.forgetTitle")}</h2>
          <p className="hf-type-body text-text-secondary">{t("accountSettings.forgetIntro")}</p>
          <button type="button" className="hf-control hf-btn-primary w-full px-4" onClick={() => open("forget")}>
            {t("accountSettings.forgetButton")}
          </button>
        </section>

        <button
          type="button"
          className="hf-type-body min-h-11 self-start text-hf-black underline underline-offset-2"
          onClick={() => open("close")}
        >
          {t("accountSettings.closeLink")}
        </button>
      </div>

      {mode && (
        <BottomSheet
          ariaLabel={t(mode === "close" ? "accountSettings.closeLink" : "accountSettings.forgetButton")}
          onClose={() => !busy && setMode(null)}
        >
          <div className="flex flex-col gap-3 p-4">
            {mode === "close" && <p className="hf-type-body">{t("accountSettings.closeSheetText")}</p>}
            <>
              <p className="hf-type-body">{t(mode === "close" ? "accountSettings.closeWarning" : "accountSettings.confirmWarning", { word: controlWord })}</p>
              <input
                  className="hf-type-body hf-field rounded-xl bg-hf-tan px-4 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder={t("accountSettings.confirmPlaceholder", { word: controlWord })}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
              </>
            {error && (
              <p role="alert" className="hf-type-body text-hf-red-dark">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy || !controlOk}
              onClick={() => void submit()}
              className={
                mode === "close"
                  ? "hf-type-body min-h-11 self-start text-hf-black underline underline-offset-2 disabled:opacity-50"
                  : "hf-control hf-btn-primary w-full px-4 disabled:opacity-50"
              }
            >
              {t(mode === "close" ? "accountSettings.closeConfirmButton" : "accountSettings.confirmButton")}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
