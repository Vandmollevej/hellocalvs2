"use client";

import { useEffect, useState } from "react";
import { ActionLink } from "@/components/hf/ActionButton";
import { TextField } from "@/components/hf/TextField";

// Bundark for en vare på hyldebilledet: status, "Opret denne vare" og
// "Ret tildeling" (manuel rettelse af et forkert AI-match).

export type ShelfItem = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  detectedName: string;
  detectedBrand: string | null;
  status: "MISSING" | "EXISTS" | "UNCERTAIN";
  matchConfidence: number | null;
  manuallyAssigned: boolean;
  product: { id: string; name: string; brand: { name: string } | null } | null;
};

type SearchResult = { id: string; name: string; packageSizeText: string | null; brand: { name: string } | null };

const STATUS_TEXT = {
  EXISTS: "Findes allerede i Hello Cal",
  MISSING: "Ikke oprettet endnu",
  UNCERTAIN: "Usikkert match — tjek om det er samme vare",
};

export function ShelfItemSheet({ item, onClose, onChanged }: { item: ShelfItem; onClose: () => void; onChanged: () => void }) {
  const [reassigning, setReassigning] = useState(false);
  const [query, setQuery] = useState(item.detectedName);
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!reassigning || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/scan/product-search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { products: [] }))
        .then((data: { products: SearchResult[] }) => setResults(data.products))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, reassigning]);

  async function assign(productId: string | null) {
    const response = await fetch(`/api/scan/shelf-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    if (response.ok) onChanged();
  }

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-hf-black/40" onClick={onClose}>
      <div
        className="flex max-h-[80%] w-full flex-col gap-3 overflow-y-auto rounded-t-[12px] bg-hf-cream p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 className="hf-type-section-title">{item.detectedName}</h2>
          {item.detectedBrand && <p className="hf-type-body">{item.detectedBrand}</p>}
          <p className="hf-type-caption" style={{ color: "var(--hf-color-text-secondary)" }}>
            {STATUS_TEXT[item.status]}
            {item.product ? ` · ${[item.product.brand?.name, item.product.name].filter(Boolean).join(" ")}` : ""}
            {item.matchConfidence != null && !item.manuallyAssigned ? ` · ${Math.round(item.matchConfidence * 100)} %` : ""}
          </p>
        </div>

        {item.status !== "EXISTS" && (
          <ActionLink href={`/scan/opret?item=${item.id}`} className="h-12">
            <span className="hf-type-button">Opret denne vare</span>
          </ActionLink>
        )}

        {!reassigning ? (
          <button type="button" className="hf-btn-secondary h-12 w-full" onClick={() => setReassigning(true)}>
            <span className="hf-type-button">Ret tildeling</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <TextField variant="standard" label="Søg produkt" value={query} onChange={(event) => setQuery(event.target.value)} />
            <ul className="flex flex-col rounded-[8px]" style={{ background: "var(--hf-color-card)" }}>
              {results.map((product) => (
                <li key={product.id}>
                  <button type="button" onClick={() => void assign(product.id)} className="hf-type-body w-full px-4 py-3 text-left">
                    {[product.brand?.name, product.name, product.packageSizeText].filter(Boolean).join(" · ")}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="hf-btn-secondary h-12 w-full" onClick={() => void assign(null)}>
              <span className="hf-type-button">Varen er ikke oprettet</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
