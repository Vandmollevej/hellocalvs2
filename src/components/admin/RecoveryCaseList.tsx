"use client";

import { useCallback, useEffect, useState } from "react";

type RecoveryCase = {
  id: string;
  caseCode: string;
  status: "PENDING" | "APPROVED";
  createdAt: string;
  expiresAt: string;
};

const dateFormat = new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "short" });

// Gendannelsessager (docs/PRIVACY.md "Gendannelse"). Support ser kun
// sagsnummer og tidspunkter. Identiteten bekræftes ved personlig kontakt:
// brugeren oplyser sagsnummer og e-mail, og e-mailen tjekkes mod sagen
// uden at blive gemt. Godkendelse frigiver Hello Cals nøglehalvdel i 24 timer.
export function RecoveryCaseList() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<Record<string, boolean | undefined>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/recovery", { cache: "no-store" });
    if (res.ok) setCases(((await res.json()) as { requests: RecoveryCase[] }).requests);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function post(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as { matches?: boolean; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Handlingen mislykkedes");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Handlingen mislykkedes");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function checkEmail(id: string) {
    const data = await post(id, { action: "check-email", email: emails[id] ?? "" });
    if (data) setMatches((m) => ({ ...m, [id]: Boolean(data.matches) }));
  }

  async function decide(id: string, action: "approve" | "reject") {
    const text = action === "approve" ? "Godkend sagen? Brugeren kan derefter åbne sine data." : "Afvis sagen?";
    if (!window.confirm(text)) return;
    if (await post(id, { action })) await load();
  }

  if (cases.length === 0) return <p className="text-sm text-text-muted">Ingen åbne gendannelsessager.</p>;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-hf-red-dark">{error}</p>}
      {cases.map((c) => (
        <div key={c.id} className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium tracking-wider text-text-primary">{c.caseCode}</p>
              <p className="text-xs text-text-muted">
                Oprettet {dateFormat.format(new Date(c.createdAt))} · udløber {dateFormat.format(new Date(c.expiresAt))}
              </p>
            </div>
            <span className="text-sm text-text-secondary">{c.status === "PENDING" ? "Afventer" : "Godkendt"}</span>
          </div>
          {c.status === "PENDING" && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="E-mail oplyst af brugeren"
                  value={emails[c.id] ?? ""}
                  onChange={(e) => setEmails((m) => ({ ...m, [c.id]: e.target.value }))}
                  className="min-w-0 flex-1 rounded-md border border-border-strong bg-surface-1 px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={busy === c.id || !emails[c.id]}
                  onClick={() => checkEmail(c.id)}
                  className="rounded-md border border-border-strong px-2.5 py-1.5 text-sm disabled:opacity-60"
                >
                  Tjek e-mail
                </button>
              </div>
              {matches[c.id] !== undefined && (
                <p className={`text-sm ${matches[c.id] ? "text-hf-green-dark" : "text-hf-red-dark"}`}>
                  {matches[c.id] ? "E-mailen passer til sagen." : "E-mailen passer IKKE til sagen."}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === c.id || !matches[c.id]}
                  onClick={() => decide(c.id, "approve")}
                  className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
                >
                  Godkend
                </button>
                <button
                  type="button"
                  disabled={busy === c.id}
                  onClick={() => decide(c.id, "reject")}
                  className="rounded-md border border-border-strong px-2.5 py-1.5 text-sm text-hf-red-dark disabled:opacity-60"
                >
                  Afvis
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
