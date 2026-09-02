"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductImageGallery } from "./ProductImageGallery";

type Product = {
  id: string;
  name: string;
  brand: { name: string } | null;
  imageUrl: string | null;
  images: { id: string; url: string }[];
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
      router.push(`/admin/produkter/${mergeTarget.id}`);
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
      <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Navn
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Producent
            <input
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Kcal / 100 g
            <input
              type="number"
              value={form.kcalPer100g}
              onChange={(e) => setForm({ ...form, kcalPer100g: e.target.value })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Protein (g)
            <input
              type="number"
              value={form.proteinPer100g}
              onChange={(e) => setForm({ ...form, proteinPer100g: e.target.value })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Kulhydrat (g)
            <input
              type="number"
              value={form.carbsPer100g}
              onChange={(e) => setForm({ ...form, carbsPer100g: e.target.value })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Fedt (g)
            <input
              type="number"
              value={form.fatPer100g}
              onChange={(e) => setForm({ ...form, fatPer100g: e.target.value })}
              className="rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-hf-green-dark px-4 py-1.5 text-sm text-hf-white disabled:opacity-60"
          >
            {saving ? "Gemmer…" : "Gem ændringer"}
          </button>
          {saved && <span className="text-sm text-hf-green-dark">Gemt ✓</span>}
          {error && <span className="text-sm text-hf-red-dark">{error}</span>}
        </div>
        <p className="mt-3 border-t border-border-strong pt-3 text-xs text-text-muted">
          Ændringer påvirker kun produktets fremtidige visning — brugere, der allerede har registreret
          dette produkt, beholder deres oprindelige værdier (snapshot).
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Handlinger</p>
        <button
          type="button"
          onClick={() => setMergeOpen((v) => !v)}
          className="rounded-md border border-hf-green-dark px-3 py-1.5 text-sm text-hf-green-dark hover:bg-hf-cream"
        >
          Merge
        </button>

        {mergeOpen && (
          <div className="rounded-lg border border-border-strong bg-surface-2 p-3">
            <p className="mb-2 text-xs text-text-secondary">
              Flet dette produkt ind i et andet — alle registreringer, favoritter og stregkoder flyttes,
              og dette produkt slettes.
            </p>
            <input
              type="text"
              value={mergeQuery}
              onChange={(e) => searchMergeTargets(e.target.value)}
              placeholder="Søg efter produkt at flette ind i…"
              className="w-full rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
            <div className="mt-2 flex flex-col gap-1">
              {mergeResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setMergeTarget(r)}
                  className={
                    "rounded-md border px-2 py-1 text-left text-xs " +
                    (mergeTarget?.id === r.id ? "border-hf-green-dark bg-hf-cream" : "border-border-strong")
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
                className="mt-3 w-full rounded-md bg-hf-red-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
              >
                {mergeBusy ? "Fletter…" : `Flet ind i "${mergeTarget.name}"`}
              </button>
            )}
            {mergeError && <p className="mt-2 text-xs text-hf-red-dark">{mergeError}</p>}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
