"use client";

import { useRef, useState } from "react";
import { IconPlayerPause, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { useTranslation } from "@/i18n/LocaleProvider";

const ACTION_WIDTH = 80;
const WIDTH = ACTION_WIDTH * 2;

// Swipe til venstre på en screening afslører Aktivér/Deaktivér og Slet
// (docs/DECISIONS.md 2026-10-09). Samme bevægelse som SwipeableRow.
export function ScreeningSwipeRow({
  active,
  onToggleActive,
  onDelete,
  children,
}: {
  active: boolean;
  onToggleActive: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  function down(e: React.PointerEvent) {
    startX.current = e.clientX;
    startOffset.current = dragX;
    moved.current = false;
    setDragging(true);
  }
  function move(e: React.PointerEvent) {
    if (startX.current === null) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) moved.current = true;
    setDragX(Math.max(-WIDTH, Math.min(0, startOffset.current + delta)));
  }
  function up() {
    startX.current = null;
    setDragging(false);
    setDragX((x) => (x < -WIDTH / 2 ? -WIDTH : 0));
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: WIDTH }}>
        <button
          type="button"
          aria-label={active ? t("screenings.deactivate") : t("screenings.activate")}
          onClick={() => {
            onToggleActive();
            setDragX(0);
          }}
          className="hf-type-small flex w-20 flex-col items-center justify-center gap-1 bg-hf-tan-dark text-hf-black"
        >
          {active ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}
          {active ? t("screenings.deactivate") : t("screenings.activate")}
        </button>
        <button
          type="button"
          aria-label={t("screenings.delete")}
          onClick={() => {
            onDelete();
            setDragX(0);
          }}
          className="hf-type-small flex w-20 flex-col items-center justify-center gap-1 bg-hf-danger text-hf-white"
        >
          <IconTrash size={20} />
          {t("screenings.delete")}
        </button>
      </div>
      <div
        className="relative bg-hf-cream"
        style={{ transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 200ms ease", touchAction: "pan-y" }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={(e) => {
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
