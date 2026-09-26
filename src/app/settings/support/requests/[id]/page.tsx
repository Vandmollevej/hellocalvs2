"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HfScreen } from "@/components/HfScreen";
import { SupportScreenshotPicker } from "@/components/SupportScreenshotPicker";
import { useTranslation } from "@/i18n/LocaleProvider";

type Thread = {
  id: string;
  subject: string;
  status: "OPEN" | "RESOLVED";
  awaitingReply: boolean;
  messages: {
    id: string;
    author: "USER" | "SUPPORT";
    body: string;
    createdAt: string;
    attachments: { id: string }[];
  }[];
};

// Én supporthenvendelse som samtale (docs/DECISIONS.md 2026-09-26
// "Support-indbakke"). Brugeren kan svare; en løst sag genåbnes da.
export default function SupportRequestThreadPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reply, setReply] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  const load = useCallback(() => {
    return fetch(`/api/support/requests/${id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
      .then((data: { request: Thread }) => setThread(data.request))
      .catch(() => setLoadError(true));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    setSendError(false);
    try {
      const response = await fetch(`/api/support/requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply, attachments: images }),
      });
      if (!response.ok) {
        setSendError(true);
        return;
      }
      setReply("");
      setImages([]);
      await load();
    } catch {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <HfScreen title={thread?.subject ?? t("settings.support.myRequests")}>
      <div className="flex flex-col gap-4 p-4 pb-8">
        {loadError && (
          <p role="alert" className="hf-type-caption text-hf-red-dark">
            {t("settings.support.requestsLoadError")}
          </p>
        )}
        {!thread && !loadError && <p className="hf-type-body opacity-70">{t("profile.loading")}</p>}
        {thread && (
          <>
            <p className="hf-type-caption opacity-60">
              {t("settings.support.caseLabel", { caseCode: thread.id.slice(-8).toUpperCase() })}
            </p>
            <ol className="flex flex-col gap-3">
              {thread.messages.map((message) => (
                <li
                  key={message.id}
                  className={`rounded-[8px] p-3 ${message.author === "USER" ? "ml-8 bg-hf-tan" : "mr-8 bg-hf-green-light"}`}
                >
                  <p className="hf-type-caption opacity-60">
                    {message.author === "USER" ? t("settings.support.threadYou") : t("settings.support.threadSupport")} ·{" "}
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                  <p className="hf-type-body mt-1 whitespace-pre-wrap">{message.body}</p>
                  {message.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={`/api/support/attachments/${attachment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-20 w-20 overflow-hidden rounded-[8px] bg-hf-cream"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- beskyttet route, ikke next/image */}
                          <img src={`/api/support/attachments/${attachment.id}`} alt="" className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>

            <form onSubmit={send} className="flex flex-col gap-3">
              {thread.status === "RESOLVED" && (
                <p className="hf-type-caption opacity-70">{t("settings.support.replyReopens")}</p>
              )}
              <label className="flex flex-col gap-1">
                <span className="hf-type-label">{t("settings.support.replyLabel")}</span>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  className="hf-type-input w-full rounded-[8px] border bg-hf-cream p-3 outline-none"
                  style={{ borderColor: "var(--hf-color-field-border)" }}
                />
              </label>
              <SupportScreenshotPicker images={images} onChange={setImages} disabled={sending} />
              {sendError && (
                <p role="alert" className="hf-type-caption text-hf-red-dark">
                  {t("settings.support.replyError")}
                </p>
              )}
              <button
                type="submit"
                disabled={sending || !reply.trim()}
                className="hf-btn-primary hf-type-button h-12 w-full disabled:opacity-50"
              >
                {sending ? t("settings.support.replySending") : t("settings.support.replySend")}
              </button>
            </form>
          </>
        )}
      </div>
    </HfScreen>
  );
}
