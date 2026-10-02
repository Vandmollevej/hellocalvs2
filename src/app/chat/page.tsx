"use client";

import { useEffect, useRef, useState } from "react";
import { IconSend } from "@tabler/icons-react";
import { HfScreen } from "@/components/HfScreen";
import { useTranslation } from "@/i18n/LocaleProvider";
import { mealShareBody } from "@/lib/meal-share";

// Chat afløser mikrofonen på desktop-versionen: beskrivelsen skrives i stedet
// for at tales og tolkes af samme endpoint som stemmesiden.
type ChatItem = {
  title: string;
  amountGrams: number;
  amountLabel: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  productId: string | null;
  /** Suggestions are only saved when the user presses their add button. */
  saved?: boolean;
};

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text?: string; items?: ChatItem[]; error?: boolean };

export default function ChatPage() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send() {
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    setBusy(true);
    setMessages((m) => [...m, { id: nextId.current++, role: "user", text: value }]);
    try {
      const res = await fetch("/api/ai/interpret-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();
      const items = (data.items ?? []) as ChatItem[];
      setMessages((m) => [
        ...m,
        items.length > 0
          ? { id: nextId.current++, role: "assistant", items }
          : { id: nextId.current++, role: "assistant", text: t("web.chatNothing") },
      ]);
    } catch {
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", text: t("web.chatError"), error: true }]);
    } finally {
      setBusy(false);
    }
  }

  // Saves the given suggestions of one assistant message (a single row, or
  // all unsaved rows) and marks those that succeeded as added. Nothing is
  // saved without the user asking for it (docs/AI.md).
  async function save(message: Message, indexes: number[]) {
    if (message.role !== "assistant" || !message.items || busySave) return;
    const toSave = indexes.filter((i) => message.items?.[i] && !message.items[i].saved);
    if (toSave.length === 0) return;
    setBusySave(true);
    const results = await Promise.all(
      toSave.map((i) => {
        const item = message.items![i];
        return fetch("/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(item.productId
              ? { productId: item.productId, amountGrams: item.amountGrams }
              : {
                  amountGrams: item.amountGrams,
                  titleSnapshot: item.title,
                  kcalSnapshot: item.kcal,
                  proteinSnapshot: item.protein,
                  carbsSnapshot: item.carbs,
                  fatSnapshot: item.fat,
                }),
            ...mealShareBody(),
          }),
        })
          .then((r) => r.ok)
          .catch(() => false);
      }),
    );
    const savedIndexes = new Set(toSave.filter((_, n) => results[n]));
    const ok = savedIndexes.size === toSave.length;
    setBusySave(false);
    setMessages((all) => [
      ...all.map((m) =>
        m.id === message.id && m.role === "assistant" && m.items
          ? { ...m, items: m.items.map((item, i) => (savedIndexes.has(i) ? { ...item, saved: true } : item)) }
          : m,
      ),
      ...(ok ? [] : [{ id: nextId.current++, role: "assistant" as const, text: t("web.chatSaveError"), error: true }]),
    ]);
  }

  return (
    <HfScreen
      title={t("web.chatTitle")}
      hideBackButton
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={t("web.chatPlaceholder")}
            aria-label={t("web.chatPlaceholder")}
            className="max-h-32 min-h-12 flex-1 resize-none rounded-lg border border-[var(--hf-color-field-border)] bg-white px-3 py-3 text-base outline-none focus:border-[var(--hf-color-field-focus)]"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            aria-label={t("web.chatSend")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--hf-color-action)] text-white transition hover:bg-[var(--hf-color-action-hover)] disabled:bg-[var(--hf-color-disabled)]"
          >
            <IconSend size={20} stroke={1.6} />
          </button>
        </form>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        {messages.length === 0 && (
          <p className="rounded-lg bg-hf-tan p-4 text-[15px] text-[var(--hf-color-text-secondary)]">{t("web.chatIntro")}</p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[85%] rounded-lg bg-hf-green px-4 py-2.5 text-[15px] text-white">
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className={`mr-auto max-w-[85%] rounded-lg bg-hf-tan px-4 py-2.5 text-[15px] ${m.error ? "text-hf-warning" : ""}`}
            >
              {m.text}
              {m.items && (
                <>
                  <p className="hf-type-small hf-type-strong mb-1 text-[var(--hf-color-text-secondary)]">{t("web.chatSuggested")}</p>
                  <ul className="flex flex-col gap-1">
                    {m.items.map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 flex-1">
                          {item.title} <span className="text-[var(--hf-color-text-secondary)]">{item.amountLabel}</span>
                        </span>
                        <span className="tabular-nums">{Math.round(item.kcal)} kcal</span>
                        {item.saved ? (
                          <span className="hf-type-small hf-type-strong shrink-0 text-[var(--hf-color-text-secondary)]">{t("web.chatSaved")}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void save(m, [i])}
                            disabled={busySave}
                            aria-label={`${t("web.chatAddOne")}: ${item.title}`}
                            className="hf-btn-secondary h-10 shrink-0 px-3"
                          >
                            {t("web.chatAddOne")}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {m.items.filter((item) => !item.saved).length > 1 && (
                    <button
                      type="button"
                      onClick={() => void save(m, m.items!.map((_, i) => i))}
                      disabled={busySave}
                      className="hf-btn-primary mt-3 h-12 w-full px-4"
                    >
                      {t("web.chatAddAll")}
                    </button>
                  )}
                </>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-sm text-[var(--hf-color-text-secondary)]">{t("web.chatThinking")}</p>}
        <div ref={endRef} />
      </div>
    </HfScreen>
  );
}
