"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { DoctorShareEditor } from "@/components/hf/DoctorShareEditor";
import { useTranslation } from "@/i18n/LocaleProvider";
import {
  DEFAULT_DOCTOR_SHARE_CATEGORIES,
  sanitizeDoctorShareCategories,
  type DoctorShareCategory,
  type DoctorShareHistoryRange,
} from "@/lib/doctor-share";

type DoctorShare = {
  id: string;
  name: string;
  email: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "REVOKED";
  categories: unknown;
  historyRange: DoctorShareHistoryRange;
  expiresAt: string | null;
};

// The "already invited user" screen — almost identical to
// /settings/hello-doc/invite per the user's own request, sharing
// DoctorShareEditor for the body. Lets the owner adjust which data
// categories/history range are shared, resend a still-pending invitation, or
// revoke access entirely.
export default function EditHelloDocUserPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [share, setShare] = useState<DoctorShare | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [categories, setCategories] = useState<DoctorShareCategory[]>(DEFAULT_DOCTOR_SHARE_CATEGORIES);
  const [historyRange, setHistoryRange] = useState<DoctorShareHistoryRange>("ALL");
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/doctor-shares/${params.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        const loaded: DoctorShare = data.share;
        setShare(loaded);
        setName(loaded.name);
        setEmail(loaded.email);
        setCategories(sanitizeDoctorShareCategories(loaded.categories));
        setHistoryRange(loaded.historyRange);
      })
      .catch(() => setLoadError(true));
  }, [params.id]);

  async function saveChanges() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor-shares/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, categories, historyRange }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("helloDoc.errorGeneric"));
        return;
      }
      setShare(data.share);
    } catch {
      setError(t("helloDoc.errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    try {
      const res = await fetch(`/api/doctor-shares/${params.id}/resend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? t("helloDoc.errorGeneric"));
        return;
      }
      setShare(data.share);
    } finally {
      setResending(false);
    }
  }

  async function revoke() {
    if (!share) return;
    if (!window.confirm(t("helloDoc.revokeConfirm", { name: share.name }))) return;
    await fetch(`/api/doctor-shares/${params.id}/revoke`, { method: "POST" });
    router.replace("/settings/hello-doc");
  }

  if (loadError) {
    return (
      <HfScreen title={t("helloDoc.editTitle")} onBack={() => router.back()}>
        <p className="hf-type-body-sm p-4 text-hf-red-dark">{t("helloDoc.loadError")}</p>
      </HfScreen>
    );
  }

  if (!share) {
    return (
      <HfScreen title={t("helloDoc.editTitle")} onBack={() => router.back()}>
        <p className="hf-type-body-sm p-4 opacity-70">{t("common.loading")}</p>
      </HfScreen>
    );
  }

  const statusLabel =
    share.status === "PENDING"
      ? t("helloDoc.statusPending")
      : share.status === "EXPIRED"
        ? t("helloDoc.statusExpired")
        : t("helloDoc.statusActive");

  return (
    <HfScreen
      title={t("helloDoc.editTitle")}
      onBack={() => router.back()}
      footer={
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={saveChanges}
            disabled={saving || !name.trim() || !email.trim()}
            className="hf-btn-primary hf-type-button h-16 w-full text-[19px] disabled:opacity-40"
            style={{ borderRadius: 12 }}
          >
            {saving ? t("helloDoc.sending") : t("helloDoc.saveChanges")}
          </button>
          {error && <p className="hf-type-caption text-center text-hf-red-dark">{error}</p>}
        </div>
      }
    >
      <div className="flex flex-col gap-6 px-4 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <span className="hf-type-caption opacity-70">{statusLabel}</span>
          {share.status === "PENDING" && (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="hf-type-caption font-bold text-hf-green disabled:opacity-50"
            >
              {resending ? t("helloDoc.resending") : t("helloDoc.resend")}
            </button>
          )}
        </div>

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

        <button
          type="button"
          onClick={revoke}
          className="hf-type-button h-12 w-full rounded-[8px] border text-hf-red-dark"
          style={{ borderColor: "var(--hf-color-danger)" }}
        >
          {t("helloDoc.revoke")}
        </button>
      </div>
    </HfScreen>
  );
}
