"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";

// Videresend en ret til en ven (2026-10-09): helsides popup med hvor længe
// linket virker, modtagerens navn og mail, afsendernavn ("Fra") og en valgfri
// hilsen. "Del" opretter et krypteret link (POST /api/forwards) og åbner
// Apples/telefonens deleark; uden deleark kopieres linket.

const DURATIONS = [24, 24 * 7, 24 * 30, 24 * 90] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForwardRecipeSheet({
  dishId,
  name,
  onClose,
}: {
  dishId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [hours, setHours] = useState<number>(24 * 7);
  const [toName, setToName] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const own = data?.user?.displayName;
        if (typeof own === "string") setFromName((current) => current || own);
      })
      .catch(() => {});
  }, []);

  const valid =
    toName.trim() !== "" &&
    EMAIL.test(toEmail.trim()) &&
    fromName.trim() !== "";

  async function share() {
    if (!valid) {
      setError(t("forwardRecipe.missing"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/forwards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "DISH",
          dishId,
          expiresInHours: hours,
          recipientName: toName,
          recipientEmail: toEmail,
          fromName,
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.link !== "string") {
        setError(data.message ?? t("forwardRecipe.error"));
        return;
      }
      const shareData = {
        title: name,
        text: message.trim() || t("forwardRecipe.shareText", { name }),
        url: data.link,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          // Brugeren lukkede delearket — linket er oprettet og mailet.
        }
      } else {
        await navigator.clipboard.writeText(data.link).catch(() => {});
        setCopied(true);
        return;
      }
      onClose();
    } catch {
      setError(t("forwardRecipe.error"));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "hf-type-body hf-field min-w-0 rounded-full bg-hf-tan px-4 text-hf-black outline-none";

  return (
    <BottomSheet
      size="full"
      title={t("forwardRecipe.title")}
      onClose={onClose}
      footer={
        <>
          {error && (
            <p className="hf-type-body mb-2 text-center text-text-secondary">
              {error}
            </p>
          )}
          {copied && (
            <p className="hf-type-body mb-2 text-center text-hf-black">
              {t("forwardRecipe.copied")}
            </p>
          )}
          <button
            type="button"
            onClick={share}
            disabled={busy}
            className="hf-control hf-btn-primary w-full"
          >
            {busy ? t("forwardRecipe.sending") : t("forwardRecipe.share")}
          </button>
        </>
      }
    >
      <div className="hf-page">
        <p className="hf-type-small hf-type-strong text-hf-black">
          {t("forwardRecipe.title")}
        </p>
        <p className="hf-type-body text-text-secondary">
          {t("forwardRecipe.hint", { name })}
        </p>

        <div>
          <p className="hf-type-small hf-type-strong mb-2 text-hf-black">
            {t("forwardRecipe.duration")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DURATIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={hours === value}
                onClick={() => setHours(value)}
                className={`hf-type-small hf-type-strong rounded-full border border-hf-black px-3 py-3 ${
                  hours === value
                    ? "bg-hf-black text-hf-white"
                    : "bg-hf-white text-hf-black"
                }`}
              >
                {t(`forwardRecipe.days.${value / 24}`)}
              </button>
            ))}
          </div>
        </div>

        <input
          value={toName}
          onChange={(e) => setToName(e.target.value)}
          autoComplete="off"
          placeholder={t("forwardRecipe.toName")}
          aria-label={t("forwardRecipe.toName")}
          className={field}
        />
        <input
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder={t("forwardRecipe.toEmail")}
          aria-label={t("forwardRecipe.toEmail")}
          className={field}
        />
        <input
          value={fromName}
          onChange={(e) => setFromName(e.target.value)}
          autoComplete="name"
          placeholder={t("forwardRecipe.fromName")}
          aria-label={t("forwardRecipe.fromName")}
          className={field}
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder={t("forwardRecipe.message")}
          aria-label={t("forwardRecipe.message")}
          className="hf-type-body resize-none rounded-card bg-hf-tan px-4 py-3 text-hf-black outline-none"
        />
        <p className="hf-type-small text-text-secondary">
          {t("forwardRecipe.encrypted")}
        </p>
      </div>
    </BottomSheet>
  );
}
