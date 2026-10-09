"use client";

import { useEffect, useRef, useState } from "react";
import { HfScreen } from "@/components/HfScreen";
import { BottomSheet, BottomSheetCloseButton } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import { SkeletonCards, SkeletonScreen } from "@/components/hf/Skeleton";

type Message = {
  id: string;
  event: string;
  subject: string | null;
  bodyHtml: string | null;
  createdAt: string;
  readAt: string | null;
};

const DELETE_WIDTH = 88;

// Swipe til venstre viser "Slet" som en rød knap midt for beskeden (ikke i
// hele rækkens højde). Kun vandret træk fanges; lodret scroll går igennem.
function SwipeToDelete({
  label,
  onDelete,
  children,
}: {
  label: string;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);

  return (
    <div className="relative overflow-hidden rounded-card">
      <div className="absolute inset-y-0 right-0 flex items-center justify-center" style={{ width: DELETE_WIDTH }}>
        <button
          type="button"
          onClick={onDelete}
          className="hf-type-small hf-type-strong rounded-full bg-hf-red-dark px-4 py-2 text-hf-white"
        >
          {label}
        </button>
      </div>
      <div
        className="relative touch-pan-y"
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 150ms" }}
        onPointerDown={(event) => {
          startX.current = event.clientX;
          startOffset.current = dragX;
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (startX.current === null) return;
          setDragX(Math.max(-DELETE_WIDTH, Math.min(0, startOffset.current + event.clientX - startX.current)));
        }}
        onPointerUp={() => {
          startX.current = null;
          setDragging(false);
          setDragX((x) => (x < -DELETE_WIDTH / 2 ? -DELETE_WIDTH : 0));
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDragging(false);
          setDragX(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [deletedView, setDeletedView] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/messages${deletedView ? "?view=deleted" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && !cancelled) setMessages(data.messages);
      });
    return () => {
      cancelled = true;
    };
  }, [deletedView]);

  function toggleDeletedView() {
    setMessages(null);
    setDeletedView((value) => !value);
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

  const hasUnread = !!messages?.some((m) => !m.readAt);

  return (
    <HfScreen title={t("profile.messages.title")}>
      <div className="hf-page">
        <div className="flex items-center justify-between">
          <button type="button" onClick={toggleDeletedView} className="hf-btn-text">
            {deletedView ? t("profile.messages.title") : t("profile.messages.deleted")}
          </button>
          {deletedView ? (
            !!messages?.length && (
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
            {deletedView ? t("profile.messages.emptyDeleted") : t("profile.messages.empty")}
          </p>
        ) : (
          messages.map((message) => {
            const card = (
              <button
                type="button"
                onClick={() => markRead(message.id)}
                className="w-full bg-hf-tan p-4 text-left rounded-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="hf-type-body">{message.subject}</p>
                  {!message.readAt && (
                    <span className="text-text-secondary hf-type-caption flex-none">{t("profile.messages.unread")}</span>
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
            );
            return deletedView ? (
              <div key={message.id}>{card}</div>
            ) : (
              <SwipeToDelete key={message.id} label={t("profile.messages.delete")} onDelete={() => deleteMessage(message.id)}>
                {card}
              </SwipeToDelete>
            );
          })
        )}
      </div>

      {confirmClear && (
        <BottomSheet ariaLabel={t("profile.messages.clearAll")} onClose={() => setConfirmClear(false)}>
          <div className="flex flex-col gap-3 p-4">
            <p className="hf-type-body">{t("profile.messages.clearAllWarning")}</p>
            <BottomSheetCloseButton onClick={clearAll} className="hf-control hf-btn-primary w-full px-4">
              {t("profile.messages.clearAll")}
            </BottomSheetCloseButton>
          </div>
        </BottomSheet>
      )}
    </HfScreen>
  );
}
