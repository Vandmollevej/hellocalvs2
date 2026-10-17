"use client";

import { useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

// "Find nyt billede": varer hvor admin afviste både det nuværende billede og
// forslaget (docs/DECISIONS.md 2026-10-17). Et nyt billede trækkes ind og vises
// ved siden af originalen; Vælg gør det til varens billede.

export type FindNewImageItem = { id: string; title: string; subtitle: string | null; imageUrl: string | null; pendingImageUrl: string | null };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function Card({ item }: { item: FindNewImageItem }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(item.pendingImageUrl);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return setError("Brug en png-, jpg- eller webp-fil.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${item.id}/image/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: await readAsDataUrl(file) }),
      });
      const data = (await res.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (res.ok && data?.url) setPreview(data.url);
      else setError(data?.message ?? "Billedet kunne ikke gemmes.");
    } catch {
      setError("Billedet kunne ikke gemmes.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: "accept" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${item.id}/image/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "both" }),
      });
      if (!res.ok) return setError("Handlingen blev ikke gemt. Prøv igen.");
      if (action === "accept") {
        setDone(true);
        router.refresh();
      } else setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setOver(false);
    void upload(event.dataTransfer.files[0]);
  };

  if (done) return null;
  return (
    <div className="hf-panel hf-panel--form">
      <div>
        <p className="hf-type-strong text-hf-black">{item.title}</p>
        {item.subtitle && <p className="hf-type-caption">{item.subtitle}</p>}
      </div>
      <div className="hf-pick-grid">
        <div className="flex flex-col items-center gap-1">
          <div className="hf-pick-frame">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="Nuværende" />
            ) : (
              <span className="hf-type-small text-text-muted">Intet billede</span>
            )}
          </div>
          <span className="hf-type-small text-text-muted">Nuværende</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
            className={`hf-pick-frame cursor-pointer ${over ? "is-recommended" : ""}`}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Nyt billede" />
            ) : (
              <span className="hf-type-small px-2 text-center text-text-muted">{busy ? "Gemmer…" : "Træk det nye billede hertil eller klik"}</span>
            )}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void upload(event.target.files?.[0])} />
          </label>
          <span className="hf-type-small text-text-muted">{preview ? "Nyt billede" : "Intet nyt billede endnu"}</span>
        </div>
      </div>
      {error && <p className="hf-type-small text-hf-red-dark">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => decide("reject")} disabled={busy || !preview} className="hf-btn-danger hf-btn--large flex-1">
          Afvis
        </button>
        <button type="button" onClick={() => decide("accept")} disabled={busy || !preview} className="hf-btn-primary hf-btn--large flex-1">
          Vælg
        </button>
      </div>
    </div>
  );
}

export function FindNewImageBoard({ items }: { items: FindNewImageItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="hf-type-strong flex items-center gap-2 text-hf-black">
        <span aria-hidden="true" className="text-hf-red-dark">
          !
        </span>
        Find nyt billede ({items.length})
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {items.map((item) => (
          <Card key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
