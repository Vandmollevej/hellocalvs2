"use client";

import { useEffect, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { SwipeableRow } from "@/components/SwipeableRow";

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
  const [showDeleted, setShowDeleted] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(showDeleted ? "/api/messages?deleted=1" : "/api/messages")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setMessages(data.messages);
      });
    return () => {
      cancelled = true;
    };
  }, [showDeleted]);

  function toggleDeleted() {
    setMessages(null);
    setShowDeleted((value) => !value);
  }

  function deleteMessage(id: string) {
    setMessages((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
    fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delete: true }),
    }).catch(() => {});
  }

  function clearAll() {
    setMessages([]);
    fetch("/api/messages", { method: "DELETE" }).catch(() => {});
  }

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
      <div className="hf-page">
        <div className="flex items-center justify-between">
          <button type="button" onClick={toggleDeleted} className="hf-btn-text">
            {showDeleted ? t("profile.messages.inbox") : t("profile.messages.deleted")}
          </button>
          {showDeleted ? (
            messages && messages.length > 0 && (
              <button type="button" onClick={() => setConfirmClear(true)} className="hf-btn-text">
                {t("profile.messages.clearAll")}
              </button>
            )
          ) : (
            hasUnread && (
              <button type="button" onClick={markAllRead} className="hf-btn-text">
                {t("profile.messages.markAllRead")}
              </button>
            )
          )}
        </div>

        {!messages ? (
          <SkeletonScreen className="contents">
            <SkeletonCards count={4} height={84} />
          </SkeletonScreen>
        ) : messages.length === 0 ? (
          <p className="text-text-secondary hf-type-body">
            {showDeleted ? t("profile.messages.emptyDeleted") : t("profile.messages.empty")}
          </p>
        ) : (
          messages.map((message) =>
            showDeleted ? (
              <div key={message.id}>
                <button
                  type="button"
                  onClick={() => markRead(message.id)}
                  className="block w-full rounded-[8px] bg-hf-tan p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="hf-type-body">{message.subject}</p>
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
                      className="text-text-secondary hf-type-caption mt-2"
                      dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                    />
                  )}
                  <p className="text-text-secondary hf-type-caption mt-2">
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </button>
              </div>
            ) : (
              <SwipeableRow
                key={message.id}
                deleteStyle="pill"
                surfaceClassName="bg-transparent"
                onDelete={() => deleteMessage(message.id)}
              >
              <button
                type="button"
                onClick={() => markRead(message.id)}
                className="block w-full rounded-[8px] bg-hf-tan p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="hf-type-body">{message.subject}</p>
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
                    className="text-text-secondary hf-type-caption mt-2"
                    dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                  />
                )}
                <p className="text-text-secondary hf-type-caption mt-2">
                  {new Date(message.createdAt).toLocaleString()}
                </p>
              </button>
              </SwipeableRow>
            )
          )
        )}
      </div>
      {confirmClear && (
        <BottomSheet
          title={t("profile.messages.clearTitle")}
          onClose={() => setConfirmClear(false)}
          footer={
            <div className="flex flex-col gap-3">
              <BottomSheetCloseButton onClick={clearAll} className="hf-control hf-btn-danger w-full px-4">
                {t("profile.messages.clearConfirm")}
              </BottomSheetCloseButton>
              <BottomSheetCloseButton className="hf-control hf-btn-secondary w-full px-4">
                {t("profile.messages.cancel")}
              </BottomSheetCloseButton>
            </div>
          }
        >
          <p className="hf-type-body text-text-secondary">{t("profile.messages.clearBody")}</p>
        </BottomSheet>
      )}
    </HfScreen>
  );
}
