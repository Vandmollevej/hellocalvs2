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
  const [expiresAt, setExpiresAt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendInvitation() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, categories, historyRange, expiresAt: expiresAt || null }),
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
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={sendInvitation}
            disabled={sending || !name.trim() || !email.trim()}
            className="hf-control hf-btn-primary w-full"
          >
            {sending ? t("helloDoc.sending") : t("helloDoc.sendInvitation")}
          </button>
          {error && <p className="hf-type-caption text-center text-hf-red-dark">{error}</p>}
        </div>
      }
    >
      <div className="px-4 pb-8 pt-4">
        {/* Standard sidetitel (22 px) som alle andre sider; den tidligere
            32 px-overskrift var for stor (bruger 2026-10-09). */}
        <h1 className="hf-type-page-title mb-2 text-hf-black">{t("helloDoc.inviteHeading")}</h1>
        <p className="text-text-secondary hf-type-body mb-8">{t("helloDoc.inviteHeadingDescription")}</p>

        <DoctorShareEditor
          name={name}
          onNameChange={setName}
          email={email}
          onEmailChange={setEmail}
          categories={categories}
          onCategoriesChange={setCategories}
          historyRange={historyRange}
          onHistoryRangeChange={setHistoryRange}
          expiresAt={expiresAt}
          onExpiresAtChange={setExpiresAt}
          previewHref="/settings/hello-doc/preview"
        />
      </div>
    </HfScreen>
  );
}
