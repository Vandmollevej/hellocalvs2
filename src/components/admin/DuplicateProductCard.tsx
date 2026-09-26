"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  createdAt: string | Date;
  status: string;
};

type DuplicateLink = {
  id: string;
  productA: Product;
  productB: Product;
};

// One candidate image gathered from either side of the pair, keyed by a
// stable index so the same URL appearing on both products (e.g. an
// already-shared placeholder) is still tracked as two separate choices.
type ImageCandidate = { key: string; url: string; fromProductId: string; checked: boolean };

function productImages(product: Product): { url: string }[] {
  const list: { url: string }[] = [];
  if (product.imageUrl) list.push({ url: product.imageUrl });
  for (const img of product.images) list.push({ url: img.url });
  return list;
}

function formatMacros(p: Product) {
  return `${Math.round(p.kcalPer100g)} kcal · P ${p.proteinPer100g}g · K ${p.carbsPer100g}g · F ${p.fatPer100g}g`;
}

export function DuplicateProductCard({ link }: { link: DuplicateLink }) {
  const router = useRouter();
  const [keepProductId, setKeepProductId] = useState(
    new Date(link.productA.createdAt) <= new Date(link.productB.createdAt) ? link.productA.id : link.productB.id
  );
  const [images, setImages] = useState<ImageCandidate[]>(() => {
    const fromA = productImages(link.productA).map((img, i) => ({
      key: `a-${i}`,
      url: img.url,
      fromProductId: link.productA.id,
      checked: true,
    }));
    const fromB = productImages(link.productB).map((img, i) => ({
      key: `b-${i}`,
      url: img.url,
      fromProductId: link.productB.id,
      checked: true,
    }));
    return [...fromA, ...fromB];
  });
  const [busy, setBusy] = useState<"merge" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const products = useMemo(() => [link.productA, link.productB], [link]);

  function toggleImage(key: string) {
    setImages((prev) => prev.map((img) => (img.key === key ? { ...img, checked: !img.checked } : img)));
  }

  async function merge() {
    setBusy("merge");
    setError(null);
    try {
      // Keep the chosen product's own images first, so its imageUrl (index
      // 0 after filtering) stays visually the most relevant primary photo.
      const ordered = [...images].sort((a, b) =>
        a.fromProductId === keepProductId && b.fromProductId !== keepProductId ? -1 : 0
      );
      const chosenUrls = ordered.filter((img) => img.checked).map((img) => img.url);
      const res = await fetch(`/api/admin/duplicate-products/${link.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepProductId, images: chosenUrls }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke flette produkterne");
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function dismiss() {
    setBusy("dismiss");
    setError(null);
    try {
      const res = await fetch(`/api/admin/duplicate-products/${link.id}/dismiss`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  if (done) return null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-strong bg-surface-2 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => setKeepProductId(product.id)}
            className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left ${
              keepProductId === product.id ? "border-hf-green-dark bg-hf-tan/40" : "border-border-strong"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={`h-3 w-3 flex-none rounded-full border ${
                  keepProductId === product.id ? "border-hf-green-dark bg-hf-green-dark" : "border-border-strong"
                }`}
              />
              <span className="font-medium text-text-primary">{product.name}</span>
            </span>
            {product.brand?.name && <span className="text-xs text-text-secondary">{product.brand.name}</span>}
            <span className="text-xs text-text-secondary">{formatMacros(product)}</span>
            <span className="text-xs text-text-muted">
              {product.status} · oprettet {new Date(product.createdAt).toLocaleString("da-DK")}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        Den valgte (grønne) beholdes som produktet — det andet slettes, og alle registreringer, favoritter,
        stregkoder m.m. flyttes automatisk over. Tidligere registreringer bruger stadig deres egen gemte snapshot.
      </p>

      <div>
        <p className="mb-2 text-sm font-medium text-text-primary">Billeder — vælg hvilke der skal bruges</p>
        {images.length === 0 ? (
          <p className="text-xs text-text-muted">Ingen billeder på nogen af de to produkter.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((img) => (
              <label
                key={img.key}
                className={`relative flex h-24 items-center justify-center overflow-hidden rounded-md border bg-hf-tan ${
                  img.checked ? "border-hf-green-dark" : "border-border-strong opacity-50"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                <input
                  type="checkbox"
                  checked={img.checked}
                  onChange={() => toggleImage(img.key)}
                  className="absolute right-1 top-1 h-4 w-4"
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-hf-red-dark">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={dismiss}
          disabled={busy !== null}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-secondary disabled:opacity-60"
        >
          {busy === "dismiss" ? "…" : "Ikke en dublet"}
        </button>
        <button
          type="button"
          onClick={merge}
          disabled={busy !== null}
          className="rounded-md bg-hf-green-dark px-4 py-1.5 text-sm font-medium text-hf-white disabled:opacity-60"
        >
          {busy === "merge" ? "Fletter…" : "Merge"}
        </button>
      </div>
    </div>
  );
}
