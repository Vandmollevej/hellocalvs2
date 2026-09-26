"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  brand: { name: string } | null;
  imageUrl: string | null;
  pendingImageUrl: string | null;
};

export function PendingImageCard({ product }: { product: Product }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "reject" | null>(null);
  const [done, setDone] = useState(false);

  async function act(action: "accept" | "reject") {
    setLoading(action);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/image/${action}`, { method: "POST" });
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
    <div className="flex flex-col gap-4 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
      <div>
        <p className="hf-type-strong text-hf-black">{product.name}</p>
        {product.brand?.name && <p className="hf-type-small text-text-secondary">{product.brand.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="hf-type-small text-text-muted">Intet billede</span>
            )}
          </div>
          <span className="hf-type-small text-text-muted">Nuværende</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg bg-hf-tan">
            {product.pendingImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.pendingImageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="hf-type-small text-text-muted">Intet forslag</span>
            )}
          </div>
          <span className="hf-type-small text-text-muted">Forslag (Google)</span>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => act("reject")}
          disabled={loading !== null}
          className="hf-type-body flex-1 rounded-md border border-hf-tan-dark px-3 py-1.5 text-hf-red-dark disabled:opacity-60"
        >
          {loading === "reject" ? "…" : "Afvis"}
        </button>
        <button
          type="button"
          onClick={() => act("accept")}
          disabled={loading !== null}
          className="hf-btn-primary flex-1 px-3 py-1.5 disabled:opacity-60"
        >
          {loading === "accept" ? "…" : "Godkend forslag"}
        </button>
      </div>
    </div>
  );
}
