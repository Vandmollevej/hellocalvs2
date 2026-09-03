"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  brand: { name: string } | null;
  imageUrl: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  externalSource: string | null;
  createdAt: string;
};

export function PendingProductCard({ product, hasExtra }: { product: Product; hasExtra: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand?.name ?? "",
    kcalPer100g: String(product.kcalPer100g),
    proteinPer100g: String(product.proteinPer100g),
    carbsPer100g: String(product.carbsPer100g),
    fatPer100g: String(product.fatPer100g),
  });

  async function act(action: "approve" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/${action}`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setLoading(null);
    }
  }

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

  if (done) return null;

  return (
    <div className="rounded-lg border border-border-strong bg-surface-2">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-text-muted">Intet billede</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-text-primary">{product.name}</p>
          <p className="truncate text-xs text-text-secondary">
            {[product.brand?.name, product.externalSource, `${Math.round(product.kcalPer100g)} kcal / 100 g`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-text-muted">
            P {product.proteinPer100g}g · K {product.carbsPer100g}g · F {product.fatPer100g}g
          </p>
          <p className="text-xs text-text-muted">
            Dato: {new Date(product.createdAt).toLocaleDateString("da-DK")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          title={hasExtra ? "Yderligere oplysninger findes" : "Ret produkt"}
          className={
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-text-muted " +
            (hasExtra ? "ring-2 ring-hf-green text-hf-green-dark" : "")
          }
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform .15s" }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={() => act("reject")}
            disabled={loading !== null}
            className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-hf-red-dark disabled:opacity-60"
          >
            {loading === "reject" ? "…" : "Afvis"}
          </button>
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={loading !== null}
            className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
          >
            {loading === "approve" ? "…" : "Godkend"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-strong p-4">
          <div className="mb-3 flex justify-end">
            <a href={`/admin/products/${product.id}`} className="text-xs text-hf-green-dark underline">
              Åbn produktside (merge m.m.)
            </a>
          </div>
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
        </div>
      )}
    </div>
  );
}
