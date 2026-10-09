"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/components/admin/PartnerManagers";
import { useConfirmSheet } from "@/lib/use-confirm-sheet";
import { PRODUCT_CATEGORY_LABELS, type AdInventoryItem } from "@/lib/ad-inventory";
import { INPUT, LABEL, BTN, PRIMARY } from "@/components/admin/partner/ui";

// Alle reklamemuligheder i appen (docs/DECISIONS.md 2026-10-02). Under hver
// mulighed ses partnerens spots; et spot har banner, link, aftalte tal,
// evt. trigger (produktkategori/produkttype) og hører til en sponsoraftale.
export type Spot = {
  id: string;
  name: string;
  inventoryKey: string;
  placement: string;
  bannerUrl: string;
  targetUrl: string;
  agreedImpressions: number | null;
  agreedClicks: number | null;
  triggerCategory: string | null;
  triggerProductType: string | null;
  agreementId: string | null;
};

type Draft = {
  id?: string;
  inventoryKey: string;
  name: string;
  bannerUrl: string;
  targetUrl: string;
  agreedImpressions: string;
  agreedClicks: string;
  triggerCategory: string;
  triggerProductType: string;
  agreementId: string;
};

const blank = (inventoryKey: string, name: string): Draft => ({
  inventoryKey,
  name,
  bannerUrl: "",
  targetUrl: "",
  agreedImpressions: "",
  agreedClicks: "",
  triggerCategory: "",
  triggerProductType: "",
  agreementId: "",
});

export function InventoryPanel({
  partnerId,
  inventory,
  spots,
  agreements,
}: {
  partnerId: string;
  inventory: AdInventoryItem[];
  spots: Spot[];
  agreements: { id: string; title: string }[];
}) {
  const router = useRouter();
  const { ask, sheet } = useConfirmSheet();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = draft ? inventory.find((i) => i.key === draft.inventoryKey) : undefined;
  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => (d ? { ...d, [key]: e.target.value } : d));

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

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/admin/partners/${partnerId}/banner`, { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
    setBusy(false);
    if (!res.ok || !data.url) {
      setError(data.message ?? "Banneret kunne ikke uploades");
      return;
    }
    setDraft((d) => (d ? { ...d, bannerUrl: data.url as string } : d));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const ok = await run({
      action: draft.id ? "updateLocation" : "createLocation",
      partnerId,
      ...draft,
      // Triggere gælder kun pladser, der kan udløses.
      ...(item?.triggerable ? {} : { triggerCategory: "", triggerProductType: "" }),
    });
    if (ok) setDraft(null);
  }

  const editSpot = (s: Spot) =>
    setDraft({
      id: s.id,
      inventoryKey: s.inventoryKey,
      name: s.name,
      bannerUrl: s.bannerUrl,
      targetUrl: s.targetUrl,
      agreedImpressions: s.agreedImpressions === null ? "" : String(s.agreedImpressions),
      agreedClicks: s.agreedClicks === null ? "" : String(s.agreedClicks),
      triggerCategory: s.triggerCategory ?? "",
      triggerProductType: s.triggerProductType ?? "",
      agreementId: s.agreementId ?? "",
    });

  const known = new Set(inventory.map((i) => i.key));
  const legacy = spots.filter((s) => !known.has(s.inventoryKey));

  const spotRow = (s: Spot) => (
    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-hf-tan px-3 py-2">
      <span className="hf-type-body min-w-0">
        <span className="hf-type-strong">{s.name}</span>
        <span className="text-text-secondary">
          {s.agreedImpressions !== null && ` · ${s.agreedImpressions.toLocaleString("da-DK")} visninger aftalt`}
          {(s.triggerCategory || s.triggerProductType) &&
            ` · kun ved ${[s.triggerCategory ? PRODUCT_CATEGORY_LABELS[s.triggerCategory] : "", s.triggerProductType ?? ""].filter(Boolean).join(" · ")}`}
          {!s.bannerUrl && " · mangler banner"}
        </span>
      </span>
      <span className="flex gap-3">
        <button className="hf-type-small text-text-secondary hover:underline" onClick={() => editSpot(s)}>Redigér</button>
        <button className="hf-type-small text-text-secondary hover:underline" disabled={busy} onClick={() => run({ action: "deleteLocation", id: s.id }, `Slet spottet ${s.name} og dets tal?`)}>Slet</button>
      </span>
    </li>
  );

  return (
    <section className="flex flex-col gap-3">
      {sheet}
      <h3 className="hf-type-title text-hf-black">Reklamemuligheder</h3>
      {error && <p className="hf-type-small text-red-700">{error}</p>}
      {draft && (
        <form className="hf-panel" onSubmit={save}>
          <h3 className="hf-type-title">{draft.id ? "Redigér reklamespot" : "Nyt reklamespot"} · {item?.name ?? "Andet"}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Navn</span><input className={INPUT} value={draft.name} onChange={set("name")} required /></label>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className={LABEL}>Banner{item ? ` (anbefalet ${item.format} px, PNG, JPG eller WebP, højst 4 MB)` : ""}</span>
              {draft.bannerUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- admin-forhåndsvisning af uploadet banner
                <img src={draft.bannerUrl} alt="Forhåndsvisning af banner" className="max-h-40 w-auto self-start rounded-lg border border-hf-tan-dark" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  className="hf-type-small"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void upload(file);
                  }}
                />
                {draft.bannerUrl && (
                  <button type="button" className={BTN} onClick={() => setDraft((d) => (d ? { ...d, bannerUrl: "" } : d))}>Fjern banner</button>
                )}
              </div>
            </div>
            <label className="flex flex-col gap-1 sm:col-span-2"><span className={LABEL}>Link ved klik</span><input className={INPUT} type="url" placeholder="https://…" value={draft.targetUrl} onChange={set("targetUrl")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Aftalte visninger</span><input className={INPUT} inputMode="numeric" value={draft.agreedImpressions} onChange={set("agreedImpressions")} /></label>
            <label className="flex flex-col gap-1"><span className={LABEL}>Aftalte klik</span><input className={INPUT} inputMode="numeric" value={draft.agreedClicks} onChange={set("agreedClicks")} /></label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={LABEL}>Sponsoraftale</span>
              <select className={INPUT} value={draft.agreementId} onChange={set("agreementId")}>
                <option value="">Ingen aftale (vises altid)</option>
                {agreements.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
            {item?.triggerable ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className={LABEL}>Vis kun ved produktkategori</span>
                  <select className={INPUT} value={draft.triggerCategory} onChange={set("triggerCategory")}>
                    <option value="">Alle kategorier</option>
                    {Object.entries(PRODUCT_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL}>Vis kun ved produkttype (fx Skyr)</span>
                  <input className={INPUT} value={draft.triggerProductType} onChange={set("triggerProductType")} />
                </label>
              </>
            ) : (
              <p className="hf-type-small text-text-muted sm:col-span-2">Denne plads kan ikke udløses af produktkategori eller produkttype.</p>
            )}
          </div>
          <div className="flex gap-2">
            <button className={PRIMARY} disabled={busy || !draft.name.trim()}>Gem</button>
            <button type="button" className={BTN} onClick={() => setDraft(null)}>Fortryd</button>
          </div>
        </form>
      )}
      <div className="hf-insight__grid">
        {inventory.map((i) => {
          const mine = spots.filter((s) => s.inventoryKey === i.key);
          return (
            <div key={i.key} className="hf-panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="hf-type-title text-hf-black">{i.name}</h3>
                  <p className="hf-type-caption">{i.placement} · {i.format} px{i.triggerable ? " · kan udløses af kategori/type" : ""}</p>
                </div>
                <span className={`hf-type-micro shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 ${mine.length ? "bg-hf-green-dark text-hf-white" : "bg-hf-tan text-text-secondary"}`}>
                  {mine.length ? `${mine.length} aktiv${mine.length === 1 ? "" : "e"}` : "Ikke booket"}
                </span>
              </div>
              <p className="hf-type-small text-text-secondary">{i.description}</p>
              {mine.length > 0 && <ul className="flex flex-col gap-2">{mine.map(spotRow)}</ul>}
              <button className="hf-type-small self-start text-text-secondary hover:underline" onClick={() => setDraft(blank(i.key, `${i.name}`))}>
                + Tilføj reklamespot
              </button>
            </div>
          );
        })}
      </div>
      {legacy.length > 0 && (
        <div className="hf-panel">
          <h3 className="hf-type-title">Øvrige spots</h3>
          <ul className="flex flex-col gap-2">{legacy.map(spotRow)}</ul>
        </div>
      )}
    </section>
  );
}
