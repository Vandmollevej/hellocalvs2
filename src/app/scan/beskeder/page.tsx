"use client";

import { useEffect, useState } from "react";
import { ScanScreen } from "@/components/scan/ScanScreen";
import { ActionButton } from "@/components/hf/ActionButton";

// Tovejs beskeder mellem medarbejder og Hello Cal (også "Kontakt").
type Message = { id: string; body: string; fromAdmin: boolean; createdAt: string };

export default function ScanBeskederPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/scan/messages")
      .then((res) => (res.ok ? res.json() : { messages: [] }))
      .then((data: { messages: Message[] }) => setMessages(data.messages))
      .catch(() => {});
  }, []);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    const response = await fetch("/api/scan/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft }),
    });
    if (response.ok) {
      const data = (await response.json()) as { message: Message };
      setMessages((prev) => [...prev, data.message]);
      setDraft("");
    }
    setSending(false);
  }

  return (
    <ScanScreen
      title="Beskeder"
      showBack
      footer={
        <form onSubmit={send} className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={2}
            placeholder="Skriv til Hello Cal"
            className="hf-type-input w-full border bg-hf-cream px-4 py-3 outline-none border-hf-field-border rounded-card"
          />
          <ActionButton type="submit" disabled={sending || !draft.trim()} className="hf-control disabled:opacity-40">
            <span className="hf-type-button">Send</span>
          </ActionButton>
        </form>
      }
    >
      <ul className="flex flex-col gap-3 p-4">
        {messages.length === 0 && (
          <li className="hf-type-body text-center text-hf-text-secondary">
            Ingen beskeder endnu. Skriv, hvis du har spørgsmål.
          </li>
        )}
        {messages.map((message) => (
          <li
            key={message.id}
            className={`rounded-card hf-type-body max-w-[80%] px-4 py-2 ${message.fromAdmin ? "self-start" : "self-end"}`}
            style={
              message.fromAdmin
                ? { background: "var(--hf-color-card)" }
                : { background: "var(--hf-color-brand)", color: "var(--hf-color-white)" }
            }
          >
            {message.body}
            <span className="hf-type-caption block text-inherit">
              {new Date(message.createdAt).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </li>
        ))}
      </ul>
    </ScanScreen>
  );
}
