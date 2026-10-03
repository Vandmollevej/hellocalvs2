"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/admin/PartnerManagers";
import { INPUT, LABEL, PRIMARY } from "@/components/admin/partner/ui";

// Faktureringsdetaljer og betalingsmetode (docs/DECISIONS.md 2026-10-02).
// Begge sider gemmer via samme handling og sender derfor alle felter, så den
// ene side aldrig nulstiller den andens værdier.
export type BillingValues = {
  billingName: string;
  billingEmail: string;
  billingAddress: string;
  ean: string;
  billingReference: string;
  paymentTermsDays: string;
  paymentMethod: "INVOICE" | "BANK_TRANSFER" | "CARD" | "MOBILEPAY";
  paymentNote: string;
};

export const PAYMENT_METHOD_LABELS: Record<BillingValues["paymentMethod"], string> = {
  INVOICE: "Faktura (netto)",
  BANK_TRANSFER: "Bankoverførsel",
  CARD: "Betalingskort",
  MOBILEPAY: "MobilePay",
};

export function BillingForm({ partnerId, values, mode, canEdit }: { partnerId: string; values: BillingValues; mode: "billing" | "payment"; canEdit: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (key: keyof BillingValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [key]: e.target.value }));
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson("/api/admin/partners", { action: "updateBilling", id: partnerId, ...draft });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.message ?? "Noget gik galt");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="hf-panel max-w-2xl" onSubmit={save}>
      <fieldset disabled={!canEdit || busy} className="grid gap-3 sm:grid-cols-2">
        {mode === "billing" ? (
          <>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Faktureres til (navn)</span><input className={INPUT} value={draft.billingName} onChange={set("billingName")} /></label>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Fakturaadresse</span><input className={INPUT} value={draft.billingAddress} onChange={set("billingAddress")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Faktura-e-mail</span><input className={INPUT} type="email" value={draft.billingEmail} onChange={set("billingEmail")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>EAN-nummer</span><input className={INPUT} inputMode="numeric" value={draft.ean} onChange={set("ean")} /></label>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Reference / PO-nummer</span><input className={INPUT} value={draft.billingReference} onChange={set("billingReference")} /></label>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Betalingsmetode</span>
              <select className={INPUT} value={draft.paymentMethod} onChange={set("paymentMethod")}>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Betalingsfrist (dage)</span><input className={INPUT} inputMode="numeric" value={draft.paymentTermsDays} onChange={set("paymentTermsDays")} /></label>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Note</span><textarea className={`${INPUT} h-24 py-2`} value={draft.paymentNote} onChange={set("paymentNote")} /></label>
          </>
        )}
      </fieldset>
      {error && <p className="hf-type-small text-red-700">{error}</p>}
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button className={PRIMARY} disabled={busy}>Gem</button>
          {saved && <span className="hf-type-small text-text-secondary">Gemt</span>}
        </div>
      ) : (
        <p className="hf-type-small text-text-muted">Læseadgang: kun administratorer kan redigere.</p>
      )}
    </form>
  );
}
