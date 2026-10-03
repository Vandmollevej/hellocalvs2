"use client";

import { useState } from "react";
import { postJson } from "@/components/admin/PartnerManagers";
import { INPUT, LABEL, BTN, PRIMARY } from "@/components/admin/partner/ui";

// Hent statistikken som PDF eller CSV, eller send den direkte til en
// indtastet modtager (navn + e-mail) som vedhæftet PDF og/eller CSV
// (docs/DECISIONS.md 2026-10-02). `query` er den valgte periode/filter.
export function ReportActions({ partnerId, query }: { partnerId: string; query: string }) {
  const base = `/api/admin/partners/${partnerId}/performance`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pdf, setPdf] = useState(true);
  const [csv, setCsv] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(query);
    setBusy(true);
    setMessage(null);
    const res = await postJson(base, {
      from: params.get("from"),
      to: params.get("to"),
      onlyTriggered: params.get("onlyTriggered") === "1",
      name,
      email,
      formats: [...(pdf ? ["pdf"] : []), ...(csv ? ["csv"] : [])],
    });
    setBusy(false);
    setMessage(res.ok ? { ok: true, text: `Rapporten er sendt til ${email}` } : { ok: false, text: res.data.message ?? "Rapporten kunne ikke sendes" });
    if (res.ok) {
      setName("");
      setEmail("");
    }
  }

  return (
    <section className="hf-panel">
      <h3 className="hf-type-title">Rapport</h3>
      <p className="hf-type-small text-text-secondary">Rapporten dækker den valgte periode og det valgte filter.</p>
      <div className="flex flex-wrap gap-2">
        <a className={BTN} href={`${base}?${query}&format=pdf`}>Hent PDF</a>
        <a className={BTN} href={`${base}?${query}&format=csv`}>Hent CSV</a>
        {!open && <button className={PRIMARY} onClick={() => setOpen(true)}>Send rapport</button>}
      </div>
      {open && (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={send}>
          <label className="flex flex-col gap-1"><span className={LABEL}>Modtagerens navn</span><input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>Modtagerens e-mail</span><input className={INPUT} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <div className="hf-type-body flex flex-wrap items-center gap-4 sm:col-span-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={pdf} onChange={(e) => setPdf(e.target.checked)} /> PDF</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={csv} onChange={(e) => setCsv(e.target.checked)} /> CSV</label>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button className={PRIMARY} disabled={busy || !name.trim() || !email.trim() || (!pdf && !csv)}>Send</button>
            <button type="button" className={BTN} onClick={() => { setOpen(false); setMessage(null); }}>Fortryd</button>
          </div>
        </form>
      )}
      {message && <p className={`hf-type-small ${message.ok ? "text-text-secondary" : "text-red-700"}`}>{message.text}</p>}
    </section>
  );
}
