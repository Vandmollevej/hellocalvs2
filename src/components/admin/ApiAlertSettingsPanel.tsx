"use client";

import { useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import type { AlertSettings } from "@/lib/api-alerts";

// Admin → API-forbrug → Varsler: til/fra og modtagerlisten. Jobbet
// `api-alerts` (admin → Cron-jobs) sender mails ud fra disse indstillinger.
export function ApiAlertSettingsPanel({ initial }: { initial: AlertSettings }) {
  const [settings, setSettings] = useState(initial);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function save(next: AlertSettings) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/api-usage/alerts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await res.json().catch(() => ({}))) as AlertSettings & { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
      setSettings(data);
      return data;
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Kunne ikke gemme" });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function addEmail(event: React.FormEvent) {
    event.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;
    const saved = await save({ ...settings, emails: [...settings.emails, email] });
    if (saved && !saved.emails.includes(email)) {
      setMessage({ tone: "error", text: "Adressen er ikke gyldig." });
    } else if (saved) {
      setNewEmail("");
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/api-usage/alerts", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { sent?: number; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Testmailen kunne ikke sendes");
      setMessage({ tone: "ok", text: `Testmail sendt til ${data.sent} ${data.sent === 1 ? "modtager" : "modtagere"}.` });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Testmailen kunne ikke sendes" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hf-panel">
      <h2 className="hf-type-strong text-hf-black">Varsler</h2>
      <Toggle
        checked={settings.enabled}
        disabled={busy}
        onChange={(enabled) => void save({ ...settings, enabled })}
        label="Send varsler på mail"
        description="Når en tjeneste fejler, OpenAI-kreditten er lav, eller månedens budget når 80 % eller 100 %. Hvert varsel sendes kun én gang."
      />

      <div className="flex flex-col gap-2">
        <p className="hf-type-caption">Modtagere</p>
        {settings.emails.length === 0 ? (
          <p className="hf-type-small text-text-muted">Ingen modtagere endnu — tilføj en mailadresse.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-strong">
            {settings.emails.map((email) => (
              <li key={email} className="flex items-center justify-between gap-3 py-2">
                <span className="hf-type-body truncate text-hf-black">{email}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save({ ...settings, emails: settings.emails.filter((e) => e !== email) })}
                  className="hf-btn-text text-hf-red-dark"
                >
                  Fjern
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={addEmail} className="flex flex-wrap gap-2">
          <input
            type="email"
            className="hf-input min-w-0 flex-1"
            placeholder="navn@firma.dk"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <button type="submit" disabled={busy || !newEmail.trim()} className="hf-btn-brand hf-btn--inline">
            Tilføj
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={sendTest} disabled={busy || settings.emails.length === 0} className="hf-btn-secondary hf-btn--inline hf-btn--compact">
          Send testmail
        </button>
        {message && (
          <p className={`hf-type-small ${message.tone === "ok" ? "text-hf-green-dark" : "text-hf-red-dark"}`}>{message.text}</p>
        )}
      </div>
    </section>
  );
}
