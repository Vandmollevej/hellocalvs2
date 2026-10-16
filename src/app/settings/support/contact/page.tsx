"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconChevronDown } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { SupportScreenshotPicker } from "@/components/SupportScreenshotPicker";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SUPPORT_REQUEST_CATEGORIES, type SupportRequestCategoryKey } from "@/lib/support-permissions";

// "Kontakt os" (docs/DECISIONS.md 2026-09-23): internal support request, not
// mailto:. Works without any data permission; if the user has an active
// Support permission, the server links it to the request.
// Andre sider kan åbne formularen med emne og kategori udfyldt
// (fx Import → "Kontakt os": ?category=DATA&subject=...).
export default function SupportContactPage() {
  return (
    <Suspense fallback={null}>
      <SupportContactFromQuery />
    </Suspense>
  );
}

function SupportContactFromQuery() {
  const params = useSearchParams();
  const presetCategory = params.get("category");
  const category = SUPPORT_REQUEST_CATEGORIES.find((key) => key === presetCategory) ?? "OTHER";
  return <SupportContactForm initialCategory={category} initialSubject={(params.get("subject") ?? "").slice(0, 200)} />;
}

function SupportContactForm({
  initialCategory,
  initialSubject,
}: {
  initialCategory: SupportRequestCategoryKey;
  initialSubject: string;
}) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SupportRequestCategoryKey>(initialCategory);
  const [subject, setSubject] = useState(initialSubject);
  const [message, setMessage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subject.trim() || !message.trim()) {
      setError(t("settings.support.contactRequired"));
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, subject, message, attachments: images }),
      });
      const data = (await response.json().catch(() => ({}))) as { request?: { id: string } };
      if (!response.ok || !data.request) {
        setError(t("settings.support.contactError"));
        return;
      }
      setSentId(data.request.id);
    } catch {
      setError(t("settings.support.contactError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <HfScreen title={t("settings.support.contact")}>
      <div className="hf-page hf-page--sections">
        {sentId ? (
          <>
            <p role="status" className="hf-type-body">
              {t("settings.support.contactSent", { caseCode: sentId.slice(-8).toUpperCase() })}
            </p>
            <Link
              href={`/settings/support/requests/${sentId}`}
              className="hf-control hf-btn-primary flex w-full items-center justify-center"
            >
              {t("settings.support.openCase")}
            </Link>
          </>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="hf-type-label">{t("settings.support.contactCategory")}</span>
              <span className="relative">
                <select
                  className="hf-select-auth hf-field hf-type-input"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as SupportRequestCategoryKey)}
                >
                  {SUPPORT_REQUEST_CATEGORIES.map((key) => (
                    <option key={key} value={key}>
                      {t(`settings.support.categories.${key}`)}
                    </option>
                  ))}
                </select>
                <IconChevronDown
                  size={18}
                  stroke={2.5}
                  className="hf-select-chevron"
                />
              </span>
            </label>
            <TextField
              variant="standard"
              label={t("settings.support.contactSubject")}
              value={subject}
              maxLength={200}
              onChange={(event) => setSubject(event.target.value)}
            />
            <label className="flex flex-col gap-1">
              <span className="hf-type-label">{t("settings.support.contactMessage")}</span>
              <textarea
                rows={6}
                maxLength={5000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="hf-type-input w-full border bg-hf-cream p-3 outline-none border-hf-field-border rounded-card"
              />
            </label>
            <SupportScreenshotPicker images={images} onChange={setImages} disabled={sending} />
            {error && (
              <p role="alert" className="hf-type-caption text-hf-red-dark">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="hf-control hf-btn-primary w-full"
            >
              {sending ? t("settings.support.contactSending") : t("settings.support.contactSend")}
            </button>
          </form>
        )}
      </div>
    </HfScreen>
  );
}
