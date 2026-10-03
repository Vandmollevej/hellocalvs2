"use client";

import { useRef, useState } from "react";
import { IconAlertTriangle, IconCopy } from "@tabler/icons-react";
import { IconFavorite } from "@/components/icons/Favorite";
import { useTranslation } from "@/i18n/LocaleProvider";

const ACTION_WIDTH = 80;

export function SwipeableRow({
  onFavorite,
  onCopyToAccount,
  onReportError,
  onDelete,
  surfaceClassName = "bg-hf-cream",
  children,
}: {
  onFavorite?: () => void;
  // Familieabonnement (docs/FAMILY.md): kun når man styrer en anden profil.
  // Ligger til venstre ved siden af Favorit.
  onCopyToAccount?: () => void;
  onReportError?: () => void;
  onDelete: () => void;
  // Baggrund på den forreste flade; skal matche listen rækken ligger i.
  surfaceClassName?: string;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const rightActionsWidth = onReportError ? ACTION_WIDTH * 2 : ACTION_WIDTH; // (Fejl +) Slet
  const leftActionsWidth = (onFavorite ? ACTION_WIDTH : 0) + (onCopyToAccount ? ACTION_WIDTH : 0); // Favorit (+ Kopier)
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  const startOffset = useRef(0);
  // Som på iPhone: én bevægelse åbner kun én side. Fra lukket låses siden af
  // første retning; en åben række kan kun lukkes, ikke trækkes over i modsat side.
  const side = useRef<"left" | "right" | null>(null);

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startOffset.current = dragX;
    side.current = dragX > 0 ? "left" : dragX < 0 ? "right" : null;
    dragging.current = true;
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current || startX.current === null) return;
    const next = startOffset.current + e.clientX - startX.current;
    if (side.current === null && next !== 0) side.current = next > 0 ? "left" : "right";
    const minimum = side.current === "right" ? -rightActionsWidth : 0;
    const maximum = side.current === "left" ? leftActionsWidth : 0;
    setDragX(Math.max(minimum, Math.min(maximum, next)));
  }

  function handlePointerUp() {
    dragging.current = false;
    setIsDragging(false);
    startX.current = null;
    side.current = null;
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
            className="hf-type-small hf-type-strong flex flex-col items-center gap-1 text-hf-white"
          >
            <IconFavorite size={18} />
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
            className="hf-type-small hf-type-strong flex flex-col items-center gap-1 text-center text-hf-white"
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
            className="hf-type-small hf-type-strong flex flex-col items-center gap-1 text-hf-white"
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
          className="hf-type-small hf-type-strong text-hf-white"
        >
          {t("swipeableRow.delete")}
        </button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative transition-transform ${surfaceClassName}`}
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
