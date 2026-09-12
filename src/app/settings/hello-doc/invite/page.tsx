"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { DoctorShareEditor } from "@/components/hf/DoctorShareEditor";
import { useTranslation } from "@/i18n/LocaleProvider";
import { DEFAULT_DOCTOR_SHARE_CATEGORIES, type DoctorShareCategory, type DoctorShareHistoryRange } from "@/lib/doctor-share";

export default function InviteHelloDocUserPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<DoctorShareCategory[]>(DEFAULT_DOCTOR_SHARE_CATEGORIES);
  const [historyRange, setHistoryRange] = useState<DoctorShareHistoryRange>("ALL");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendInvitation() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, categories, historyRange }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("helloDoc.errorGeneric"));
        return;
      }
      router.replace("/settings/hello-doc");
    } catch {
      setError(t("helloDoc.errorGeneric"));
    } finally {
      setSending(false);
    }
  }

  return (
    <HfScreen
      title={t("helloDoc.inviteTitle")}
      onBack={() => router.back()}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={sendInvitation}
            disabled={sending || !name.trim() || !email.trim()}
            className="hf-btn-primary hf-type-button h-16 w-full text-[19px] disabled:opacity-40"
            style={{ borderRadius: 12 }}
          >
            {sending ? t("helloDoc.sending") : t("helloDoc.sendInvitation")}
          </button>
          <p className="hf-type-caption text-center opacity-60">{t("helloDoc.invitationExpiryHint")}</p>
          {error && <p className="hf-type-caption text-center text-hf-red-dark">{error}</p>}
        </div>
      }
    >
      <div className="px-4 pb-8 pt-4">
        {/* Heading/description + field styling matches the HelloFresh
            checkout reference the user supplied (docs/DECISIONS.md
            2026-09-12), deliberately departing from the standard page-title
            treatment for this one screen. */}
        <h1 className="mb-2 text-[28px] font-bold leading-[34px] text-hf-black">{t("helloDoc.inviteHeading")}</h1>
        <p className="hf-type-body-lg mb-6 opacity-80">{t("helloDoc.inviteHeadingDescription")}</p>

        <DoctorShareEditor
          name={name}
          onNameChange={setName}
          email={email}
          onEmailChange={setEmail}
          categories={categories}
          onCategoriesChange={setCategories}
          historyRange={historyRange}
          onHistoryRangeChange={setHistoryRange}
          previewHref="/settings/hello-doc/preview"
        />
      </div>
    </HfScreen>
  );
}
