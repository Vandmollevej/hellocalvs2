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
  const [primaryId, setPrimaryId] = useState(
    group.images.find((img) => img.isPrimary)?.id ?? group.images[0]?.id ?? "",
  );
  const [kept, setKept] = useState<Set<string>>(() => new Set(group.images.map((img) => img.id)));
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleKeep(id: string) {
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (id === primaryId) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function choosePrimary(id: string) {
    setPrimaryId(id);
    setKept((prev) => new Set(prev).add(id));
  }

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
    <section className="flex flex-col gap-3 rounded-lg border border-hf-tan-dark bg-hf-white p-4">
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

      <div className="flex gap-3 overflow-x-auto pb-1">
        {group.images.map((img) => {
          const isPrimary = img.id === primaryId;
          const isKept = kept.has(img.id);
          return (
            <div
              key={img.id}
              className={`flex w-44 shrink-0 flex-col gap-1.5 rounded-lg p-2 ${
                isPrimary ? "border-2 border-hf-green-dark bg-hf-gray-light" : "border border-hf-gray-border"
              }`}
            >
              <a href={img.url} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    setSizes((prev) => ({ ...prev, [img.id]: `${el.naturalWidth} × ${el.naturalHeight}` }));
                  }}
                  className={`h-40 w-full rounded-md bg-hf-white object-contain ${isKept ? "" : "opacity-30"}`}
                />
              </a>
              <span className="hf-type-caption break-all text-hf-black">{fileName(img.url)}</span>
              <span className="hf-type-caption text-text-secondary">
                {[sizes[img.id], ...img.tags.filter((t) => t !== "Import")].filter(Boolean).join(" · ") || " "}
              </span>
              <label className="hf-type-small flex items-center gap-2 text-hf-black">
                <input
                  type="radio"
                  name={`primary-${group.productId}`}
                  checked={isPrimary}
                  onChange={() => choosePrimary(img.id)}
                  className="accent-hf-green-dark"
                />
                Hovedbillede
              </label>
              <label className="hf-type-small flex items-center gap-2 text-hf-black">
                <input
                  type="checkbox"
                  checked={isKept}
                  disabled={isPrimary}
                  onChange={() => toggleKeep(img.id)}
                  className="accent-hf-green-dark"
                />
                Behold
              </label>
            </div>
          );
        })}
      </div>

      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => save([primaryId])}
          disabled={busy}
          className="hf-type-small rounded-md border border-hf-gray-border px-3 py-1.5 text-text-secondary disabled:opacity-60"
        >
          Behold kun hovedbilledet
        </button>
        <button
          type="button"
          onClick={() => save([...kept])}
          disabled={busy}
          className="hf-type-small hf-type-strong rounded-md bg-hf-green-dark px-4 py-1.5 text-hf-white disabled:opacity-60"
        >
          {busy ? "Gemmer…" : `Gem valg (${kept.size} af ${group.images.length})`}
        </button>
      </div>
    </section>
  );
}
