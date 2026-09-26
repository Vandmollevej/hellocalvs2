"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductImageGallery } from "./ProductImageGallery";

type Product = {
  id: string;
  name: string;
  brand: { name: string } | null;
  imageUrl: string | null;
  images: { id: string; url: string; tags: string[] }[];
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  status: string;
};

type SearchResult = { id: string; name: string; brand: { name: string } | null; kcalPer100g: number };

export function ProductDetailEditor({ product }: { product: Product }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand?.name ?? "",
    kcalPer100g: String(product.kcalPer100g),
    proteinPer100g: String(product.proteinPer100g),
    carbsPer100g: String(product.carbsPer100g),
    fatPer100g: String(product.fatPer100g),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeResults, setMergeResults] = useState<SearchResult[]>([]);
  const [mergeTarget, setMergeTarget] = useState<SearchResult | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setSaving(false);
    }
  }

  async function searchMergeTargets(q: string) {
    setMergeQuery(q);
    setMergeTarget(null);
    if (!q.trim()) {
      setMergeResults([]);
      return;
    }
    const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setMergeResults((data.products ?? []).filter((p: SearchResult) => p.id !== product.id));
  }

  async function confirmMerge() {
    if (!mergeTarget) return;
    setMergeBusy(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intoProductId: mergeTarget.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke flette produkterne");
      router.push(`/admin/products/${mergeTarget.id}`);
      router.refresh();
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Kunne ikke flette produkterne");
    } finally {
      setMergeBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ProductImageGallery productId={product.id} imageUrl={product.imageUrl} images={product.images} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
      <div className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Navn
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="hf-type-body rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Producent
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="hf-type-body rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-4">
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Kcal / 100 g
            <input
              type="number"
              value={form.kcalPer100g}
              onChange={(e) => setForm({ ...form, kcalPer100g: e.target.value })}
              className="hf-type-body rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Protein (g)
            <input
              type="number"
              value={form.proteinPer100g}
              onChange={(e) => setForm({ ...form, proteinPer100g: e.target.value })}
              className="hf-type-body rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Kulhydrat (g)
            <input
              type="number"
              value={form.carbsPer100g}
              onChange={(e) => setForm({ ...form, carbsPer100g: e.target.value })}
              className="hf-type-body rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Fedt (g)
            <input
              type="number"
              value={form.fatPer100g}
              onChange={(e) => setForm({ ...form, fatPer100g: e.target.value })}
              className="hf-type-body rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="hf-btn-primary px-4 py-1.5 disabled:opacity-60"
          >
            {saving ? "Gemmer…" : "Gem ændringer"}
          </button>
          {saved && <span className="hf-type-body text-hf-green-dark">Gemt ✓</span>}
          {error && <span className="hf-type-body text-hf-red-dark">{error}</span>}
        </div>
        <p className="hf-type-small mt-4 border-t border-hf-tan-dark pt-4 text-text-muted">
          Ændringer påvirker kun produktets fremtidige visning — brugere, der allerede har registreret
          dette produkt, beholder deres oprindelige værdier (snapshot).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="hf-type-small hf-type-strong uppercase tracking-wide text-text-muted">Handlinger</p>
        <button
          type="button"
          onClick={() => setMergeOpen((v) => !v)}
          className="hf-btn-secondary px-3 py-1.5"
        >
          Merge
        </button>

        {mergeOpen && (
          <div className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
            <p className="hf-type-small mb-2 text-text-secondary">
              Flet dette produkt ind i et andet — alle registreringer, favoritter og stregkoder flyttes,
              og dette produkt slettes.
            </p>
            <input
              type="text"
              value={mergeQuery}
              onChange={(e) => searchMergeTargets(e.target.value)}
              placeholder="Søg efter produkt at flette ind i…"
              className="hf-type-body w-full rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
            <div className="mt-2 flex flex-col gap-1">
              {mergeResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setMergeTarget(r)}
                  className={
                    "hf-type-small rounded-md border px-2 py-1 text-left " +
                    (mergeTarget?.id === r.id ? "border-hf-green-dark bg-hf-cream" : "border-hf-tan-dark")
                  }
                >
                  {r.name}
                  {r.brand?.name ? ` — ${r.brand.name}` : ""}
                </button>
              ))}
            </div>
            {mergeTarget && (
              <button
                type="button"
                onClick={confirmMerge}
                disabled={mergeBusy}
                className="hf-btn-danger mt-4 w-full px-3 py-1.5 disabled:opacity-60"
              >
                {mergeBusy ? "Fletter…" : `Flet ind i "${mergeTarget.name}"`}
              </button>
            )}
            {mergeError && <p className="hf-type-small mt-2 text-hf-red-dark">{mergeError}</p>}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
