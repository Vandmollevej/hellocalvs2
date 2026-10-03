"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";

type Mode = "close" | "forget";

// Kontoindstillinger: "Luk konto" og "Ret til at blive glemt". Begge
// anonymiserer kontoen (src/lib/gdpr.ts) og logger ud; brugeren skal skrive SLET.
export default function AccountSettingsPage() {
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

  async function submit() {
    if (!mode) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, confirm: confirm.trim() }),
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
    <HfScreen title={t("accountSettings.title")}>
      <div className="hf-page hf-stack">
        <section className="flex flex-col gap-3">
          <h2 className="hf-type-body hf-type-strong">{t("accountSettings.closeTitle")}</h2>
          <p className="hf-type-body text-text-secondary">{t("accountSettings.closeIntro")}</p>
          <button type="button" className="hf-control hf-btn-primary w-full px-4" onClick={() => open("close")}>
            {t("accountSettings.closeButton")}
          </button>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="hf-type-body hf-type-strong">{t("accountSettings.forgetTitle")}</h2>
          <p className="hf-type-body text-text-secondary">{t("accountSettings.forgetIntro")}</p>
          <button type="button" className="hf-control hf-btn-primary w-full px-4" onClick={() => open("forget")}>
            {t("accountSettings.forgetButton")}
          </button>
        </section>
      </div>

      {mode && (
        <BottomSheet
          title={t(mode === "close" ? "accountSettings.closeButton" : "accountSettings.forgetButton")}
          onClose={() => !busy && setMode(null)}
        >
          <div className="flex flex-col gap-3 p-4">
            <p className="hf-type-body">{t("accountSettings.confirmWarning")}</p>
            <input
              className="hf-type-body hf-field rounded-xl bg-hf-tan px-4 text-hf-black outline-none focus-visible:ring-2 focus-visible:ring-hf-green"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={t("accountSettings.confirmPlaceholder")}
              autoCapitalize="characters"
              autoComplete="off"
            />
            {error && (
              <p role="alert" className="hf-type-body text-hf-red-dark">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={busy || confirm.trim() !== "SLET"}
              onClick={() => void submit()}
              className="hf-control hf-btn-primary w-full px-4 disabled:opacity-50"
            >
              {t("accountSettings.confirmButton")}
            </button>
          </div>
        </BottomSheet>
      )}
    </HfScreen>
  );
}
