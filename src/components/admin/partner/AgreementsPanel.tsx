"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/admin/PartnerManagers";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";
import type { AgreementUsage } from "@/lib/partner-performance";
import { INPUT, LABEL, dateDa, dkk, isoDate, BTN, PRIMARY } from "@/components/admin/partner/ui";

// Sponsoraftaler: aktive aftaler øverst med budget og forbrug (forbrug =
// visninger/1000 × CPM + klik × CPC siden aftalens start).
type Draft = { id?: string; title: string; startsAt: string; endsAt: string; active: boolean; budgetDkk: string; cpmDkk: string; cpcDkk: string; notes: string };

const emptyDraft = (): Draft => ({
  title: "",
  startsAt: new Date().toISOString().slice(0, 10),
  endsAt: "",
  active: true,
  budgetDkk: "",
  cpmDkk: "",
  cpcDkk: "",
  notes: "",
});

function UsageBar({ spent, budget }: { spent: number; budget: number }) {
  const ratio = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const over = budget > 0 && spent >= budget;
  return (
    <div className="flex flex-col gap-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-hf-tan" role="progressbar" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={Math.round(spent)}>
        <div className={`h-full rounded-full ${over ? "bg-hf-red-dark" : "bg-hf-green-dark"}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <div className="hf-type-small flex justify-between text-text-secondary">
        <span>Forbrug {dkk(spent)}</span>
        <span>Budget {dkk(budget)}</span>
      </div>
    </div>
  );
}

export function AgreementsPanel({ partnerId, agreements }: { partnerId: string; agreements: AgreementUsage[] }) {
  const router = useRouter();
  const { ask, sheet } = useConfirmSheet();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = agreements.filter((a) => a.isCurrent);
  const others = agreements.filter((a) => !a.isCurrent);

  async function execute(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await postJson("/api/admin/partners", body);
    setBusy(false);
    if (!res.ok) {
      setError(res.data.message ?? "Noget gik galt");
      return false;
    }
    router.refresh();
    return true;
  }

  // Med confirmText vises en bekræftelse som bundark (ikke window.confirm).
  async function run(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText) {
      ask(confirmText, () => void execute(body));
      return false;
    }
    return execute(body);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const ok = await run({ action: draft.id ? "updateAgreement" : "createAgreement", partnerId, ...draft });
    if (ok) setDraft(null);
  }

  const edit = (a: AgreementUsage) =>
    setDraft({
      id: a.id,
      title: a.title,
      startsAt: isoDate(a.startsAt),
      endsAt: isoDate(a.endsAt),
      active: a.active,
      budgetDkk: String(a.budgetDkk),
      cpmDkk: String(a.cpmDkk),
      cpcDkk: String(a.cpcDkk),
      notes: a.notes,
    });
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d));

  const card = (a: AgreementUsage) => (
    <div key={a.id} className="hf-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="hf-type-title text-hf-black">{a.title}</h3>
          <p className="hf-type-small text-text-secondary">
            {dateDa(a.startsAt)} – {a.endsAt ? dateDa(a.endsAt) : "løbende"} · {a.spotCount} reklamespot{a.spotCount === 1 ? "" : "s"}
            {!a.active && " · inaktiv"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="hf-type-small text-text-secondary hover:underline" onClick={() => edit(a)}>Redigér</button>
          <button className="hf-type-small text-text-secondary hover:underline" disabled={busy} onClick={() => run({ action: "deleteAgreement", id: a.id }, `Slet aftalen "${a.title}"? Spots beholdes, men mister aftalen.`)}>Slet</button>
        </div>
      </div>
      {a.budgetDkk > 0 ? <UsageBar spent={a.spentDkk} budget={a.budgetDkk} /> : <p className="hf-type-small text-text-muted">Intet budget angivet. Forbrug {dkk(a.spentDkk)}.</p>}
      <p className="hf-type-small text-text-secondary">
        {a.impressions.toLocaleString("da-DK")} visninger · {a.clicks.toLocaleString("da-DK")} klik · CPM {dkk(a.cpmDkk)} · CPC {dkk(a.cpcDkk)}
      </p>
      {a.notes && <p className="hf-type-small text-text-secondary">{a.notes}</p>}
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      {sheet}
      <div className="flex items-center justify-between gap-2">
        <h3 className="hf-type-title text-hf-black">Aktive aftaler</h3>
        {!draft && <button className={BTN} onClick={() => setDraft(emptyDraft())}>Ny aftale</button>}
      </div>
      {error && <p className="hf-type-small text-red-700">{error}</p>}
      {draft && (
        <form className="hf-panel" onSubmit={save}>
          <h3 className="hf-type-title">{draft.id ? "Redigér aftale" : "Ny aftale"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Titel</span><input className={INPUT} value={draft.title} onChange={set("title")} required /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Start</span><input className={INPUT} type="date" value={draft.startsAt} onChange={set("startsAt")} required /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Slut (tom = løbende)</span><input className={INPUT} type="date" value={draft.endsAt} onChange={set("endsAt")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Budget (kr.)</span><input className={INPUT} inputMode="numeric" value={draft.budgetDkk} onChange={set("budgetDkk")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Pris pr. 1.000 visninger (kr.)</span><input className={INPUT} inputMode="decimal" value={draft.cpmDkk} onChange={set("cpmDkk")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Pris pr. klik (kr.)</span><input className={INPUT} inputMode="decimal" value={draft.cpcDkk} onChange={set("cpcDkk")} /></label>
            <label className="hf-type-body flex items-center gap-2 self-end pb-2">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => (d ? { ...d, active: e.target.checked } : d))} /> Aktiv
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Noter</span><textarea className={`${INPUT} h-20 py-2`} value={draft.notes} onChange={set("notes")} /></label>
          </div>
          <div className="flex gap-2">
            <button className={PRIMARY} disabled={busy || !draft.title.trim()}>Gem</button>
            <button type="button" className={BTN} onClick={() => setDraft(null)}>Fortryd</button>
          </div>
        </form>
      )}
      {current.length === 0 && !draft && <p className="hf-type-body text-text-secondary">Ingen aktive aftaler lige nu.</p>}
      {current.map(card)}
      {others.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="hf-type-body cursor-pointer text-text-secondary">Tidligere og inaktive aftaler ({others.length})</summary>
          <div className="mt-3 flex flex-col gap-3">{others.map(card)}</div>
        </details>
      )}
    </section>
  );
}
