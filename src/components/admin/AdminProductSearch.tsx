"use client";

import { useState } from "react";

type Product = {
  id: string;
  name: string;
  brand: { name: string } | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export function AdminProductSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", kcalPer100g: "", proteinPer100g: "", carbsPer100g: "", fatPer100g: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.products ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(p: Product) {
    setActiveId(p.id);
    setSaved(false);
    setError(null);
    setForm({
      name: p.name,
      brand: p.brand?.name ?? "",
      kcalPer100g: String(p.kcalPer100g),
      proteinPer100g: String(p.proteinPer100g),
      carbsPer100g: String(p.carbsPer100g),
      fatPer100g: String(p.fatPer100g),
    });
  }

  async function save() {
    if (!activeId) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Kunne ikke gemme");
      setSaved(true);
      setResults((prev) => (prev ? prev.map((p) => (p.id === activeId ? { ...p, ...data.product, brand: data.product.brand } : p)) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Søg efter produktnavn eller producent…"
        className="hf-type-body w-full max-w-md rounded-md border border-hf-tan-dark bg-hf-white px-3 py-2"
      />

      <div className="flex flex-col gap-2">
        {loading && <p className="hf-type-body text-text-muted">Søger…</p>}
        {!loading && results !== null && results.length === 0 && (
          <p className="hf-type-body text-text-muted">Ingen produkter matcher &quot;{query}&quot;.</p>
        )}
        {results?.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => openEdit(p)}
            className={
              "flex items-center gap-3 rounded-lg border px-3 py-2 text-left " +
              (activeId === p.id ? "border-hf-green-dark bg-hf-cream" : "border-hf-tan-dark bg-hf-white hover:border-hf-green")
            }
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
              {p.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <p className="hf-type-body hf-type-strong truncate text-hf-black">
                {p.name}
                {p.brand?.name ? ` — ${p.brand.name}` : ""}
              </p>
              <p className="hf-type-small text-text-muted">{Math.round(p.kcalPer100g)} kcal / 100 g</p>
            </div>
          </button>
        ))}
      </div>

      {activeId && (
        <div className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
          <div className="mb-4 flex justify-end">
            <a href={`/admin/products/${activeId}`} className="hf-type-small text-hf-green-dark underline">
              Åbn produktside (merge m.m.)
            </a>
          </div>
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
            <button type="button" onClick={save} className="hf-btn-primary px-4 py-1.5">
              Gem ændringer
            </button>
            {saved && <span className="hf-type-body text-hf-green-dark">Gemt ✓</span>}
            {error && <span className="hf-type-body text-hf-red-dark">{error}</span>}
          </div>
          <p className="hf-type-small mt-4 border-t border-hf-tan-dark pt-4 text-text-muted">
            Ændringer påvirker kun produktets fremtidige visning — brugere, der allerede har registreret
            dette produkt, beholder deres oprindelige værdier (snapshot).
          </p>
        </div>
      )}
    </div>
  );
}
