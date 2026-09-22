"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";

type Message = {
  id: string;
  event: string;
  subject: string | null;
  bodyHtml: string | null;
  createdAt: string;
  readAt: string | null;
};

export default function MessagesPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    fetch("/api/messages")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setMessages(data.messages);
      });
  }, []);

  function markRead(id: string) {
    setMessages((prev) =>
      prev ? prev.map((m) => (m.id === id ? { ...m, readAt: new Date().toISOString() } : m)) : prev
    );
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  function markAllRead() {
    setMessages((prev) => (prev ? prev.map((m) => ({ ...m, readAt: m.readAt ?? new Date().toISOString() })) : prev));
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
  }

  const hasUnread = !!messages?.some((m) => !m.readAt);

  return (
    <HfScreen title={t("profile.messages.title")}>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-8">
        {hasUnread && (
          <button
            type="button"
            onClick={markAllRead}
            className="hf-type-body-sm self-end font-semibold underline"
          >
            {t("profile.messages.markAllRead")}
          </button>
        )}

        {!messages ? (
          <p className="hf-type-body-sm opacity-70">{t("profile.loading")}</p>
        ) : messages.length === 0 ? (
          <p className="hf-type-body-sm opacity-70">{t("profile.messages.empty")}</p>
        ) : (
          messages.map((message) => (
            <button
              key={message.id}
              type="button"
              onClick={() => markRead(message.id)}
              className="rounded-[8px] bg-hf-tan p-4 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="hf-type-body-sm font-bold">{message.subject}</p>
                {!message.readAt && (
                  <span
                    className="mt-1 h-2.5 w-2.5 flex-none rounded-full"
                    style={{ background: "var(--hf-black)" }}
                    aria-hidden="true"
                  />
                )}
              </div>
              {message.bodyHtml && (
                <div
                  className="hf-type-caption mt-2 opacity-80"
                  dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                />
              )}
              <p className="hf-type-caption mt-2 opacity-50">
                {new Date(message.createdAt).toLocaleString()}
              </p>
            </button>
          ))
        )}
      </div>
    </HfScreen>
  );
}
