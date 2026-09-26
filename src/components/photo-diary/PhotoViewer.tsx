"use client";

import { useEffect, useRef } from "react";
import { IconChevronLeft, IconChevronRight, IconTrash, IconX } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";
import { formatPhotoDay, formatPhotoTime, wrapIndex, type DiaryPhoto } from "@/lib/photo-diary";

const SWIPE_THRESHOLD = 50;

// Fuldskærm med luft om billedet, så datoen altid kan ses nederst. Samme
// retning og loop som karrusellen: ældre til venstre, nyere til højre.
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onDelete,
}: {
  // Ældste først.
  photos: DiaryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const startX = useRef<number | null>(null);
  const count = photos.length;
  const photo = photos[index];

  function go(direction: 1 | -1) {
    if (count > 1) onIndexChange(wrapIndex(index + direction, count));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && count > 1) onIndexChange(wrapIndex(index - 1, count));
      else if (event.key === "ArrowRight" && count > 1) onIndexChange(wrapIndex(index + 1, count));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, index, onClose, onIndexChange]);

  function handlePointerDown(event: React.PointerEvent) {
    startX.current = event.clientX;
  }

  function handlePointerUp(event: React.PointerEvent) {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    startX.current = null;
    if (delta > SWIPE_THRESHOLD) go(-1);
    else if (delta < -SWIPE_THRESHOLD) go(1);
  }

  if (!photo) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("photoDiary.title")}
      className="fixed inset-0 z-50 flex flex-col bg-hf-black"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="hf-btn-icon text-hf-white"
        >
          <IconX size={24} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(photo.id)}
          aria-label={t("photoDiary.deleteAria")}
          className="hf-btn-icon text-hf-white"
        >
          <IconTrash size={20} />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-pan-y select-none"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          startX.current = null;
        }}
      >
        <div className="absolute inset-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={t("photoDiary.photoAlt")}
            draggable={false}
            className="max-h-full max-w-full rounded-2xl object-contain"
          />
        </div>
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("photoDiary.previousPhoto")}
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-hf-black/40 text-hf-white"
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("photoDiary.nextPhoto")}
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-hf-black/40 text-hf-white"
            >
              <IconChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      <div className="px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] text-center">
        <p className="hf-type-card-title text-hf-white">{formatPhotoDay(photo.takenAt)}</p>
        <p className="hf-type-small text-hf-white/70">
          {t("common.clockPrefix")} {formatPhotoTime(photo.takenAt)}
        </p>
      </div>
    </div>
  );
}
