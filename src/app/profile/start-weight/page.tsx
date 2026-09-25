"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

// Informationsside bag hængelåsen ved start-vægt på Profil
// (docs/DECISIONS.md 2026-09-22). Start-vægten vises kun — ændring kræver
// verificeringsmail; dagsvægt registreres på den eksisterende vægtside.
export default function StartWeightPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("profile");
        return (await response.json()) as { user: { weightKg: number | null } };
      })
      .then((data) => {
        if (!cancelled) setWeightKg(data.user.weightKg);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function sendVerificationEmail() {
    if (sending) return;
    setSending(true);
    setError(false);
    try {
      const response = await fetch("/api/profile/start-weight/verification", { method: "POST" });
      if (!response.ok) throw new Error("verification_failed");
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <HfScreen title={t("profile.startWeight.title")} onBack={() => router.back()}>
      <div className="hf-page">
        {weightKg !== null && (
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-hf-black opacity-60">
              {t("profile.startWeight.currentLabel")}
            </span>
            <div className="rounded-xl bg-hf-tan px-4 py-3 text-[15px] text-hf-black opacity-60">
              {new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 }).format(weightKg)} KG
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 text-[15px] leading-6 text-hf-black">
          <p>{t("profile.startWeight.description1")}</p>
          <p>{t("profile.startWeight.description2")}</p>
          <p>{t("profile.startWeight.description3")}</p>
        </div>

        {sent ? (
          <p role="status" className="rounded-xl bg-hf-tan px-4 py-3 text-[14px] text-hf-black">
            {t("profile.startWeight.emailSent")}
          </p>
        ) : (
          <button
            type="button"
            disabled={sending}
            onClick={sendVerificationEmail}
            className="hf-type-button mt-2 flex h-12 w-full items-center justify-center rounded-lg bg-hf-green px-4 font-bold text-hf-white disabled:opacity-50"
          >
            {sending ? t("profile.startWeight.sending") : t("profile.startWeight.sendEmail")}
          </button>
        )}

        {error && (
          <p role="alert" className="hf-type-caption text-hf-red-dark">
            {t("profile.startWeight.sendError")}
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push("/profile/weight-calibration")}
          className="hf-btn-secondary hf-type-button h-12 w-full px-4"
        >
          {t("profile.startWeight.registerDailyWeight")}
        </button>
      </div>
    </HfScreen>
  );
}
