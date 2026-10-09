"use client";

import { useEffect, useState } from "react";
import { PendingProductCard, type PendingProduct } from "@/components/admin/PendingProductCard";
import { BottomSheet } from "@/components/hf/BottomSheet";

// Nye varer: tre visninger som i Produkt-databasen (docs/DECISIONS.md
// 2026-10-04): Detaljer (fulde kort, som før), Liste (kompakte linjer) og
// Galleri (fliser). Liste og Galleri åbner varens fulde kort i et overlay,
// så godkend/afvis og redigering virker præcis som i Detaljer.
type View = "details" | "list" | "grid";
const VIEWS: { value: View; label: string }[] = [
  { value: "details", label: "Detaljer" },
  { value: "list", label: "Liste" },
  { value: "grid", label: "Galleri" },
];
const STORAGE_KEY = "hc-admin-pending-products-view";

function Thumb({ product, className }: { product: PendingProduct; className: string }) {
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-hf-tan ${className}`}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="hf-type-micro text-text-muted">Intet billede</span>
      )}
    </span>
  );
}

const subtitle = (p: PendingProduct) => [p.brand?.name, p.variant, p.packageSizeText].filter(Boolean).join(" · ");

export function PendingProductViews({ products }: { products: PendingProduct[] }) {
  const [view, setView] = useState<View>("details");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- husket valg (kun i browseren)
      if (saved === "list" || saved === "grid" || saved === "details") setView(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  function choose(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  const open = products.find((p) => p.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="hf-type-small text-text-secondary">{products.length} varer</p>
        <div className="flex gap-1 rounded-md border border-hf-tan-dark bg-hf-white p-1" role="group" aria-label="Visning">
          {VIEWS.map((option) => (
            <button key={option.value} type="button" aria-pressed={view === option.value} onClick={() => choose(option.value)} className="hf-choice">
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {view === "details" && (
        <div className="flex flex-col gap-4">
          {products.map((product) => (
            <PendingProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {view === "list" && (
        <ul className="flex flex-col divide-y divide-border-strong/50 hf-surface">
          {products.map((product) => (
            <li key={product.id}>
              <button type="button" onClick={() => setOpenId(product.id)} className="flex w-full items-center gap-4 px-4 py-3 text-left">
                <Thumb product={product} className="h-14 w-14" />
                <span className="min-w-0 flex-1">
                  <span className="hf-type-strong block truncate text-hf-black">{product.name}</span>
                  <span className="hf-type-small block truncate text-text-secondary">{subtitle(product)}</span>
                </span>
                <span className="hf-type-small hidden shrink-0 text-text-secondary sm:block">{product.createdAtLabel}</span>
                <span className="hf-type-body w-20 shrink-0 text-right">{Math.round(product.kcalPer100g)} kcal</span>
                <span className="hf-type-body w-12 shrink-0 text-right">{product.confidencePercent === null ? "—" : `${product.confidencePercent} %`}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {view === "grid" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <button key={product.id} type="button" onClick={() => setOpenId(product.id)} className="flex flex-col gap-2 hf-surface p-3 text-left">
              <Thumb product={product} className="aspect-square w-full" />
              <span className="hf-type-strong line-clamp-2 text-hf-black">{product.name}</span>
              <span className="hf-type-small truncate text-text-secondary">{subtitle(product)}</span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <BottomSheet size="full" ariaLabel={open.name} onClose={() => setOpenId(null)}>
          <div className="p-4">
            <PendingProductCard product={open} />
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
