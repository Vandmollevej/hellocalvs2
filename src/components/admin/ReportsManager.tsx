"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/admin/PartnerManagers";

// Admin "Rapporter" (docs/DECISIONS.md 2026-09-29). Vælg partnere → "Opret
// rapport" → bekræftelse, der viser præcis hvilken partners data der går til
// hvilke e-mailadresser. Hver partner sendes for sig, kun til egne kontakter.
export type ReportPartner = {
  id: string;
  name: string;
  recipients: { name: string; email: string }[];
  schedules: { id: string; frequency: "WEEKLY" | "MONTHLY"; enabled: boolean; nextRunAt: string; lastSentAt: string | null }[];
};

const BTN = "hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 text-text-secondary hover:bg-hf-tan disabled:opacity-50";
const PRIMARY = "hf-type-small rounded-md bg-hf-black px-3 py-1.5 text-hf-white disabled:opacity-50";
const FREQ_LABEL = { WEEKLY: "Ugentligt", MONTHLY: "Månedligt" } as const;
const fmt = (iso: string) => new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });

export function ReportsManager({ partners }: { partners: ReportPartner[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"push" | "schedule">("push");
  const [days, setDays] = useState(30);
  const [frequency, setFrequency] = useState<"WEEKLY" | "MONTHLY">("MONTHLY");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const chosen = partners.filter((p) => selected.includes(p.id));
  const blocked = chosen.filter((p) => p.recipients.length === 0);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  async function execute() {
    setBusy(true);
    const out: string[] = [];
    for (const partner of chosen) {
      if (mode === "push") {
        const res = await postJson("/api/admin/reports", {
          action: "send",
          partnerId: partner.id,
          days,
          confirmEmails: partner.recipients.map((r) => r.email),
        });
        const d = res.data as { sent?: number; failed?: number; message?: string };
        out.push(res.ok ? `${partner.name}: sendt til ${d.sent} modtager(e)${d.failed ? `, ${d.failed} fejlede` : ""}` : `${partner.name}: ${d.message ?? "fejlede"}`);
      } else {
        const res = await postJson("/api/admin/reports", { action: "createSchedule", partnerId: partner.id, frequency });
        out.push(res.ok ? `${partner.name}: ${FREQ_LABEL[frequency].toLowerCase()} rapport sat op` : `${partner.name}: ${res.data.message ?? "fejlede"}`);
      }
    }
    setBusy(false);
    setConfirming(false);
    setResults(out);
    setSelected([]);
    router.refresh();
  }

  async function scheduleAction(body: Record<string, unknown>) {
    await postJson("/api/admin/reports", body);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 hf-surface p-4">
        <p className="hf-type-strong text-hf-black">Vælg partnere</p>
        {partners.length === 0 && <p className="hf-type-body text-text-secondary">Ingen partnere endnu — opret dem under Partnere → Kontakter.</p>}
        {partners.map((p) => (
          <div key={p.id} className="flex flex-col gap-1 border-t border-hf-tan-dark pt-2 first:border-t-0 first:pt-0">
            <label className="hf-type-body flex items-center gap-2 text-hf-black">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              {p.name}
              <span className="hf-type-small text-text-muted">
                {p.recipients.length === 0 ? "· ingen aktive kontakter" : `· ${p.recipients.map((r) => r.email).join(", ")}`}
              </span>
            </label>
            {p.schedules.map((s) => (
              <div key={s.id} className="hf-type-small ml-6 flex flex-wrap items-center gap-2 text-text-secondary">
                <span>
                  {FREQ_LABEL[s.frequency]} · {s.enabled ? `næste ${fmt(s.nextRunAt)}` : "pauset"}
                  {s.lastSentAt ? ` · sidst ${fmt(s.lastSentAt)}` : ""}
                </span>
                <button className={BTN} onClick={() => scheduleAction({ action: "toggleSchedule", id: s.id, enabled: !s.enabled })}>
                  {s.enabled ? "Pause" : "Genoptag"}
                </button>
                <button className={BTN} onClick={() => window.confirm("Fjern intervalrapporten?") && scheduleAction({ action: "deleteSchedule", id: s.id })}>
                  Fjern
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="hf-type-body flex items-center gap-2">
          <input type="radio" checked={mode === "push"} onChange={() => setMode("push")} /> Send nu
        </label>
        {mode === "push" && (
          <select className="hf-type-body h-10 rounded-md border border-hf-tan-dark bg-hf-white px-3" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Seneste 7 dage</option>
            <option value={30}>Seneste 30 dage</option>
            <option value={90}>Seneste 90 dage</option>
          </select>
        )}
        <label className="hf-type-body flex items-center gap-2">
          <input type="radio" checked={mode === "schedule"} onChange={() => setMode("schedule")} /> Sæt op til interval
        </label>
        {mode === "schedule" && (
          <select className="hf-type-body h-10 rounded-md border border-hf-tan-dark bg-hf-white px-3" value={frequency} onChange={(e) => setFrequency(e.target.value as "WEEKLY" | "MONTHLY")}>
            <option value="WEEKLY">Ugentligt</option>
            <option value="MONTHLY">Månedligt</option>
          </select>
        )}
        <button className={PRIMARY} disabled={chosen.length === 0 || blocked.length > 0} onClick={() => setConfirming(true)}>
          Opret rapport
        </button>
      </div>
      {blocked.length > 0 && (
        <p className="hf-type-small text-red-700">Ingen aktive kontakter hos: {blocked.map((p) => p.name).join(", ")}. Tilføj en kontakt eller fravælg partneren.</p>
      )}

      {results.length > 0 && (
        <ul className="hf-type-body hf-surface p-4">
          {results.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-lg bg-hf-white p-5">
            <p className="hf-type-strong text-hf-black">
              {mode === "push" ? "Bekræft afsendelse fra report@hellocal.io" : `Bekræft ${FREQ_LABEL[frequency].toLowerCase()} rapport`}
            </p>
            <p className="hf-type-small text-text-secondary">Hver partners tal sendes kun til den partners egne kontakter:</p>
            {chosen.map((p) => (
              <div key={p.id} className="rounded-md border border-hf-tan-dark p-3">
                <p className="hf-type-strong text-hf-black">{p.name}</p>
                <ul className="hf-type-body text-text-secondary">
                  {p.recipients.map((r) => (
                    <li key={r.email}>
                      {r.name} · {r.email}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button className={BTN} disabled={busy} onClick={() => setConfirming(false)}>Annullér</button>
              <button className={PRIMARY} disabled={busy} onClick={execute}>
                {busy ? "Sender…" : mode === "push" ? "Send rapport" : "Sæt op"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
