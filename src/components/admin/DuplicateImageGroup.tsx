"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageGroup } from "@/lib/duplicate-review";

// Én vare på admin "Dubletter" → Produktbilleder (docs/DECISIONS.md
// 2026-09-28): alle billed-varianter (EAN.png, EAN_2.png …) på én linje, så
// de kan sammenlignes. Admin vælger hovedbillede (grøn ramme) og fravælger
// dem, der ikke skal bruges.

function fileName(url: string) {
  const name = url.split("?")[0].split("/").pop() ?? url;
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export function DuplicateImageGroup({ group }: { group: ImageGroup }) {
  const router = useRouter();
  const currentId = group.images.find((img) => img.isPrimary)?.id ?? group.images[0]?.id ?? "";
  const [primaryId, setPrimaryId] = useState(currentId);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function save(keepIds: string[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/duplicate-products/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: group.productId, keepImageIds: keepIds, primaryImageId: primaryId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Kunne ikke gemme");
        return;
      }
      setDone(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (done) return null;

  return (
    <section className="flex flex-col gap-3 hf-surface p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href={`/admin/products/${group.productId}`}
          target="_blank"
          rel="noreferrer"
          className="hf-type-body hf-type-strong text-hf-black hover:underline"
        >
          {group.name}
        </a>
        {group.brand && <span className="hf-type-small text-hf-green-dark">{group.brand}</span>}
        {group.barcodes.length > 0 && (
          <span className="hf-type-caption text-text-secondary">{group.barcodes.join(", ")}</span>
        )}
      </div>

      <div className="hf-pick-grid">
        {group.images.map((img) => {
          const isPrimary = img.id === primaryId;
          const isCurrent = img.id === currentId;
          return (
            <div key={img.id} className={`hf-pick-card ${isPrimary ? "is-selected" : ""}`}>
              <span className={`hf-pick-badge ${isCurrent ? "is-current" : ""}`}>{isCurrent ? "Vises i dag" : "Alternativ"}</span>
              <a href={img.url} target="_blank" rel="noreferrer" className="hf-pick-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setSizes((prev) => ({ ...prev, [img.id]: `${el.naturalWidth} × ${el.naturalHeight}` }));
                  }}
                />
              </a>
              <span className="hf-type-caption break-all text-hf-black">{fileName(img.url)}</span>
              <span className="hf-type-caption text-text-secondary">
                {[sizes[img.id], ...img.tags.filter((t) => t !== "Import")].filter(Boolean).join(" · ") || " "}
              </span>
              <button
                type="button"
                onClick={() => setPrimaryId(img.id)}
                aria-pressed={isPrimary}
                className={`h-12 ${isPrimary ? "hf-btn-secondary" : "hf-btn-primary"}`}
              >
                {isPrimary ? "Valgt" : "Vælg"}
              </button>
            </div>
          );
        })}
      </div>

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => save([primaryId])} disabled={busy} className="hf-btn-secondary h-12 px-4">
          Slet de øvrige billeder
        </button>
        <button type="button" onClick={() => save(group.images.map((img) => img.id))} disabled={busy} className="hf-btn-primary h-12 px-4">
          {busy ? "Gemmer…" : "Gem hovedbillede"}
        </button>
      </div>
    </section>
  );
}
