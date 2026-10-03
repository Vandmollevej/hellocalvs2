"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Klientdele til admin Partnere → Kontakter/Reklamer (docs/DECISIONS.md 2026-09-29).
export async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: res.ok, status: res.status, data };
}

const INPUT = "hf-type-body h-10 rounded-md border border-hf-tan-dark bg-hf-white px-3";
const BTN = "hf-type-small rounded-md border border-hf-tan-dark px-3 py-1.5 text-text-secondary hover:bg-hf-tan disabled:opacity-50";
const PRIMARY = "hf-type-small rounded-md bg-hf-black px-3 py-1.5 text-hf-white disabled:opacity-50";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(body: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return false;
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
  return { busy, error, run };
}

type Contact = { id: string; name: string; email: string; active: boolean };
type PartnerWithContacts = { id: string; name: string; contacts: Contact[] };

export function ContactsManager({ partners }: { partners: PartnerWithContacts[] }) {
  const { busy, error, run } = useAction();
  const [partnerName, setPartnerName] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { name: string; email: string }>>({});

  return (
    <div className="flex flex-col gap-4">
      <p className="hf-type-body text-text-secondary">Åbn en partner for virksomhedsoplysninger, sponsoraftale, performance og fakturering.</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run({ action: "createPartner", name: partnerName })) setPartnerName("");
        }}
      >
        <input className={INPUT} placeholder="Ny partner" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
        <button className={PRIMARY} disabled={busy || !partnerName.trim()}>Opret partner</button>
      </form>
      {error && <p className="hf-type-small text-red-700">{error}</p>}
      {partners.length === 0 && <p className="hf-type-body text-text-secondary">Ingen partnere endnu.</p>}
      {partners.map((partner) => {
        const draft = drafts[partner.id] ?? { name: "", email: "" };
        return (
          <div key={partner.id} className="flex flex-col gap-3 hf-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/admin/partners/${partner.id}`} className="hf-type-strong text-hf-black hover:underline">{partner.name}</Link>
              <button
                className={BTN}
                disabled={busy}
                onClick={() => run({ action: "deletePartner", id: partner.id }, `Slet ${partner.name} med alle kontakter, lokationer og rapportplaner?`)}
              >
                Slet partner
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {partner.contacts.length === 0 && <li className="hf-type-small text-text-muted">Ingen kontakter.</li>}
              {partner.contacts.map((contact) => (
                <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`hf-type-body ${contact.active ? "text-hf-black" : "text-text-muted line-through"}`}>
                    {contact.name} · {contact.email}
                  </span>
                  <span className="flex gap-2">
                    <button className={BTN} disabled={busy} onClick={() => run({ action: "toggleContact", id: contact.id, active: !contact.active })}>
                      {contact.active ? "Deaktivér" : "Aktivér"}
                    </button>
                    <button className={BTN} disabled={busy} onClick={() => run({ action: "deleteContact", id: contact.id }, `Slet ${contact.name}?`)}>
                      Slet
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run({ action: "createContact", partnerId: partner.id, ...draft })) {
                  setDrafts((d) => ({ ...d, [partner.id]: { name: "", email: "" } }));
                }
              }}
            >
              <input className={INPUT} placeholder="Navn" value={draft.name} onChange={(e) => setDrafts((d) => ({ ...d, [partner.id]: { ...draft, name: e.target.value } }))} />
              <input className={INPUT} type="email" placeholder="E-mail" value={draft.email} onChange={(e) => setDrafts((d) => ({ ...d, [partner.id]: { ...draft, email: e.target.value } }))} />
              <button className={PRIMARY} disabled={busy || !draft.name.trim() || !draft.email.trim()}>Tilføj kontakt</button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

export function LocationForm({ partners }: { partners: { id: string; name: string }[] }) {
  const { busy, error, run } = useAction();
  const [partnerId, setPartnerId] = useState("");
  const [name, setName] = useState("");
  const [placement, setPlacement] = useState("");
  return (
    <form
      className="flex flex-wrap gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run({ action: "createLocation", partnerId, name, placement })) {
          setName("");
          setPlacement("");
        }
      }}
    >
      <select className={INPUT} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
        <option value="">Vælg partner</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <input className={INPUT} placeholder="Lokationsnavn" value={name} onChange={(e) => setName(e.target.value)} />
      <input className={INPUT} placeholder="Placering (fx Forside, banner)" value={placement} onChange={(e) => setPlacement(e.target.value)} />
      <button className={PRIMARY} disabled={busy || !partnerId || !name.trim()}>Opret lokation</button>
      {error && <p className="hf-type-small w-full text-red-700">{error}</p>}
    </form>
  );
}

export function DeleteLocationButton({ id, name }: { id: string; name: string }) {
  const { busy, run } = useAction();
  return (
    <button className={BTN} disabled={busy} onClick={() => run({ action: "deleteLocation", id }, `Slet lokationen ${name} og dens tal?`)}>
      Slet
    </button>
  );
}
