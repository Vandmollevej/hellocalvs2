"use client";

import { useRef, useState } from "react";
import { IconBookmark, IconAlertTriangle, IconCopy } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

const ACTION_WIDTH = 80;

export function SwipeableRow({
  onFavorite,
  onCopyToAccount,
  onReportError,
  onDelete,
  children,
}: {
  onFavorite?: () => void;
  // Familieabonnement (docs/FAMILY.md): kun når man styrer en anden profil.
  // Ligger til venstre ved siden af Favorit.
  onCopyToAccount?: () => void;
  onReportError?: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const rightActionsWidth = onReportError ? ACTION_WIDTH * 2 : ACTION_WIDTH; // (Fejl +) Slet
  const leftActionsWidth = (onFavorite ? ACTION_WIDTH : 0) + (onCopyToAccount ? ACTION_WIDTH : 0); // Favorit (+ Kopier)
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    dragging.current = true;
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    const minimum = -rightActionsWidth;
    const maximum = leftActionsWidth;
    const clamped = Math.max(minimum, Math.min(maximum, delta));
    setDragX(clamped);
  }

  function handlePointerUp() {
    dragging.current = false;
    setIsDragging(false);
    startX.current = null;
    // Snap to a fully open/closed position instead of a random in-between one.
    setDragX((x) => {
      if (leftActionsWidth > 0 && x > leftActionsWidth / 2) return leftActionsWidth;
      if (x < -rightActionsWidth / 2) return -rightActionsWidth;
      return 0;
    });
  }

  return (
    <div className="relative overflow-hidden">
      {onFavorite && (
        <div className="absolute inset-y-0 left-0 flex w-20 items-center justify-center bg-hf-green">
          <button
            onClick={() => {
              onFavorite();
              setDragX(0);
            }}
            aria-label={t("swipeableRow.saveAsFavorite")}
            className="flex flex-col items-center gap-1 text-xs font-bold text-hf-white"
          >
            <IconBookmark size={18} />
            {t("swipeableRow.favorite")}
          </button>
        </div>
      )}
      {onCopyToAccount && (
        <div
          className={`absolute inset-y-0 flex w-20 items-center justify-center bg-hf-watch ${onFavorite ? "left-20" : "left-0"}`}
        >
          <button
            onClick={() => {
              onCopyToAccount();
              setDragX(0);
            }}
            aria-label={t("family.copy.action")}
            className="flex flex-col items-center gap-1 text-center text-xs font-bold leading-tight text-hf-white"
          >
            <IconCopy size={18} />
            {t("family.copy.action")}
          </button>
        </div>
      )}
      {onReportError && (
        <div className="absolute inset-y-0 right-20 flex w-20 items-center justify-center bg-hf-gray-dark">
          <button
            onClick={() => {
              onReportError();
              setDragX(0);
            }}
            aria-label={t("swipeableRow.reportErrorAria")}
            className="flex flex-col items-center gap-1 text-xs font-bold text-hf-white"
          >
            <IconAlertTriangle size={18} />
            {t("swipeableRow.reportError")}
          </button>
        </div>
      )}
      <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-hf-red-dark">
        <button
          onClick={() => {
            onDelete();
            setDragX(0);
          }}
          aria-label={t("swipeableRow.delete")}
          className="text-xs font-bold text-hf-white"
        >
          {t("swipeableRow.delete")}
        </button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative bg-hf-cream transition-transform"
        style={{
          transform: `translateX(${dragX}px)`,
          transitionDuration: isDragging ? "0ms" : "150ms",
        }}
      >
        {children}
      </div>
    </div>
  );
}
