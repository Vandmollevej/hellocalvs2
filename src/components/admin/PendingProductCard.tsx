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

export function PendingProductCard({ product }: { product: Product }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [done, setDone] = useState(false);

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

  if (done) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong bg-surface-2 p-4 sm:flex-row sm:items-center">
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
      </div>
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
  );
}
