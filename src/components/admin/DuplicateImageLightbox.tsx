"use client";

import { useEffect, useRef } from "react";
import type { ImageGroup } from "@/lib/duplicate-review";
import type { ImageGroupView, ImageQuality } from "@/lib/image-quality";
import { DuplicatePickCard } from "@/components/admin/DuplicateImageGroup";

// Lightbox på "Dubletter" → Varebilleder (docs/DECISIONS.md 2026-10-11):
// samme visning som på siden (Vises i dag + alternativ med Behold / Erstat
// med dette), men næsten i fuld skærm. Hele kolonnen ude i hver side bladrer
// (ikke kun pilen), ligesom piletaster og swipe; efter sidste alternativ
// fortsætter den til næste vare. Tallene i bunden er varens alternativer.

const SWIPE_PX = 50;

type Props = {
  group: ImageGroup;
  view: ImageGroupView;
  quality: Record<string, ImageQuality | undefined>;
  position: string;
  busy: boolean;
  error?: string;
  canStep: boolean;
  onStep: (delta: number) => void;
  onPick: (imageId: string) => void;
  onResolve: (keepImageId: string) => void;
  onClose: () => void;
};

export function DuplicateImageLightbox({
  group,
  view,
  quality,
  position,
  busy,
  error,
  canStep,
  onStep,
  onPick,
  onResolve,
  onClose,
}: Props) {
  const touchX = useRef<number | null>(null);
  const { current, alternatives, recommendedId, shown } = view;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onStep(-1);
      if (event.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const side = (delta: number) =>
    canStep ? (
      <button
        type="button"
        onClick={() => onStep(delta)}
        className="hf-pick-side"
        aria-label={delta < 0 ? "Forrige billede" : "Næste billede"}
      >
        <span className="hf-pick-side-arrow" aria-hidden="true">
          {delta < 0 ? "‹" : "›"}
        </span>
      </button>
    ) : (
      <div className="hf-pick-side" />
    );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-hf-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={`Billeder af ${group.name}`}
    >
      <div className="flex items-start justify-between gap-4 px-4 pt-4 text-hf-white">
        <div className="min-w-0">
          <p className="hf-type-body hf-type-strong truncate">{group.name}</p>
          <p className="hf-type-small opacity-80">{[group.brand, position].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" onClick={onClose} className="hf-btn-icon" aria-label="Luk">
          ✕
        </button>
      </div>

      <div
        className="flex min-h-0 flex-1"
        onTouchStart={(event) => {
          touchX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchX.current;
          touchX.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined || !canStep) return;
          if (Math.abs(end - start) >= SWIPE_PX) onStep(end < start ? 1 : -1);
        }}
      >
        {side(-1)}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 grid-rows-1 gap-4 py-4">
          <DuplicatePickCard
            large
            image={current}
            quality={quality[current.url]}
            kind="current"
            recommended={false}
            busy={busy}
            onAction={() => onResolve(current.id)}
          />
          {shown ? (
            <DuplicatePickCard
              large
              image={shown}
              quality={quality[shown.url]}
              kind="alternative"
              recommended={shown.id === recommendedId}
              busy={busy}
              onAction={() => onResolve(shown.id)}
            />
          ) : (
            <div />
          )}
        </div>
        {side(1)}
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pb-4">
        {error && <p className="hf-type-small rounded-full bg-hf-white px-3 text-hf-red-dark">{error}</p>}
        {alternatives.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Alternativer">
            {alternatives.map((img, index) => {
              const active = img.id === shown?.id;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => onPick(img.id)}
                  aria-current={active}
                  aria-label={`Alternativ ${index + 1}${img.id === recommendedId ? " (anbefalet)" : ""}`}
                  className={`hf-type-small h-8 min-w-8 rounded-full px-2 ${
                    active ? "hf-type-strong bg-hf-white text-hf-black" : "text-hf-white/80 hover:bg-hf-white/20"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
