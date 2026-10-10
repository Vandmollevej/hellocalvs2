"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/admin/PartnerManagers";
import { BTN, PRIMARY } from "@/components/admin/partner/ui";

// Venstre bjælke på partnersiden (docs/DECISIONS.md 2026-10-02).
export type SidebarPartner = {
  id: string;
  name: string;
  cvr: string;
  addressStreet: string;
  addressZip: string;
  addressCity: string;
  phone: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  managerName: string;
  managerTitle: string;
  managerEmail: string;
};

const INPUT = "hf-type-body h-10 w-full rounded-md border border-hf-tan-dark bg-hf-white px-3";
const LABEL = "hf-type-caption";

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col">
      <span className={LABEL}>{label}</span>
      {value ? (
        href ? (
          <a href={href} className="hf-type-body break-words text-hf-black hover:underline">{value}</a>
        ) : (
          <span className="hf-type-body break-words text-hf-black">{value}</span>
        )
      ) : (
        <span className="hf-type-body text-text-muted">—</span>
      )}
    </div>
  );
}

function Menu({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/admin/partners/${id}`;
  const items = [
    { href: base, label: "Sponsoraftale", exact: true },
    { href: `${base}/performance`, label: "Performance" },
    { href: `${base}/billing`, label: "Faktureringsdetaljer" },
    { href: `${base}/payment`, label: "Betalingsmetode" },
  ];
  return (
    <nav aria-label="Partner" className="flex flex-col gap-1 border-t border-hf-tan-dark pt-4">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`hf-type-body rounded-md px-3 py-2 ${active ? "hf-type-strong hf-selected" : "text-text-secondary hover:bg-hf-tan"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PartnerSidebar({ partner, canEdit }: { partner: SidebarPartner; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(partner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof SidebarPartner) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson("/api/admin/partners", { action: "updatePartner", ...draft });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.message ?? "Noget gik galt");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const address = [partner.addressStreet, [partner.addressZip, partner.addressCity].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-72 hf-panel hf-panel--form">
      {editing ? (
        <form className="flex flex-col gap-3" onSubmit={save}>
          <label className="flex flex-col gap-1"><span className={LABEL}>Virksomhed</span><input className={INPUT} value={draft.name} onChange={set("name")} required /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>CVR</span><input className={INPUT} inputMode="numeric" value={draft.cvr} onChange={set("cvr")} /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>Adresse</span><input className={INPUT} value={draft.addressStreet} onChange={set("addressStreet")} /></label>
          <div className="flex gap-2">
            <label className="flex w-24 flex-col gap-1"><span className={LABEL}>Postnr.</span><input className={INPUT} value={draft.addressZip} onChange={set("addressZip")} /></label>
            <label className="flex min-w-0 flex-1 flex-col gap-1"><span className={LABEL}>By</span><input className={INPUT} value={draft.addressCity} onChange={set("addressCity")} /></label>
          </div>
          <label className="flex flex-col gap-1"><span className={LABEL}>Virksomhedens telefon</span><input className={INPUT} type="tel" value={draft.phone} onChange={set("phone")} /></label>
          <p className="hf-type-strong pt-1">Kontaktperson</p>
          <label className="flex flex-col gap-1"><span className={LABEL}>Navn</span><input className={INPUT} value={draft.contactName} onChange={set("contactName")} /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>E-mail</span><input className={INPUT} type="email" value={draft.contactEmail} onChange={set("contactEmail")} /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>Telefon</span><input className={INPUT} type="tel" value={draft.contactPhone} onChange={set("contactPhone")} /></label>
          <p className="hf-type-strong pt-1">Leder</p>
          <label className="flex flex-col gap-1"><span className={LABEL}>Navn</span><input className={INPUT} value={draft.managerName} onChange={set("managerName")} /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>Funktion</span><input className={INPUT} value={draft.managerTitle} onChange={set("managerTitle")} /></label>
          <label className="flex flex-col gap-1"><span className={LABEL}>E-mail</span><input className={INPUT} type="email" value={draft.managerEmail} onChange={set("managerEmail")} /></label>
          {error && <p className="hf-type-small text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button className={PRIMARY} disabled={busy || !draft.name.trim()}>Gem</button>
            <button type="button" className={BTN} onClick={() => { setDraft(partner); setEditing(false); setError(null); }}>Fortryd</button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <h1 className="hf-type-title text-hf-black">{partner.name}</h1>
            {canEdit && (
              <button type="button" className="hf-type-small text-text-secondary hover:underline" onClick={() => { setDraft(partner); setEditing(true); }}>
                Redigér
              </button>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <Field label="CVR" value={partner.cvr} />
            <Field label="Adresse" value={address} />
            <Field label="Telefon" value={partner.phone} href={partner.phone ? `tel:${partner.phone.replace(/\s/g, "")}` : undefined} />
          </div>
          <div className="flex flex-col gap-3 border-t border-hf-tan-dark pt-4">
            <p className="hf-type-strong text-hf-black">Kontaktperson</p>
            <Field label="Navn" value={partner.contactName} />
            <Field label="E-mail" value={partner.contactEmail} href={partner.contactEmail ? `mailto:${partner.contactEmail}` : undefined} />
            <Field label="Telefon" value={partner.contactPhone} href={partner.contactPhone ? `tel:${partner.contactPhone.replace(/\s/g, "")}` : undefined} />
          </div>
          <div className="flex flex-col gap-3 border-t border-hf-tan-dark pt-4">
            <p className="hf-type-strong text-hf-black">Leder</p>
            <Field label="Navn" value={partner.managerName} />
            <Field label="Funktion" value={partner.managerTitle} />
            <Field label="E-mail" value={partner.managerEmail} href={partner.managerEmail ? `mailto:${partner.managerEmail}` : undefined} />
          </div>
        </>
      )}
      <Menu id={partner.id} />
    </aside>
  );
}
