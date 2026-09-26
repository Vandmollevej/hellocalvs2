"use client";

import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { TextField } from "@/components/hf/TextField";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SUPPORT_REQUEST_CATEGORIES, type SupportRequestCategoryKey } from "@/lib/support-permissions";

// "Kontakt os" (docs/DECISIONS.md 2026-09-23): internal support request, not
// mailto:. Works without any data permission; if the user has an active
// Support permission, the server links it to the request.
export default function SupportContactPage() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<SupportRequestCategoryKey>("OTHER");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCase, setSentCase] = useState<string | null>(null);

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
        body: JSON.stringify({ category, subject, message }),
      });
      const data = (await response.json().catch(() => ({}))) as { request?: { id: string } };
      if (!response.ok || !data.request) {
        setError(t("settings.support.contactError"));
        return;
      }
      setSentCase(data.request.id.slice(-8).toUpperCase());
    } catch {
      setError(t("settings.support.contactError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <HfScreen title={t("settings.support.contact")}>
      <div className="hf-page hf-page--sections">
        {sentCase ? (
          <p role="status" className="hf-type-body">
            {t("settings.support.contactSent", { caseCode: sentCase })}
          </p>
        ) : (
          <form onSubmit={send} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="hf-type-label">{t("settings.support.contactCategory")}</span>
              <span className="relative">
                <select
                  className="hf-type-input h-12 w-full appearance-none rounded-[8px] border bg-hf-cream pl-4 pr-10 outline-none"
                  style={{ borderColor: "var(--hf-color-field-border)" }}
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
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-hf-black"
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
                className="hf-type-input w-full rounded-[8px] border bg-hf-cream p-3 outline-none"
                style={{ borderColor: "var(--hf-color-field-border)" }}
              />
            </label>
            {error && (
              <p role="alert" className="hf-type-caption text-hf-red-dark">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={sending}
              className="hf-btn-primary h-12 w-full disabled:opacity-50"
            >
              {sending ? t("settings.support.contactSending") : t("settings.support.contactSend")}
            </button>
          </form>
        )}
      </div>
    </HfScreen>
  );
}
