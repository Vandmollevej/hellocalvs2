"use client";

import { useState } from "react";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";

const MAX_SUBJECT = 120;
const MAX_MESSAGE = 2000;

export function BroadcastPanel({ emailUsers, pushUsers }: { emailUsers: number; pushUsers: number }) {
  const { ask, sheet } = useConfirmSheet();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(true);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const canSend = subject.trim() && message.trim() && (email || push) && password && !busy;

  function send(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const targets = [email ? `${emailUsers} mails` : null, push ? `op til ${pushUsers} push` : null].filter(Boolean);
    ask(`Send "${subject.trim()}" til alle brugere (${targets.join(" og ")})? Det kan ikke fortrydes.`, () => void deliver());
  }

  async function deliver() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/admin/users/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, email, push, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; emails?: number; pushes?: number };
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke sende");
        return;
      }
      setDone(`Sendt: ${data.emails ?? 0} mails og ${data.pushes ?? 0} push er sat i gang.`);
      setSubject("");
      setMessage("");
    } finally {
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <div className="hf-surface p-4">
      {sheet}
      <button type="button" onClick={() => setOpen(!open)} className="hf-btn-text text-hf-black">
        {open ? "Luk" : "Send mail og push til alle brugere"}
      </button>
      {open && (
        <form onSubmit={send} className="mt-3 flex flex-col gap-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={MAX_SUBJECT}
            placeholder="Emne / push-titel"
            className="hf-input"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE}
            rows={6}
            placeholder="Besked (kun tekst — links og emojis virker)"
            className="hf-input"
          />
          <label className="hf-type-body flex items-center gap-2">
            <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} />
            Mail ({emailUsers} modtagere)
          </label>
          <label className="hf-type-body flex items-center gap-2">
            <input type="checkbox" checked={push} onChange={(e) => setPush(e.target.checked)} />
            Push ({pushUsers} brugere med push slået til)
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Din adgangskode (kræves ved hver udsendelse)"
            className="hf-input"
          />
          {error && <p className="hf-type-body text-red-700">{error}</p>}
          {done && <p className="hf-type-body text-hf-green">{done}</p>}
          <button
            type="submit"
            disabled={!canSend}
            className="hf-btn-primary hf-btn--compact hf-btn--inline"
          >
            {busy ? "Sender…" : "Send til alle"}
          </button>
        </form>
      )}
    </div>
  );
}
