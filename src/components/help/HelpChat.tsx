"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconSend } from "@tabler/icons-react";
import { BottomSheet } from "@/components/hf/BottomSheet";
import { useTranslation } from "@/i18n/LocaleProvider";
import { helpPagePath } from "@/i18n";
import { OPEN_HELP_CHAT_EVENT } from "@/lib/help-chat-events";
import { CHATBOT_LINKS, isChatbotLinkHref } from "@/lib/chatbot-knowledge";

// Hjælpe-chatten (docs/DECISIONS.md 2026-10-02): AI-chatbot med genveje til
// en medarbejder og kontaktformularen (ingen telefonsupport). Monteret én gang i
// layoutet og åbnet fra Support-siden via OPEN_HELP_CHAT_EVENT. Al logik
// (AI, kategorier, videresendelse) ligger på serveren i src/lib/chatbot.ts.

type MessageView = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  body: string;
  links: string[];
  needsHuman: boolean;
};

type ConversationView = {
  id: string;
  escalated: boolean;
  supportRequestId: string | null;
  caseCode: string | null;
  messages: MessageView[];
};

const SUGGESTION_KEYS = ["helpChat.suggestion1", "helpChat.suggestion2", "helpChat.suggestion3", "helpChat.suggestion4"];

function currentChannel() {
  return window.matchMedia("(min-width: 1024px)").matches ? "WEB" : "APP";
}

export function HelpChat() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_HELP_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HELP_CHAT_EVENT, onOpen);
  }, []);

  // Navigation (fx et link i et svar) lukker chatten.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  if (!open || pathname.startsWith("/admin")) return null;
  return <HelpChatSheet onClose={() => setOpen(false)} />;
}

function HelpChatSheet({ onClose }: { onClose: () => void }) {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggedOut, setLoggedOut] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [note, setNote] = useState("");
  const [sendingToSupport, setSendingToSupport] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chatbot", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          if (!cancelled) setLoggedOut(true);
          return;
        }
        if (!response.ok) throw new Error("failed");
        const data = (await response.json()) as { conversation: ConversationView | null };
        if (cancelled) return;
        setConversation(data.conversation);
      })
      .catch(() => {
        if (!cancelled) setError(t("helpChat.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation, pending, escalating]);

  const busy = pending !== null || sendingToSupport;
  const escalated = conversation?.escalated ?? false;

  const ask = useCallback(
    async (question: string) => {
      const value = question.trim();
      if (!value || pending !== null) return;
      setText("");
      setError(null);
      setEscalating(false);
      setPending(value);
      try {
        const response = await fetch("/api/chatbot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: value, channel: currentChannel() }),
        });
        if (response.status === 429) {
          setError(t("helpChat.rateLimited"));
          setText(value);
          return;
        }
        const data = (await response.json().catch(() => ({}))) as { conversation?: ConversationView };
        if (!response.ok || !data.conversation) throw new Error("failed");
        setConversation(data.conversation);
      } catch {
        setError(t("helpChat.sendError"));
        setText(value);
      } finally {
        setPending(null);
      }
    },
    [pending, t],
  );

  async function sendToSupport() {
    if (sendingToSupport) return;
    const hasQuestions = (conversation?.messages.length ?? 0) > 0;
    if (!hasQuestions && !note.trim()) return;
    setSendingToSupport(true);
    setError(null);
    try {
      const response = await fetch("/api/chatbot/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation?.escalated ? null : (conversation?.id ?? null),
          note,
          channel: currentChannel(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { conversation?: ConversationView };
      if (!response.ok || !data.conversation) throw new Error("failed");
      setConversation(data.conversation);
      setEscalating(false);
      setNote("");
    } catch {
      setError(t("helpChat.escalateError"));
    } finally {
      setSendingToSupport(false);
    }
  }

  function startNew() {
    setConversation(null);
    setEscalating(false);
    setError(null);
  }

  function go(href: string) {
    onClose();
    router.push(href);
  }

  const messages = conversation?.messages ?? [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === "ASSISTANT");
  const offerHuman = !escalated && !escalating && Boolean(lastAssistant?.needsHuman) && messages.at(-1)?.id === lastAssistant?.id;
  const linkLabel = (href: string) =>
    isChatbotLinkHref(href) ? CHATBOT_LINKS[href][locale === "da" ? "da" : "en"] : href;

  const footer = loggedOut ? null : escalated ? (
    <button type="button" className="hf-btn-primary h-12 w-full" onClick={startNew}>
      {t("helpChat.newConversation")}
    </button>
  ) : (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void ask(text);
      }}
      className="flex items-end gap-2"
    >
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void ask(text);
          }
        }}
        rows={1}
        maxLength={1000}
        placeholder={t("helpChat.placeholder")}
        aria-label={t("helpChat.placeholder")}
        disabled={loading}
        className="hf-type-input max-h-32 min-h-12 flex-1 resize-none rounded-[8px] border bg-hf-white px-3 py-3 outline-none"
        style={{ borderColor: "var(--hf-color-field-border)" }}
      />
      <button
        type="submit"
        disabled={busy || loading || !text.trim()}
        aria-label={t("helpChat.send")}
        className="hf-btn-primary flex h-12 w-12 shrink-0 items-center justify-center"
      >
        <IconSend size={20} stroke={1.6} />
      </button>
    </form>
  );

  return (
    <BottomSheet onClose={onClose} title={t("helpChat.title")} size="full" footer={footer}>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {loggedOut ? (
          <div className="flex flex-col gap-2 rounded-lg bg-hf-tan p-4">
            <p className="hf-type-body">{t("helpChat.loggedOut")}</p>
            <a href={helpPagePath(locale)} className="hf-btn-text self-start">
              {t("helpChat.helpCentre")}
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-3" aria-live="polite">
            <Bubble role="ASSISTANT">{t("helpChat.welcome")}</Bubble>
            {messages.length === 0 && !loading && !pending && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTION_KEYS.map((key) => (
                  <button key={key} type="button" className="hf-choice px-3 py-2" onClick={() => void ask(t(key))}>
                    {t(key)}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message) =>
              message.role === "SYSTEM" ? (
                <div key={message.id} className="flex flex-col items-center gap-1 py-1 text-center">
                  <p className="hf-type-caption">{message.body}</p>
                  {conversation?.supportRequestId && (
                    <Link
                      href={`/settings/support/requests/${conversation.supportRequestId}`}
                      className="hf-btn-text"
                      onClick={onClose}
                    >
                      {t("helpChat.openCase")}
                    </Link>
                  )}
                </div>
              ) : (
                <Bubble key={message.id} role={message.role}>
                  {message.body}
                  {message.links.length > 0 && (
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {message.links.map((href) => (
                        <button key={href} type="button" className="hf-btn-text" onClick={() => go(href)}>
                          {linkLabel(href)}
                        </button>
                      ))}
                    </span>
                  )}
                </Bubble>
              ),
            )}

            {pending && <Bubble role="USER">{pending}</Bubble>}
            {pending && <p className="hf-type-caption">{t("helpChat.thinking")}</p>}

            {offerHuman && (
              <div className="flex flex-col gap-2 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
                <p className="hf-type-body">{t("helpChat.offerHuman")}</p>
                <button type="button" className="hf-btn-secondary h-12 w-full" onClick={() => setEscalating(true)}>
                  {t("helpChat.talkToHuman")}
                </button>
              </div>
            )}

            {escalating && !escalated && (
              <div className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
                <p className="hf-type-title">{t("helpChat.escalateTitle")}</p>
                <p className="hf-type-body text-text-secondary">
                  {messages.length > 0 ? t("helpChat.escalateIntro") : t("helpChat.escalateIntroEmpty")}
                </p>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  maxLength={5000}
                  placeholder={t("helpChat.notePlaceholder")}
                  aria-label={t("helpChat.notePlaceholder")}
                  className="hf-type-input resize-none rounded-[8px] border bg-hf-cream px-3 py-3 outline-none"
                  style={{ borderColor: "var(--hf-color-field-border)" }}
                />
                <button
                  type="button"
                  className="hf-btn-primary h-12 w-full"
                  disabled={sendingToSupport || (messages.length === 0 && !note.trim())}
                  onClick={() => void sendToSupport()}
                >
                  {sendingToSupport ? t("helpChat.sending") : t("helpChat.sendToSupport")}
                </button>
                <button type="button" className="hf-btn-text self-center" onClick={() => setEscalating(false)}>
                  {t("common.cancel")}
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="hf-type-body text-hf-red-dark">
                {error}
              </p>
            )}
            {!escalating && (
              <ContactOptions
                showTalkToHuman={!escalated && !offerHuman}
                disabled={busy}
                onTalkToHuman={() => {
                  setEscalating(true);
                  setError(null);
                }}
                onContactForm={() => go("/settings/support/contact")}
              />
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function Bubble({ role, children }: { role: "USER" | "ASSISTANT"; children: React.ReactNode }) {
  return role === "USER" ? (
    <div className="hf-type-body ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-hf-green px-4 py-2.5 text-hf-white">
      {children}
    </div>
  ) : (
    <div className="hf-type-body mr-auto flex max-w-[85%] flex-col whitespace-pre-wrap rounded-lg bg-hf-tan px-4 py-2.5 text-hf-black">
      {children}
    </div>
  );
}

// Kontaktvejene står diskret nederst i samtalen, aldrig i toppen
// (docs/DECISIONS.md 2026-10-03): chatbotten skal prøves først.
function ContactOptions({
  showTalkToHuman,
  disabled,
  onTalkToHuman,
  onContactForm,
}: {
  showTalkToHuman: boolean;
  disabled: boolean;
  onTalkToHuman: () => void;
  onContactForm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 pt-4">
      {showTalkToHuman && (
        <button type="button" className="hf-btn-text" onClick={onTalkToHuman} disabled={disabled}>
          {t("helpChat.talkToHuman")}
        </button>
      )}
      <button type="button" className="hf-btn-text" onClick={onContactForm}>
        {t("helpChat.contactForm")}
      </button>
    </div>
  );
}
