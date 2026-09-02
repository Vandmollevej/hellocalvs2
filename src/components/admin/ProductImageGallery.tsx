"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ProductImage = { id: string; url: string };

const MAX_SECONDARY = 3;

export function ProductImageGallery({
  productId,
  imageUrl,
  images,
}: {
  productId: string;
  imageUrl: string | null;
  images: ProductImage[];
}) {
  const router = useRouter();
  const [primaryUrl, setPrimaryUrl] = useState(imageUrl ?? "");
  const [savingPrimary, setSavingPrimary] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomedId, setZoomedId] = useState<string | null>(null);

  async function savePrimary() {
    setSavingPrimary(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: primaryUrl }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Kunne ikke gemme");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke gemme");
    } finally {
      setSavingPrimary(false);
    }
  }

  async function addSecondary() {
    if (!newUrl.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Kunne ikke tilføje billede");
      setNewUrl("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunne ikke tilføje billede");
    } finally {
      setAdding(false);
    }
  }

  async function removeSecondary(imageId: string) {
    await fetch(`/api/admin/products/${productId}/images/${imageId}`, { method: "DELETE" });
    router.refresh();
  }

  async function move(imageId: string, direction: "up" | "down") {
    await fetch(`/api/admin/products/${productId}/images/${imageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border-strong bg-surface-2 p-4">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
        Billeder — ét hovedbillede + op til {MAX_SECONDARY} øvrige (fx en æskes andre sider)
      </p>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col items-center gap-2">
          <Thumb
            url={primaryUrl}
            zoomed={zoomedId === "primary"}
            onHover={(hovering) => setZoomedId(hovering ? "primary" : null)}
            label="Hovedbillede"
          />
        </div>
        {images.map((img) => (
          <div key={img.id} className="flex flex-col items-center gap-2">
            <Thumb
              url={img.url}
              zoomed={zoomedId === img.id}
              onHover={(hovering) => setZoomedId(hovering ? img.id : null)}
              label="Øvrigt billede"
            />
            <div className="flex gap-1">
              <button type="button" onClick={() => move(img.id, "up")} className="rounded border border-border-strong px-1.5 text-xs">
                ↑
              </button>
              <button type="button" onClick={() => move(img.id, "down")} className="rounded border border-border-strong px-1.5 text-xs">
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeSecondary(img.id)}
                className="rounded border border-border-strong px-1.5 text-xs text-hf-red-dark"
              >
                Slet
              </button>
            </div>
          </div>
        ))}
        {images.length < MAX_SECONDARY && (
          <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border-strong text-3xl text-text-muted">
            +
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-text-secondary">
          Hovedbillede-URL
          <input
            value={primaryUrl}
            onChange={(e) => setPrimaryUrl(e.target.value)}
            placeholder="https://…"
            className="w-64 rounded-md border border-border-strong px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={savePrimary}
          disabled={savingPrimary}
          className="rounded-md bg-hf-green-dark px-3 py-1.5 text-sm text-hf-white disabled:opacity-60"
        >
          {savingPrimary ? "Gemmer…" : "Gem hovedbillede"}
        </button>
      </div>

      {images.length < MAX_SECONDARY && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            Tilføj øvrigt billede (URL)
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://…"
              className="w-64 rounded-md border border-border-strong px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={addSecondary}
            disabled={adding}
            className="rounded-md border border-hf-green-dark px-3 py-1.5 text-sm text-hf-green-dark disabled:opacity-60"
          >
            {adding ? "Tilføjer…" : "Tilføj"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-hf-red-dark">{error}</p>}
    </div>
  );
}

function Thumb({
  url,
  zoomed,
  onHover,
  label,
}: {
  url: string;
  zoomed: boolean;
  onHover: (hovering: boolean) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <div
        onClick={() => onHover(!zoomed)}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        className={
          "h-28 w-28 cursor-pointer overflow-hidden rounded-lg bg-hf-tan transition-transform duration-150 ease-out " +
          (zoomed ? "relative z-20 scale-[2.1] shadow-xl" : "")
        }
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-center text-[10px] text-text-muted">
            Intet billede
          </div>
        )}
      </div>
      <p className="mt-1 text-center text-[10px] text-text-muted">{label}</p>
    </div>
  );
}
