"use client";

import { useState } from "react";

const MAX_SUBJECT = 120;
const MAX_MESSAGE = 2000;

export function BroadcastPanel({ emailUsers, pushUsers }: { emailUsers: number; pushUsers: number }) {
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

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    const targets = [email ? `${emailUsers} mails` : null, push ? `op til ${pushUsers} push` : null].filter(Boolean);
    if (!confirm(`Send "${subject.trim()}" til alle brugere (${targets.join(" og ")})? Det kan ikke fortrydes.`)) return;
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
    <div className="rounded-xl border border-hf-tan-dark p-4">
      <button type="button" onClick={() => setOpen(!open)} className="hf-type-body font-bold text-hf-black">
        {open ? "Luk" : "Send mail og push til alle brugere"}
      </button>
      {open && (
        <form onSubmit={send} className="mt-3 flex flex-col gap-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={MAX_SUBJECT}
            placeholder="Emne / push-titel"
            className="hf-type-body rounded-lg border border-hf-tan-dark px-3 py-2"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE}
            rows={6}
            placeholder="Besked"
            className="hf-type-body rounded-lg border border-hf-tan-dark px-3 py-2"
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
            className="hf-type-body rounded-lg border border-hf-tan-dark px-3 py-2"
          />
          {error && <p className="hf-type-body text-red-700">{error}</p>}
          {done && <p className="hf-type-body text-hf-green">{done}</p>}
          <button
            type="submit"
            disabled={!canSend}
            className="hf-type-body rounded-lg bg-hf-black px-4 py-2 font-bold text-white disabled:opacity-40"
          >
            {busy ? "Sender…" : "Send til alle"}
          </button>
        </form>
      )}
    </div>
  );
}
