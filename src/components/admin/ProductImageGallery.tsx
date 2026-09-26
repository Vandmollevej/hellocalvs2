"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IMAGE_TAG_MULTIPLE, IMAGE_TAG_RAW } from "@/lib/image-tags";

type ProductImage = { id: string; url: string; tags: string[] };

const MAX_SECONDARY = 3;
const TOGGLEABLE_TAGS = [
  { tag: IMAGE_TAG_MULTIPLE, label: "Flere (Multiple)" },
  { tag: IMAGE_TAG_RAW, label: "Rå-vare (Raw)" },
];

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

  async function toggleTag(image: ProductImage, tag: string) {
    const tags = image.tags.includes(tag) ? image.tags.filter((t) => t !== tag) : [...image.tags, tag];
    await fetch(`/api/admin/products/${productId}/images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-hf-tan-dark bg-hf-white p-4">
      <p className="hf-type-small hf-type-strong mb-4 uppercase tracking-wide text-text-muted">
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
              <button type="button" onClick={() => move(img.id, "up")} className="hf-type-small rounded border border-hf-tan-dark px-1.5">
                ↑
              </button>
              <button type="button" onClick={() => move(img.id, "down")} className="hf-type-small rounded border border-hf-tan-dark px-1.5">
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeSecondary(img.id)}
                className="hf-type-small rounded border border-hf-tan-dark px-1.5 text-hf-red-dark"
              >
                Slet
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-1">
              {TOGGLEABLE_TAGS.map(({ tag, label }) => {
                const active = img.tags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(img, tag)}
                    className={
                      "hf-type-micro rounded-full border px-1.5 py-0.5 " +
                      (active
                        ? "border-hf-green-dark bg-hf-green-dark text-hf-white"
                        : "border-hf-tan-dark text-text-muted")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {images.length < MAX_SECONDARY && (
          <div className="hf-type-hero flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-hf-tan-dark text-text-muted">
            +
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
          Hovedbillede-URL
          <input
            value={primaryUrl}
            onChange={(e) => setPrimaryUrl(e.target.value)}
            placeholder="https://…"
            className="hf-type-body w-64 rounded-md border border-hf-tan-dark px-2 py-1.5"
          />
        </label>
        <button
          type="button"
          onClick={savePrimary}
          disabled={savingPrimary}
          className="hf-btn-primary px-3 py-1.5 disabled:opacity-60"
        >
          {savingPrimary ? "Gemmer…" : "Gem hovedbillede"}
        </button>
      </div>

      {images.length < MAX_SECONDARY && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="hf-type-small flex flex-col gap-1 text-text-secondary">
            Tilføj øvrigt billede (URL)
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://…"
              className="hf-type-body w-64 rounded-md border border-hf-tan-dark px-2 py-1.5"
            />
          </label>
          <button
            type="button"
            onClick={addSecondary}
            disabled={adding}
            className="hf-type-body rounded-md border border-hf-green-dark px-3 py-1.5 text-hf-green-dark disabled:opacity-60"
          >
            {adding ? "Tilføjer…" : "Tilføj"}
          </button>
        </div>
      )}
      {error && <p className="hf-type-small mt-2 text-hf-red-dark">{error}</p>}
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
          <div className="hf-type-micro flex h-full w-full items-center justify-center text-center text-text-muted">
            Intet billede
          </div>
        )}
      </div>
      <p className="hf-type-micro mt-1 text-center text-text-muted">{label}</p>
    </div>
  );
}
