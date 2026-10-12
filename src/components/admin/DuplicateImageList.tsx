"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageGroup } from "@/lib/duplicate-review";
import { imageGroupView } from "@/lib/image-quality";
import { DuplicateImageGroup } from "@/components/admin/DuplicateImageGroup";
import { DuplicateImageLightbox } from "@/components/admin/DuplicateImageLightbox";
import { ReviewSizePicker, useReviewSize } from "@/components/admin/ReviewSizePicker";
import { useImageQuality } from "@/components/admin/useImageQuality";
import { BulkActionsBar, BulkSelection } from "@/components/admin/BulkSelection";

// Billed-dubletter med samme visningsvælger som Logoer og Billedforslag:
// 1/2/4 varer ad gangen af de varer, serveren har hentet til siden. Valgt
// alternativ og lightbox styres her, så kort og lightbox viser det samme.
export function DuplicateImageList({ groups }: { groups: ImageGroup[] }) {
  const router = useRouter();
  const { sizeIdx, perPage, choose } = useReviewSize("hc-admin-duplicate-images-size");
  const [page, setPage] = useState(0);
  const [resolved, setResolved] = useState<string[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = groups.filter((group) => !resolved.includes(group.productId));
  const quality = useImageQuality(open.flatMap((group) => group.images.map((img) => img.url)));
  const views = open.map((group) => ({ group, view: imageGroupView(group, quality, picked[group.productId]) }));

  const pageCount = Math.max(1, Math.ceil(views.length / perPage));
  const safePage = Math.min(page, pageCount - 1);
  const visible = views.slice(safePage * perPage, safePage * perPage + perPage);

  const pick = (productId: string, imageId: string) => setPicked((prev) => ({ ...prev, [productId]: imageId }));
  const setError = (productId: string, message: string | null) =>
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[productId] = message;
      else delete next[productId];
      return next;
    });

  // Behold / Erstat med dette: keepId bliver hovedbillede, resten slettes.
  async function resolve(group: ImageGroup, keepId: string) {
    if (busyId) return;
    setBusyId(group.productId);
    setError(group.productId, null);
    try {
      const res = await fetch("/api/admin/duplicate-products/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: group.productId, keepImageIds: [keepId], primaryImageId: keepId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(group.productId, data.message ?? "Kunne ikke gemme");
        return;
      }
      if (lightboxId === group.productId) {
        const index = open.findIndex((g) => g.productId === group.productId);
        setLightboxId((open[index + 1] ?? open[index - 1])?.productId ?? null);
      }
      setResolved((prev) => [...prev, group.productId]);
      router.refresh();
    } catch {
      setError(group.productId, "Kunne ikke gemme (serverfejl). Prøv igen.");
    } finally {
      setBusyId(null);
    }
  }

  const lightboxIndex = views.findIndex((entry) => entry.group.productId === lightboxId);
  const lightbox = lightboxIndex >= 0 ? views[lightboxIndex] : null;
  const canStep = views.length > 1 || (lightbox?.view.alternatives.length ?? 0) > 1;

  // Bladr i varens alternativer; ud over kanten går det videre til næste/forrige vare.
  const step = (delta: number) => {
    if (!lightbox) return;
    const { group, view } = lightbox;
    const count = view.alternatives.length;
    const target = view.alternatives.findIndex((img) => img.id === view.shown?.id) + delta;
    if (target >= 0 && target < count) {
      pick(group.productId, view.alternatives[target].id);
      return;
    }
    if (views.length === 1) {
      if (count > 1) pick(group.productId, view.alternatives[(target + count) % count].id);
      return;
    }
    const nextIndex = (lightboxIndex + delta + views.length) % views.length;
    const next = views[nextIndex];
    const enter = delta > 0 ? next.view.alternatives[0] : next.view.alternatives[next.view.alternatives.length - 1];
    if (enter) pick(next.group.productId, enter.id);
    setLightboxId(next.group.productId);
    setPage(Math.floor(nextIndex / perPage));
  };

  return (
    <BulkSelection kind="product" ids={visible.map(({ group }) => group.productId)}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hf-type-caption">
          {views.length} varer · viser {views.length === 0 ? 0 : safePage * perPage + 1}–{safePage * perPage + visible.length}
        </p>
        <ReviewSizePicker sizeIdx={sizeIdx} onChoose={choose} />
      </div>
      <BulkActionsBar />
      <div className={`grid gap-4 ${perPage === 4 ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {visible.map(({ group, view }) => (
          <DuplicateImageGroup
            key={group.productId}
            group={group}
            view={view}
            quality={quality}
            busy={busyId === group.productId}
            error={errors[group.productId]}
            onPick={(imageId) => pick(group.productId, imageId)}
            onOpen={() => setLightboxId(group.productId)}
            onResolve={(keepId) => resolve(group, keepId)}
          />
        ))}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0} className="hf-btn-text">
            ‹ Forrige
          </button>
          <span className="hf-type-caption">
            {safePage + 1} / {pageCount}
          </span>
          <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage >= pageCount - 1} className="hf-btn-text">
            Næste ›
          </button>
        </div>
      )}

      {lightbox && (
        <DuplicateImageLightbox
          group={lightbox.group}
          view={lightbox.view}
          quality={quality}
          position={`Vare ${lightboxIndex + 1} af ${views.length}`}
          busy={busyId === lightbox.group.productId}
          error={errors[lightbox.group.productId]}
          canStep={canStep}
          onStep={step}
          onPick={(imageId) => pick(lightbox.group.productId, imageId)}
          onResolve={(keepId) => resolve(lightbox.group, keepId)}
          onClose={() => setLightboxId(null)}
        />
      )}
    </div>
    </BulkSelection>
  );
}
